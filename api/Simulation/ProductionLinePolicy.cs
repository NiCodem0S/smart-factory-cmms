using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

public static class ProductionLinePolicy
{
    public const string Running = "Running";
    public const string Warning = "Warning";
    public const string Halted = "Halted";

    public static bool IsProducing(string status) => status is Running or Warning;
    public static bool CanProduce(MachineStatus status) => status is MachineStatus.Running or MachineStatus.Warning;

    public static string Evaluate(string currentStatus, IReadOnlyCollection<(MachineStatus Status, bool WorkerRunning)> machines)
    {
        if (!IsProducing(currentStatus))
        {
            return currentStatus; // Recovery never starts a halted line.
        }

        if (machines.Count == 0 || machines.Any(m => !CanProduce(m.Status) || !m.WorkerRunning))
        {
            return Halted;
        }

        return machines.Any(m => m.Status == MachineStatus.Warning) ? Warning : Running;
    }
}
