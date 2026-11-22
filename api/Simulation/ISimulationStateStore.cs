namespace SmartFactoryCMMS.Api.Simulation;

public interface ISimulationStateStore
{
    Task<bool> IsAvailableAsync(CancellationToken ct = default);
    Task<MachineSimState?> ReadAsync(Guid machineId, CancellationToken ct = default);
    Task WriteAsync(MachineSimState state, CancellationToken ct = default);
    Task DeleteAsync(Guid machineId, CancellationToken ct = default);
}
