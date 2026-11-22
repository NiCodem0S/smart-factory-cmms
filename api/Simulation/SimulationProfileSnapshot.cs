using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.Simulation;

/// A validated, immutable copy of a profile. Contains no EF entities or navigation properties.
public sealed record SimulationProfileSnapshot
{
    private SimulationProfileSnapshot() { }

    public long Version { get; private init; }
    public int TickIntervalMs { get; private init; }
    public double AmbientTemperature { get; private init; }
    public double NormalTemperature { get; private init; }
    public double TemperatureNoiseAmplitude { get; private init; }
    public double TemperatureResponsePerSecond { get; private init; }
    public double OverheatingDegreesPerSecond { get; private init; }
    public double CoolingDegreesPerSecond { get; private init; }
    public double BaseVibration { get; private init; }
    public double VibrationNoiseAmplitude { get; private init; }
    public double ExcessVibrationAmplitude { get; private init; }
    public double NormalPowerKw { get; private init; }
    public double PowerNoiseAmplitudeKw { get; private init; }
    public double IdlePowerKw { get; private init; }
    public double OverheatingProbabilityPerHour { get; private init; }
    public double ExcessVibrationProbabilityPerHour { get; private init; }
    public double FailureProbabilityPerHour { get; private init; }
    public double WearPerHour { get; private init; }

    public static SimulationProfileSnapshot FromParameters(SimulationParameters parameters, long version)
    {
        ArgumentNullException.ThrowIfNull(parameters);
        ArgumentOutOfRangeException.ThrowIfLessThan(version, 1);
        Validator.ValidateObject(parameters, new ValidationContext(parameters), validateAllProperties: true);

        return new SimulationProfileSnapshot
        {
            Version = version,
            TickIntervalMs = parameters.TickIntervalMs,
            AmbientTemperature = parameters.AmbientTemperature,
            NormalTemperature = parameters.NormalTemperature,
            TemperatureNoiseAmplitude = parameters.TemperatureNoiseAmplitude,
            TemperatureResponsePerSecond = parameters.TemperatureResponsePerSecond,
            OverheatingDegreesPerSecond = parameters.OverheatingDegreesPerSecond,
            CoolingDegreesPerSecond = parameters.CoolingDegreesPerSecond,
            BaseVibration = parameters.BaseVibration,
            VibrationNoiseAmplitude = parameters.VibrationNoiseAmplitude,
            ExcessVibrationAmplitude = parameters.ExcessVibrationAmplitude,
            NormalPowerKw = parameters.NormalPowerKw,
            PowerNoiseAmplitudeKw = parameters.PowerNoiseAmplitudeKw,
            IdlePowerKw = parameters.IdlePowerKw,
            OverheatingProbabilityPerHour = parameters.OverheatingProbabilityPerHour,
            ExcessVibrationProbabilityPerHour = parameters.ExcessVibrationProbabilityPerHour,
            FailureProbabilityPerHour = parameters.FailureProbabilityPerHour,
            WearPerHour = parameters.WearPerHour,
        };
    }
}
