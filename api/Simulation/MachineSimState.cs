using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

/// An immutable snapshot of one machine, independent of EF, Redis and SignalR.
public sealed record MachineSimState
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public Guid MachineId { get; init; }
    public long TickNumber { get; init; }
    public long ProfileVersion { get; init; }
    public DateTimeOffset LastTickAtUtc { get; init; }
    public MachineStatus MachineStatus { get; init; }
    public int TotalProduced { get; init; }
    public double Temperature { get; init; }
    public double Vibration { get; init; }
    public double PowerLoadKw { get; init; }
    public double CycleProgressSeconds { get; init; }
    public double Wear { get; init; }
    public bool IsOverheating { get; init; }
    public bool IsOvervibrating { get; init; }
    public SimulationFaultMode FaultMode { get; init; }

    public static MachineSimState CreateInitial(Guid machineId, SimulationProfileSnapshot profile,
        DateTimeOffset now, MachineStatus status = MachineStatus.Running, int totalProduced = 0)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (machineId == Guid.Empty) throw new ArgumentException("Machine ID is required.", nameof(machineId));
        if (now == default) throw new ArgumentException("Initial timestamp is required.", nameof(now));
        if (!Enum.IsDefined(status)) throw new ArgumentOutOfRangeException(nameof(status));
        ArgumentOutOfRangeException.ThrowIfNegative(totalProduced);

        return new MachineSimState
        {
            MachineId = machineId,
            ProfileVersion = profile.Version,
            LastTickAtUtc = now.ToUniversalTime(),
            MachineStatus = status,
            TotalProduced = totalProduced,
            Temperature = profile.NormalTemperature,
            PowerLoadKw = profile.IdlePowerKw,
            FaultMode = status == MachineStatus.Error ? SimulationFaultMode.Generic : SimulationFaultMode.None
        };
    }
}

public sealed record SimulationStatusChanged(Guid MachineId, DateTimeOffset OccurredAtUtc,
    MachineStatus PreviousStatus, MachineStatus NewStatus, SimulationFaultMode FaultMode,
    double Temperature, double Vibration, double PowerLoadKw);

public sealed record SimulationTickResult(MachineSimState State,
    IReadOnlyList<SimulationStatusChanged> StatusChanges, int PartsProduced);
