using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.DTOs;

public sealed record MaintenanceWorkOrderDto(
    Guid Id,
    string TicketNumber,
    string Title,
    string? Description,
    string Type,
    string Status,
    Guid MachineId,
    string MachineName,
    string? MachineSerialNumber,
    string MachineStatus,
    Guid FactoryHallId,
    string FactoryHallName,
    string? ProductionLineName,
    Guid? AssignedUserId,
    string? AssigneeName,
    DateTime CreatedAtUtc,
    DateTime? DueDateUtc,
    DateTime? ResolvedAtUtc,
    bool IsOverdue);

public sealed record MaintenanceSummaryDto(
    int Total,
    int Open,
    int InProgress,
    int Review,
    int Resolved,
    int Overdue,
    int CriticalOpen,
    int ScheduledToday);

public sealed record MaintenanceAssigneeDto(
    Guid UserId,
    string FullName,
    string Role,
    Guid? FactoryHallId,
    int ActiveWorkOrdersCount);

public sealed record MaintenanceAttentionMachineDto(
    Guid MachineId,
    string MachineName,
    string? SerialNumber,
    string Status,
    string TelemetrySource,
    Guid FactoryHallId,
    string FactoryHallName,
    string? ProductionLineName,
    int OpenWorkOrdersCount);

public sealed record MaintenanceMachineOptionDto(
    Guid Id,
    string Name,
    string? SerialNumber,
    string Status,
    Guid FactoryHallId,
    string FactoryHallName,
    string? ProductionLineName);

public sealed record MaintenanceOverviewDto(
    PagedResult<MaintenanceWorkOrderDto> Items,
    MaintenanceSummaryDto Summary,
    IReadOnlyList<MaintenanceAssigneeDto> Assignees,
    IReadOnlyList<MaintenanceAttentionMachineDto> AttentionMachines,
    DateTime GeneratedAtUtc);

public sealed class CreateMaintenanceWorkOrderDto
{
    [Required]
    public Guid MachineId { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(32)]
    public string Type { get; set; } = "Routine";

    public Guid? AssignedUserId { get; set; }

    public DateTime? DueDateUtc { get; set; }
}

public sealed class PatchMaintenanceWorkOrderDto
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(32)]
    public string? Status { get; set; }

    [MaxLength(32)]
    public string? Type { get; set; }

    public Guid? AssignedUserId { get; set; }

    public bool ClearAssignee { get; set; }

    public DateTime? DueDateUtc { get; set; }

    public bool ClearDueDate { get; set; }
}
