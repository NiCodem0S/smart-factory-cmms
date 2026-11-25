using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services.Abstract;

public sealed record QueuedTelemetryBatch(
    IReadOnlyList<TelemetryRead> Samples,
    IReadOnlyList<string> StreamEntryIds,
    bool FromRedisStream);

/// Durable history queue abstraction (backed by Redis Streams in production with in-memory fallback).
public interface ITelemetryHistoryQueue
{
    ValueTask EnqueueAsync(TelemetryRead sample, CancellationToken ct = default);
    Task<QueuedTelemetryBatch> ReadBatchAsync(int maxCount, CancellationToken ct = default);
    Task AcknowledgeAsync(IReadOnlyList<string> streamEntryIds, CancellationToken ct = default);
    Task<long> GetApproximateLengthAsync(CancellationToken ct = default);
}
