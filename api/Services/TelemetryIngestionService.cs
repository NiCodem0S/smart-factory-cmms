using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

/// Handles real industrial device telemetry ingestion:
/// - Authenticates via SHA-256 X-Device-Key (per machine)
/// - Rate-limits runaway devices
/// - Hot path: updates Redis latest state + broadcasts live SignalR ReceiveTelemetry
/// - Warm path: throttled + deadband sampling pushed to Redis Stream (batch INSERT to SQL)
/// - Critical path: immediate SQL persistence of Incidents, MachineStatus and ProductionLineStatus on transitions
public sealed class TelemetryIngestionService(
    IServiceScopeFactory scopes,
    ISimulationStateStore stateStore,
    ITelemetryHistoryQueue historyQueue,
    IHubContext<TelemetryHub> hub,
    IOptions<SimulationOptions> options,
    ILogger<TelemetryIngestionService> logger)
{
    public const int MaxBatchSamples = 100;
    private const int MaxSamplesPerMinutePerDevice = 180;
    private const double TempDeadbandC = 0.5;
    private const double VibDeadbandMmS = 0.1;
    private const double PowerDeadbandKw = 1.0;

    private sealed class DeviceRuntimeTracker
    {
        public readonly object Sync = new();
        public DateTimeOffset WindowStartUtc = DateTimeOffset.UtcNow;
        public int SamplesInWindow;
        public DateTimeOffset LastHistoryWriteUtc = DateTimeOffset.MinValue;
        public DateTimeOffset LastSqlCounterSyncUtc = DateTimeOffset.MinValue;
        public double? LastHistoryTemp;
        public double? LastHistoryVib;
        public double? LastHistoryPower;
        public long TickNumber;
    }

    private readonly ConcurrentDictionary<Guid, DeviceRuntimeTracker> _trackers = new();

    public void ClearDeviceCache(Guid machineId)
    {
        _trackers.TryRemove(machineId, out _);
    }

    public async Task<TelemetryIngestResultDto> IngestAsync(
        string? rawDeviceKey,
        TelemetryIngestRequestDto request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawDeviceKey))
        {
            throw new SimulationRequestException(401, "Missing X-Device-Key header.");
        }

        var samples = ExtractSamples(request);
        if (samples.Count == 0)
        {
            throw new SimulationRequestException(400, "Provide at least one telemetry reading.");
        }

        if (samples.Count > MaxBatchSamples)
        {
            throw new SimulationRequestException(400, $"At most {MaxBatchSamples} telemetry samples may be sent per request.");
        }

        var keyHash = DeviceKeyService.Hash(rawDeviceKey.Trim());

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var machine = await db.Machines
            .Include(m => m.AlertThresholds)
            .Include(m => m.ProductionLine)
            .SingleOrDefaultAsync(m => m.DeviceKeyHash == keyHash && m.IsActive, ct);

        if (machine is null)
        {
            throw new SimulationRequestException(401, "Invalid or revoked device API key.");
        }

        if (machine.TelemetrySource != TelemetrySource.RealDevice)
        {
            throw new SimulationRequestException(409, "Telemetry ingest is only accepted for RealDevice machines.");
        }

        var tracker = _trackers.GetOrAdd(machine.Id, _ => new DeviceRuntimeTracker());
        CheckRateLimit(tracker, samples.Count);

        var now = DateTimeOffset.UtcNow;
        var ordered = samples
            .Select(s => NormalizeSample(s, now))
            .OrderBy(s => s.TimestampUtc)
            .ToList();

        var previousStatus = machine.Status;
        var currentStatus = machine.Status;
        var currentProduced = machine.TotalProduced;
        var thresholds = ExtractThresholds(machine.AlertThresholds);

        int queuedHistory = 0;
        bool sqlDirty = false;
        MachineSimState? latestState = null;

        foreach (var sample in ordered)
        {
            if (sample.TotalProduced.HasValue && sample.TotalProduced.Value >= currentProduced)
            {
                currentProduced = sample.TotalProduced.Value;
            }
            else if (sample.ProducedDelta.HasValue && sample.ProducedDelta.Value > 0)
            {
                currentProduced = checked(currentProduced + sample.ProducedDelta.Value);
            }

            var evaluation = EvaluateStatus(currentStatus, sample, thresholds);
            var transitioned = evaluation.Status != currentStatus;
            var prevForSample = currentStatus;
            currentStatus = evaluation.Status;

            var sampleId = DeterministicSampleId(machine.Id, sample.TimestampUtc);
            var additionalJson = sample.AdditionalMetrics is { Count: > 0 }
                ? JsonSerializer.Serialize(sample.AdditionalMetrics)
                : null;

            var telemetryRow = new TelemetryRead
            {
                Id = sampleId,
                MachineId = machine.Id,
                Timestamp = sample.TimestampUtc.UtcDateTime,
                Temperature = sample.Temperature.HasValue ? (decimal)Math.Round(sample.Temperature.Value, 2) : null,
                Vibration = sample.Vibration.HasValue ? (decimal)Math.Round(sample.Vibration.Value, 2) : null,
                PowerLoadKw = sample.PowerLoadKw.HasValue ? (decimal)Math.Round(sample.PowerLoadKw.Value, 2) : null,
                NetworkLatencyMs = sample.NetworkLatencyMs,
                AdditionalMetrics = additionalJson
            };

            if (transitioned && currentStatus is MachineStatus.Warning or MachineStatus.Error)
            {
                // Critical Path: persist incident + critical sample directly to SQL (never lossy)
                if (!await db.Incidents.AnyAsync(i => i.Id == sampleId, ct))
                {
                    db.Incidents.Add(new Incident
                    {
                        Id = sampleId,
                        MachineId = machine.Id,
                        TriggeredAt = sample.TimestampUtc.UtcDateTime,
                        Severity = currentStatus == MachineStatus.Error ? "Critical" : "Warning",
                        Status = "Active",
                        Message = FormatIncidentMessage(machine.Name, currentStatus, evaluation.FaultMode, sample)
                    });
                }

                if (!await db.TelemetryRead.AnyAsync(t => t.Id == sampleId, ct))
                {
                    db.TelemetryRead.Add(telemetryRow);
                }

                RecordHistoryWritten(tracker, sample);
                sqlDirty = true;
            }
            else
            {
                if (transitioned && currentStatus == MachineStatus.Running && prevForSample == MachineStatus.Warning)
                {
                    var activeWarnings = await db.Incidents
                        .Where(i => i.MachineId == machine.Id && i.Status == "Active" && i.Severity == "Warning" && i.Message.StartsWith("Telemetry:"))
                        .ToListAsync(ct);
                    foreach (var warning in activeWarnings)
                    {
                        warning.Status = "Resolved";
                    }
                    sqlDirty = true;
                }

                if (ShouldQueueHistory(tracker, sample, options.Value.HistorySampleIntervalSeconds))
                {
                    await historyQueue.EnqueueAsync(telemetryRow, ct);
                    RecordHistoryWritten(tracker, sample);
                    queuedHistory++;
                }
            }

            long tick;
            lock (tracker.Sync)
            {
                tracker.TickNumber++;
                tick = tracker.TickNumber;
            }

            latestState = new MachineSimState
            {
                SchemaVersion = MachineSimState.CurrentSchemaVersion,
                MachineId = machine.Id,
                TickNumber = tick,
                ProfileVersion = 1,
                LastTickAtUtc = sample.TimestampUtc,
                MachineStatus = currentStatus,
                TotalProduced = currentProduced,
                Temperature = sample.Temperature ?? 0,
                Vibration = sample.Vibration ?? 0,
                PowerLoadKw = sample.PowerLoadKw ?? 0,
                CycleProgressSeconds = 0,
                Wear = 0,
                IsOverheating = evaluation.IsOverheating,
                IsOvervibrating = evaluation.IsOvervibrating,
                FaultMode = evaluation.FaultMode
            };
        }

        // Persist status change or periodic production counter sync to SQL
        var shouldSyncCounter = currentProduced != machine.TotalProduced &&
            (now - tracker.LastSqlCounterSyncUtc).TotalSeconds >= options.Value.CheckpointIntervalSeconds;

        if (currentStatus != previousStatus || sqlDirty || shouldSyncCounter)
        {
            machine.Status = currentStatus;
            machine.TotalProduced = currentProduced;

            if (machine.ProductionLineId.HasValue && currentStatus != previousStatus)
            {
                await UpdateProductionLineStatusAsync(db, machine.ProductionLineId.Value, ct);
            }

            await db.SaveChangesAsync(ct);
            tracker.LastSqlCounterSyncUtc = now;
        }

        // Hot Path: write latest state to Redis & broadcast live SignalR update
        if (latestState is not null)
        {
            try
            {
                await stateStore.WriteAsync(latestState, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Could not publish live Redis state for RealDevice {MachineId}", machine.Id);
            }

            try
            {
                var groups = hub.Clients.Groups(
                    TelemetryHub.MachineGroup(machine.FactoryHallId, machine.Id),
                    TelemetryHub.HallGroup(machine.FactoryHallId));
                await groups.SendAsync("ReceiveTelemetry", latestState, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Live SignalR broadcast failed for RealDevice {MachineId}", machine.Id);
            }
        }

        return new TelemetryIngestResultDto(
            machine.Id,
            ordered.Count,
            queuedHistory,
            currentStatus.ToString(),
            currentProduced,
            latestState?.LastTickAtUtc ?? now);
    }

    private static List<TelemetryIngestSampleDto> ExtractSamples(TelemetryIngestRequestDto request)
    {
        if (request.Samples is { Count: > 0 })
        {
            return request.Samples;
        }

        var hasFlatValue = request.Temperature.HasValue ||
                           request.Vibration.HasValue ||
                           request.PowerLoadKw.HasValue ||
                           request.NetworkLatencyMs.HasValue ||
                           request.ProducedDelta.HasValue ||
                           request.TotalProduced.HasValue ||
                           request.AdditionalMetrics is { Count: > 0 };

        if (!hasFlatValue)
        {
            return new List<TelemetryIngestSampleDto>();
        }

        return new List<TelemetryIngestSampleDto>
        {
            new()
            {
                TimestampUtc = request.TimestampUtc,
                Temperature = request.Temperature,
                Vibration = request.Vibration,
                PowerLoadKw = request.PowerLoadKw,
                NetworkLatencyMs = request.NetworkLatencyMs,
                ProducedDelta = request.ProducedDelta,
                TotalProduced = request.TotalProduced,
                AdditionalMetrics = request.AdditionalMetrics
            }
        };
    }

    private sealed record NormalizedSample(
        DateTimeOffset TimestampUtc,
        double? Temperature,
        double? Vibration,
        double? PowerLoadKw,
        int? NetworkLatencyMs,
        int? ProducedDelta,
        int? TotalProduced,
        Dictionary<string, double>? AdditionalMetrics);

    private static NormalizedSample NormalizeSample(TelemetryIngestSampleDto dto, DateTimeOffset now)
    {
        var ts = (dto.TimestampUtc ?? now).ToUniversalTime();
        if (ts > now.AddMinutes(5))
        {
            throw new SimulationRequestException(400, "Telemetry timestamp cannot be more than 5 minutes in the future.");
        }
        if (ts < now.AddDays(-7))
        {
            throw new SimulationRequestException(400, "Telemetry timestamp cannot be older than 7 days.");
        }

        ValidateFinite(dto.Temperature, "Temperature", -273.15, 2000);
        ValidateFinite(dto.Vibration, "Vibration", 0, 100000);
        ValidateFinite(dto.PowerLoadKw, "PowerLoadKw", 0, 1000000);

        if (dto.AdditionalMetrics is not null)
        {
            if (dto.AdditionalMetrics.Count > 32)
            {
                throw new SimulationRequestException(400, "At most 32 additional metrics are allowed per sample.");
            }
            foreach (var (key, val) in dto.AdditionalMetrics)
            {
                if (string.IsNullOrWhiteSpace(key) || key.Length > 64 || !double.IsFinite(val))
                {
                    throw new SimulationRequestException(400, $"Invalid additional metric '{key}'.");
                }
            }
        }

        return new NormalizedSample(
            ts,
            dto.Temperature,
            dto.Vibration,
            dto.PowerLoadKw,
            dto.NetworkLatencyMs,
            dto.ProducedDelta,
            dto.TotalProduced,
            dto.AdditionalMetrics);
    }

    private static void ValidateFinite(double? value, string name, double min, double max)
    {
        if (!value.HasValue) return;
        if (!double.IsFinite(value.Value) || value.Value < min || value.Value > max)
        {
            throw new SimulationRequestException(400, $"{name} must be a finite value between {min} and {max}.");
        }
    }

    private static void CheckRateLimit(DeviceRuntimeTracker tracker, int sampleCount)
    {
        var now = DateTimeOffset.UtcNow;
        lock (tracker.Sync)
        {
            if ((now - tracker.WindowStartUtc).TotalSeconds >= 60)
            {
                tracker.WindowStartUtc = now;
                tracker.SamplesInWindow = 0;
            }

            if (tracker.SamplesInWindow + sampleCount > MaxSamplesPerMinutePerDevice)
            {
                throw new SimulationRequestException(429, "Device telemetry rate limit exceeded. Slow down or batch readings.");
            }

            tracker.SamplesInWindow += sampleCount;
        }
    }

    private sealed record ThresholdSet(
        MetricThreshold? Temperature,
        MetricThreshold? Vibration,
        MetricThreshold? Power);

    private static ThresholdSet ExtractThresholds(ICollection<AlertThreshold> rows)
    {
        MetricThreshold? Find(params string[] keys)
        {
            var row = rows.FirstOrDefault(r => keys.Any(k => string.Equals(r.MetricType, k, StringComparison.OrdinalIgnoreCase)));
            return row is null ? null : new MetricThreshold((double)row.WarningValue, (double)row.CriticalValue);
        }

        return new ThresholdSet(
            Find("Temperature"),
            Find("Vibration"),
            Find("Power", "PowerLoadKw"));
    }

    private sealed record StatusEvaluation(
        MachineStatus Status,
        bool IsOverheating,
        bool IsOvervibrating,
        SimulationFaultMode FaultMode);

    private static StatusEvaluation EvaluateStatus(MachineStatus currentStatus, NormalizedSample sample, ThresholdSet thresholds)
    {
        var tempCrit = sample.Temperature.HasValue && thresholds.Temperature is not null && sample.Temperature.Value >= thresholds.Temperature.Critical;
        var tempWarn = sample.Temperature.HasValue && thresholds.Temperature is not null && sample.Temperature.Value >= thresholds.Temperature.Warning;
        var vibCrit = sample.Vibration.HasValue && thresholds.Vibration is not null && sample.Vibration.Value >= thresholds.Vibration.Critical;
        var vibWarn = sample.Vibration.HasValue && thresholds.Vibration is not null && sample.Vibration.Value >= thresholds.Vibration.Warning;
        var powerCrit = sample.PowerLoadKw.HasValue && thresholds.Power is not null && sample.PowerLoadKw.Value >= thresholds.Power.Critical;
        var powerWarn = sample.PowerLoadKw.HasValue && thresholds.Power is not null && sample.PowerLoadKw.Value >= thresholds.Power.Warning;

        // Planned maintenance suppresses automated fault transitions while still streaming real readings.
        if (currentStatus == MachineStatus.Maintenance)
        {
            return new StatusEvaluation(MachineStatus.Maintenance, tempWarn || tempCrit, vibWarn || vibCrit, SimulationFaultMode.None);
        }

        if (tempCrit)
            return new StatusEvaluation(MachineStatus.Error, true, vibWarn || vibCrit, SimulationFaultMode.Overheating);
        if (vibCrit)
            return new StatusEvaluation(MachineStatus.Error, tempWarn, true, SimulationFaultMode.ExcessVibration);
        if (powerCrit)
            return new StatusEvaluation(MachineStatus.Error, tempWarn, vibWarn, SimulationFaultMode.Generic);

        if (tempWarn || vibWarn || powerWarn)
        {
            var mode = tempWarn ? SimulationFaultMode.Overheating : vibWarn ? SimulationFaultMode.ExcessVibration : SimulationFaultMode.None;
            return new StatusEvaluation(MachineStatus.Warning, tempWarn, vibWarn, mode);
        }

        return new StatusEvaluation(MachineStatus.Running, false, false, SimulationFaultMode.None);
    }

    private static bool ShouldQueueHistory(DeviceRuntimeTracker tracker, NormalizedSample sample, int minIntervalSeconds)
    {
        lock (tracker.Sync)
        {
            if (tracker.LastHistoryWriteUtc == DateTimeOffset.MinValue) return true;
            if ((sample.TimestampUtc - tracker.LastHistoryWriteUtc).TotalSeconds >= minIntervalSeconds) return true;

            if (sample.Temperature.HasValue && tracker.LastHistoryTemp.HasValue &&
                Math.Abs(sample.Temperature.Value - tracker.LastHistoryTemp.Value) >= TempDeadbandC)
                return true;

            if (sample.Vibration.HasValue && tracker.LastHistoryVib.HasValue &&
                Math.Abs(sample.Vibration.Value - tracker.LastHistoryVib.Value) >= VibDeadbandMmS)
                return true;

            if (sample.PowerLoadKw.HasValue && tracker.LastHistoryPower.HasValue &&
                Math.Abs(sample.PowerLoadKw.Value - tracker.LastHistoryPower.Value) >= PowerDeadbandKw)
                return true;

            return false;
        }
    }

    private static void RecordHistoryWritten(DeviceRuntimeTracker tracker, NormalizedSample sample)
    {
        lock (tracker.Sync)
        {
            tracker.LastHistoryWriteUtc = sample.TimestampUtc;
            if (sample.Temperature.HasValue) tracker.LastHistoryTemp = sample.Temperature.Value;
            if (sample.Vibration.HasValue) tracker.LastHistoryVib = sample.Vibration.Value;
            if (sample.PowerLoadKw.HasValue) tracker.LastHistoryPower = sample.PowerLoadKw.Value;
        }
    }

    private static Guid DeterministicSampleId(Guid machineId, DateTimeOffset timestampUtc)
    {
        var key = FormattableString.Invariant($"iot/{machineId:D}/{timestampUtc.UtcTicks}");
        return new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(key)).AsSpan(0, 16));
    }

    private static string FormatIncidentMessage(string machineName, MachineStatus status, SimulationFaultMode mode, NormalizedSample sample)
    {
        var parts = new List<string>();
        if (sample.Temperature.HasValue) parts.Add(FormattableString.Invariant($"T={sample.Temperature.Value:F2}°C"));
        if (sample.Vibration.HasValue) parts.Add(FormattableString.Invariant($"V={sample.Vibration.Value:F2} mm/s"));
        if (sample.PowerLoadKw.HasValue) parts.Add(FormattableString.Invariant($"P={sample.PowerLoadKw.Value:F2} kW"));
        var readings = parts.Count > 0 ? "; " + string.Join(", ", parts) : string.Empty;
        return FormattableString.Invariant($"Telemetry: {machineName}: {status} ({mode}){readings}");
    }

    private static async Task UpdateProductionLineStatusAsync(ApplicationDbContext db, Guid lineId, CancellationToken ct)
    {
        var line = await db.ProductionLines.Include(l => l.Machines).SingleOrDefaultAsync(l => l.Id == lineId, ct);
        if (line is null) return;
        var active = line.Machines.Where(m => m.IsActive).ToArray();
        if (active.Length == 0) return;

        if (active.Any(m => m.Status is MachineStatus.Error or MachineStatus.Offline or MachineStatus.Maintenance))
        {
            line.Status = ProductionLinePolicy.Halted;
        }
        else if (active.Any(m => m.Status == MachineStatus.Warning))
        {
            line.Status = ProductionLinePolicy.Warning;
        }
        else if (line.Status == ProductionLinePolicy.Warning)
        {
            line.Status = ProductionLinePolicy.Running;
        }
    }
}
