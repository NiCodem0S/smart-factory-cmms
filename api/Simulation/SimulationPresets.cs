using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

public static class SimulationPresets
{
    ///
    /// Creates a complete independent parameter set, preserving machine baselines and its tick.
    /// The preset name never drives branches in the physics engine; only these parameters do.
    ///
    public static SimulationParameters Create(SimulationPreset preset, SimulationParameters? machineBaselines = null)
    {
        if (!Enum.IsDefined(preset) || preset == SimulationPreset.Custom)
            throw new ArgumentOutOfRangeException(nameof(preset), "Choose Stable, WearAndTear or Chaos.");
        var baseline = machineBaselines ?? new SimulationParameters();
        Validator.ValidateObject(baseline, new ValidationContext(baseline), validateAllProperties: true);

        var parameters = new SimulationParameters
        {
            TickIntervalMs = baseline.TickIntervalMs,
            AmbientTemperature = baseline.AmbientTemperature,
            NormalTemperature = baseline.NormalTemperature,
            BaseVibration = baseline.BaseVibration,
            NormalPowerKw = baseline.NormalPowerKw,
            IdlePowerKw = baseline.IdlePowerKw,
            PowerNoiseAmplitudeKw = Math.Min(1.5, baseline.NormalPowerKw * 0.1)
        };

        switch (preset)
        {
            case SimulationPreset.WearAndTear:
                parameters.TemperatureNoiseAmplitude = 1;
                parameters.TemperatureResponsePerSecond = 0.05;
                parameters.OverheatingDegreesPerSecond = 1;
                parameters.VibrationNoiseAmplitude = 0.2;
                parameters.ExcessVibrationAmplitude = 2.5;
                parameters.PowerNoiseAmplitudeKw = Math.Min(2.5, baseline.NormalPowerKw * 0.15);
                parameters.OverheatingProbabilityPerHour = 0.08;
                parameters.ExcessVibrationProbabilityPerHour = 0.12;
                parameters.FailureProbabilityPerHour = 0.03;
                parameters.WearPerHour = 0.03;
                break;
            case SimulationPreset.Chaos:
                parameters.TemperatureNoiseAmplitude = 2;
                parameters.OverheatingDegreesPerSecond = 4;
                parameters.CoolingDegreesPerSecond = 1;
                parameters.VibrationNoiseAmplitude = 0.4;
                parameters.ExcessVibrationAmplitude = 1.5;
                parameters.PowerNoiseAmplitudeKw = Math.Min(5, baseline.NormalPowerKw * 0.3);
                // Deliberate demonstration preset: these two disturbances begin on the first active step.
                parameters.OverheatingProbabilityPerHour = 1;
                parameters.ExcessVibrationProbabilityPerHour = 1;
                parameters.FailureProbabilityPerHour = 0.2;
                break;
        }

        Validator.ValidateObject(parameters, new ValidationContext(parameters), validateAllProperties: true);
        return parameters;
    }
}
