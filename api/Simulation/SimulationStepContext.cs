using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

public sealed record MetricThreshold
{
    public double Warning { get; }
    public double Critical { get; }

    public MetricThreshold(double warning, double critical)
    {
        if (!double.IsFinite(warning) || !double.IsFinite(critical) || warning >= critical)
            throw new ArgumentException("Thresholds must be finite and warning must be lower than critical.");
        Warning = warning;
        Critical = critical;
    }
}

public sealed record SimulationThresholds
{
    public MetricThreshold Temperature { get; }
    public MetricThreshold Vibration { get; }
    public MetricThreshold? Power { get; }

    public SimulationThresholds(MetricThreshold temperature, MetricThreshold vibration, MetricThreshold? power = null)
    {
        ArgumentNullException.ThrowIfNull(temperature);
        ArgumentNullException.ThrowIfNull(vibration);
        Temperature = temperature;
        Vibration = vibration;
        Power = power;
    }

    // Used only when the machine has no explicit thresholds for a metric.
    public static SimulationThresholds Defaults(SimulationProfileSnapshot profile) => new(
        new MetricThreshold(profile.NormalTemperature + 15, profile.NormalTemperature + 30),
        new MetricThreshold(profile.BaseVibration + 2, profile.BaseVibration + 4));
}

///
/// Input from the application layer. ProductionAllowed will account for worker/line availability;
/// the physics module never queries those services itself.
///
public sealed record SimulationStepContext
{
    public MachineStatus OperationalStatus { get; }
    public bool ProductionAllowed { get; }
    public double CycleTimeSeconds { get; }
    public SimulationThresholds Thresholds { get; }

    public SimulationStepContext(MachineStatus operationalStatus, bool productionAllowed,
        double cycleTimeSeconds, SimulationThresholds thresholds)
    {
        if (!Enum.IsDefined(operationalStatus))
            throw new ArgumentOutOfRangeException(nameof(operationalStatus));
        if (!double.IsFinite(cycleTimeSeconds) || cycleTimeSeconds < 0.001)
            throw new ArgumentOutOfRangeException(nameof(cycleTimeSeconds));
        ArgumentNullException.ThrowIfNull(thresholds);
        OperationalStatus = operationalStatus;
        ProductionAllowed = productionAllowed;
        CycleTimeSeconds = cycleTimeSeconds;
        Thresholds = thresholds;
    }
}
