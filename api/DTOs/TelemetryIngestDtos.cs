using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Validation;

namespace SmartFactoryCMMS.Api.DTOs;

public sealed class TelemetryIngestSampleDto
{
    public DateTimeOffset? TimestampUtc { get; set; }

    [FiniteRange(-273.15, 2000)]
    public double? Temperature { get; set; }

    [FiniteRange(0, 100000)]
    public double? Vibration { get; set; }

    [FiniteRange(0, 1000000)]
    public double? PowerLoadKw { get; set; }

    [Range(0, 600000)]
    public int? NetworkLatencyMs { get; set; }

    [Range(0, 100000)]
    public int? ProducedDelta { get; set; }

    [Range(0, int.MaxValue)]
    public int? TotalProduced { get; set; }

    public Dictionary<string, double>? AdditionalMetrics { get; set; }
}

/// Accepts either a single flat reading or a mini-batch in Samples[] (up to 100 samples per request).
public sealed class TelemetryIngestRequestDto
{
    public DateTimeOffset? TimestampUtc { get; set; }

    [FiniteRange(-273.15, 2000)]
    public double? Temperature { get; set; }

    [FiniteRange(0, 100000)]
    public double? Vibration { get; set; }

    [FiniteRange(0, 1000000)]
    public double? PowerLoadKw { get; set; }

    [Range(0, 600000)]
    public int? NetworkLatencyMs { get; set; }

    [Range(0, 100000)]
    public int? ProducedDelta { get; set; }

    [Range(0, int.MaxValue)]
    public int? TotalProduced { get; set; }

    public Dictionary<string, double>? AdditionalMetrics { get; set; }

    public List<TelemetryIngestSampleDto>? Samples { get; set; }
}

public sealed record TelemetryIngestResultDto(
    Guid MachineId,
    int AcceptedSamples,
    int QueuedHistorySamples,
    string Status,
    int TotalProduced,
    DateTimeOffset LastTickAtUtc);

public sealed record DeviceKeyResponseDto(
    Guid MachineId,
    string DeviceKey,
    string DeviceKeyPrefix,
    string IngestEndpoint);
