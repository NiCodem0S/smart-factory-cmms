namespace SmartFactoryCMMS.Api.DTOs;

public sealed record TelemetrySeriesDto(DateTimeOffset FromUtc, DateTimeOffset ToUtc,
    int SampleIntervalSeconds, int BucketSeconds, IReadOnlyList<TelemetryReadDto> Samples);
