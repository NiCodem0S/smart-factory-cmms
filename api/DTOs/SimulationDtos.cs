using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Simulation;
using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.DTOs;

public sealed class TriggerSimulationScenarioDto
{
    [Required, EnumDataType(typeof(SimulationScenario))]
    public SimulationScenario? Scenario { get; set; }
}

public sealed record SimulationMachineDto(Guid MachineId, string Name, Guid FactoryHallId, Guid? ProductionLineId,
    MachineStatus MachineStatus, bool SimulationEnabled, string WorkerStatus, string? LastError,
    MachineSimState? State, double? StateAgeSeconds, SimulationProfileDto? Profile, string? LineStatus,
    bool AutomationEnabled, DateTimeOffset? AutomaticRepairAtUtc);

public sealed class UpdateSimulationAutomationDto
{
    [Required]
    public bool? Enabled { get; set; }
}

public sealed record SimulationAutomationDto(bool Enabled, int HealthyLinesInView, int PendingRepairsInView,
    int RepairMinSeconds, int RepairMaxSeconds, string? Warning);

public sealed record SimulationListDto(bool RedisAvailable, string? ServiceError,
    IReadOnlyList<SimulationMachineDto> Machines, long DroppedHistorySamples, long PersistedHistorySamples,
    long PersistenceErrors, int HistoryQueueLength, DateTimeOffset? LastHistoryWriteAtUtc, string? LastHistoryError,
    SimulationAutomationDto Automation);
