using System.Text.Json;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;
using StackExchange.Redis;

namespace SmartFactoryCMMS.Api.Services;

/// Durable telemetry history queue powered by Redis Streams (XADD / XREADGROUP / XACK / XAUTOCLAIM / MAXLEN)
/// with automatic graceful fallback to the bounded in-memory TelemetryChannel if Redis is unavailable.
public sealed class RedisTelemetryStreamQueue(
    RedisConnectionProvider redis,
    TelemetryChannel fallbackChannel,
    ILogger<RedisTelemetryStreamQueue> logger) : ITelemetryHistoryQueue
{
    public const string StreamKey = "telemetry:history";
    public const string GroupName = "persisters";
    public const int MaxStreamLength = 50_000;
    private const long ClaimMinIdleMs = 60_000;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly string _consumerName = $"api-{Environment.MachineName}-{Environment.ProcessId}";
    private volatile bool _groupEnsured;
    private DateTimeOffset _lastAutoClaimUtc = DateTimeOffset.MinValue;
    private DateTimeOffset _lastRedisWarningUtc = DateTimeOffset.MinValue;

    private sealed record StreamPayload(
        Guid Id,
        Guid MachineId,
        DateTime TimestampUtc,
        decimal? Temperature,
        decimal? Vibration,
        decimal? PowerLoadKw,
        int? NetworkLatencyMs,
        string? AdditionalMetrics);

    public async ValueTask EnqueueAsync(TelemetryRead sample, CancellationToken ct = default)
    {
        try
        {
            var connection = await redis.GetConnectionAsync(ct);
            if (!connection.IsConnected)
            {
                await FallbackEnqueueAsync(sample, "Redis connection is disconnected", ct);
                return;
            }

            var db = connection.GetDatabase();
            var payload = new StreamPayload(
                sample.Id,
                sample.MachineId,
                sample.Timestamp.Kind == DateTimeKind.Utc ? sample.Timestamp : DateTime.SpecifyKind(sample.Timestamp, DateTimeKind.Utc),
                sample.Temperature,
                sample.Vibration,
                sample.PowerLoadKw,
                sample.NetworkLatencyMs,
                sample.AdditionalMetrics);

            var json = JsonSerializer.Serialize(payload, Json);
            await db.StreamAddAsync(
                StreamKey,
                "payload",
                json,
                maxLength: MaxStreamLength,
                useApproximateMaxLength: true);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await FallbackEnqueueAsync(sample, ex.Message, ct);
        }
    }

    public async Task<QueuedTelemetryBatch> ReadBatchAsync(int maxCount, CancellationToken ct = default)
    {
        // Always drain any fallback in-memory items first so they never starve while Redis recovers.
        var fallback = DrainFallback(maxCount);
        if (fallback.Count > 0)
        {
            return new QueuedTelemetryBatch(fallback, Array.Empty<string>(), FromRedisStream: false);
        }

        try
        {
            var connection = await redis.GetConnectionAsync(ct);
            if (!connection.IsConnected)
            {
                return new QueuedTelemetryBatch(Array.Empty<TelemetryRead>(), Array.Empty<string>(), FromRedisStream: false);
            }

            var db = connection.GetDatabase();
            await EnsureConsumerGroupAsync(db);

            StreamEntry[] entries = Array.Empty<StreamEntry>();

            // Periodically reclaim pending entries orphaned by a previously crashed API process.
            var now = DateTimeOffset.UtcNow;
            if ((now - _lastAutoClaimUtc).TotalSeconds >= 15)
            {
                _lastAutoClaimUtc = now;
                try
                {
                    var claimed = await db.StreamAutoClaimAsync(
                        StreamKey,
                        GroupName,
                        _consumerName,
                        ClaimMinIdleMs,
                        "0-0",
                        count: maxCount);
                    entries = claimed.ClaimedEntries;
                }
                catch (RedisServerException ex) when (ex.Message.Contains("NOGROUP", StringComparison.OrdinalIgnoreCase))
                {
                    _groupEnsured = false;
                    await EnsureConsumerGroupAsync(db);
                }
            }

            if (entries.Length == 0)
            {
                try
                {
                    entries = await db.StreamReadGroupAsync(
                        StreamKey,
                        GroupName,
                        _consumerName,
                        StreamPosition.NewMessages,
                        count: maxCount);
                }
                catch (RedisServerException ex) when (ex.Message.Contains("NOGROUP", StringComparison.OrdinalIgnoreCase))
                {
                    _groupEnsured = false;
                    await EnsureConsumerGroupAsync(db);
                    entries = await db.StreamReadGroupAsync(
                        StreamKey,
                        GroupName,
                        _consumerName,
                        StreamPosition.NewMessages,
                        count: maxCount);
                }
            }

            if (entries.Length == 0)
            {
                return new QueuedTelemetryBatch(Array.Empty<TelemetryRead>(), Array.Empty<string>(), FromRedisStream: true);
            }

            var samples = new List<TelemetryRead>(entries.Length);
            var validIds = new List<string>(entries.Length);
            var poisonIds = new List<RedisValue>();

            foreach (var entry in entries)
            {
                var raw = entry["payload"];
                if (raw.IsNullOrEmpty)
                {
                    poisonIds.Add(entry.Id);
                    continue;
                }

                try
                {
                    var dto = JsonSerializer.Deserialize<StreamPayload>((string)raw!, Json);
                    if (dto is null || dto.MachineId == Guid.Empty)
                    {
                        poisonIds.Add(entry.Id);
                        continue;
                    }

                    samples.Add(new TelemetryRead
                    {
                        Id = dto.Id == Guid.Empty ? Guid.NewGuid() : dto.Id,
                        MachineId = dto.MachineId,
                        Timestamp = DateTime.SpecifyKind(dto.TimestampUtc, DateTimeKind.Utc),
                        Temperature = dto.Temperature,
                        Vibration = dto.Vibration,
                        PowerLoadKw = dto.PowerLoadKw,
                        NetworkLatencyMs = dto.NetworkLatencyMs,
                        AdditionalMetrics = dto.AdditionalMetrics
                    });
                    validIds.Add(entry.Id.ToString());
                }
                catch (JsonException)
                {
                    poisonIds.Add(entry.Id);
                }
            }

            if (poisonIds.Count > 0)
            {
                await db.StreamAcknowledgeAsync(StreamKey, GroupName, poisonIds.ToArray());
            }

            return new QueuedTelemetryBatch(samples, validIds, FromRedisStream: true);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            WarnThrottled($"Redis Stream read failed ({ex.Message}); falling back to in-memory buffer.");
            return new QueuedTelemetryBatch(Array.Empty<TelemetryRead>(), Array.Empty<string>(), FromRedisStream: false);
        }
    }

    public async Task AcknowledgeAsync(IReadOnlyList<string> streamEntryIds, CancellationToken ct = default)
    {
        if (streamEntryIds.Count == 0) return;
        try
        {
            var connection = await redis.GetConnectionAsync(ct);
            if (!connection.IsConnected) return;
            var db = connection.GetDatabase();
            var ids = streamEntryIds.Select(id => (RedisValue)id).ToArray();
            await db.StreamAcknowledgeAsync(StreamKey, GroupName, ids);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not acknowledge {Count} Redis Stream entries; idempotency will deduplicate on reclaim", streamEntryIds.Count);
        }
    }

    public async Task<long> GetApproximateLengthAsync(CancellationToken ct = default)
    {
        long total = fallbackChannel.Count;
        try
        {
            var connection = await redis.GetConnectionAsync(ct);
            if (!connection.IsConnected) return total;
            var db = connection.GetDatabase();
            var groups = await db.StreamGroupInfoAsync(StreamKey);
            var group = groups.FirstOrDefault(g => g.Name == GroupName);
            if (!string.IsNullOrEmpty(group.Name))
            {
                var lag = group.Lag ?? 0;
                total += group.PendingMessageCount + lag;
            }
            else
            {
                total += await db.StreamLengthAsync(StreamKey);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Stream might not exist yet before the first sample arrives.
            logger.LogDebug(ex, "Could not inspect Redis Stream {StreamKey} length", StreamKey);
        }
        return total;
    }

    private async Task EnsureConsumerGroupAsync(IDatabase db)
    {
        if (_groupEnsured) return;
        try
        {
            await db.StreamCreateConsumerGroupAsync(StreamKey, GroupName, "0-0", createStream: true);
        }
        catch (RedisServerException ex) when (ex.Message.Contains("BUSYGROUP", StringComparison.OrdinalIgnoreCase))
        {
            // Consumer group already exists.
        }
        _groupEnsured = true;
    }

    private async ValueTask FallbackEnqueueAsync(TelemetryRead sample, string reason, CancellationToken ct)
    {
        WarnThrottled($"Redis Stream unavailable ({reason}); buffering telemetry in memory.");
        await fallbackChannel.AddTelemetryAsync(sample, ct);
    }

    private List<TelemetryRead> DrainFallback(int maxCount)
    {
        var items = new List<TelemetryRead>();
        while (items.Count < maxCount && fallbackChannel.TryRead(out var sample))
        {
            if (sample is not null) items.Add(sample);
        }
        return items;
    }

    private void WarnThrottled(string message)
    {
        var now = DateTimeOffset.UtcNow;
        if ((now - _lastRedisWarningUtc).TotalSeconds < 30) return;
        _lastRedisWarningUtc = now;
        logger.LogWarning("{Message}", message);
    }
}
