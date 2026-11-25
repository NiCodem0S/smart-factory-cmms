using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs;

public sealed record DashboardDto(
    DateTime GeneratedAtUtc,
    Guid? FactoryHallId,
    IReadOnlyList<Guid> HallIds,
    IReadOnlyList<DashboardMachineDto> Machines,
    IReadOnlyList<DashboardIncidentDto> Incidents,
    DashboardSummaryDto Summary,
    IReadOnlyList<DashboardProductionLineDto>? ProductionLines = null,
    IReadOnlyList<DashboardWorkOrderDto>? WorkOrders = null,
    IReadOnlyList<DashboardThresholdDto>? Thresholds = null,
    decimal PeakPowerLimitKw = 2500m,
    DashboardShiftDto? CurrentShift = null,
    string SiteName = "Smart Factory Plant");

public sealed record DashboardMachineDto(
    Guid Id,
    string Name,
    string Category,
    string? SerialNumber,
    Guid FactoryHallId,
    string FactoryHallName,
    Guid? ProductionLineId,
    string? ProductionLineName,
    int OrderInLine,
    MachineStatus Status,
    int TotalProduced,
    DashboardTelemetryDto? LatestTelemetry,
    double TotalOperatingHours = 0,
    double CycleTimeSeconds = 5.0,
    string? Icon = null,
    TelemetrySource TelemetrySource = TelemetrySource.Simulated);

public sealed record DashboardTelemetryDto(
    DateTime TimestampUtc,
    decimal? Temperature,
    decimal? Vibration,
    decimal? PowerLoadKw,
    int? NetworkLatencyMs);

public sealed record DashboardIncidentDto(
    Guid Id,
    Guid MachineId,
    string MachineName,
    Guid FactoryHallId,
    DateTime TriggeredAtUtc,
    string Severity,
    string Status,
    string Message);

public sealed record DashboardProductionLineDto(
    Guid Id,
    string Name,
    string Status,
    Guid FactoryHallId,
    string FactoryHallName,
    int? OrderInHall,
    DateTime? LastStatusChangedAtUtc,
    string? ProductName,
    string? ProductSku);

public sealed record DashboardWorkOrderDto(
    Guid Id,
    string TicketNumber,
    Guid MachineId,
    string MachineName,
    Guid FactoryHallId,
    string Title,
    string Type,
    string Status,
    Guid? AssignedUserId,
    string? AssigneeName,
    DateTime CreatedAtUtc,
    DateTime? DueDateUtc);

public sealed record DashboardThresholdDto(
    Guid MachineId,
    string MetricType,
    decimal WarningValue,
    decimal CriticalValue);

public sealed record DashboardShiftDto(
    string Name,
    string StartTime,
    string EndTime,
    int ProgressPercent);

public sealed record UpdateIncidentStatusDto(string Status);

public sealed record UpdateWorkOrderStatusDto(string Status);

public sealed record DispatchWorkOrderDto(
    Guid MachineId,
    string? Title = null,
    string? Type = null);

public sealed record DashboardSummaryDto(
    int TotalMachines,
    int RunningMachines,
    int WarningMachines,
    int ErrorMachines,
    int MaintenanceMachines,
    int OfflineMachines,
    int ActiveCriticalIncidents,
    long TotalProduced,
    decimal? PowerLoadKw,
    double? AverageLatencyMs,
    int MachinesWithPowerReadings);
