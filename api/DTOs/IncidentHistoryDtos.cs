namespace SmartFactoryCMMS.Api.DTOs;

public sealed record IncidentHistoryItemDto(
    Guid Id,
    Guid MachineId,
    string MachineName,
    string? MachineSerialNumber,
    string MachineCategory,
    string MachineStatus,
    Guid FactoryHallId,
    string FactoryHallName,
    string? ProductionLineName,
    DateTime TriggeredAtUtc,
    string Severity,
    string Status,
    string Message,
    int OpenWorkOrdersCount);

public sealed record IncidentHistorySummaryDto(
    int Total,
    int Active,
    int Acknowledged,
    int Resolved,
    int CriticalOpen,
    int WarningOpen);

public sealed record IncidentActivityBucketDto(
    string Label,
    DateTime StartUtc,
    int CriticalCount,
    int WarningCount);

public sealed record IncidentHotspotDto(
    Guid MachineId,
    string MachineName,
    string? ProductionLineName,
    int TotalCount,
    int CriticalCount);

public sealed record IncidentHistoryResponseDto(
    PagedResult<IncidentHistoryItemDto> Items,
    IncidentHistorySummaryDto Summary,
    IReadOnlyList<IncidentActivityBucketDto> Activity,
    IReadOnlyList<IncidentHotspotDto> Hotspots,
    DateTime GeneratedAtUtc);
