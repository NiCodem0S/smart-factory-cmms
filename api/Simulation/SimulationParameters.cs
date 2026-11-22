using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Validation;

namespace SmartFactoryCMMS.Api.Simulation;

///
/// Parameter contract shared by persisted profiles and profile DTOs.
/// This base class is not an EF entity. Rates are per second/hour, never per tick.
/// Alert thresholds and cycle time remain on the existing machine model.
///
public class SimulationParameters : IValidatableObject
{
    public const int MinimumTickIntervalMs = 100;
    public const int MaximumTickIntervalMs = 60000;

    [Range(MinimumTickIntervalMs, MaximumTickIntervalMs)]
    public int TickIntervalMs { get; set; } = 1000;

    /// Temperature of the surroundings in degrees Celsius.
    [FiniteRange(-273.15, 2000)]
    public double AmbientTemperature { get; set; } = 25;

    /// Nominal operating temperature in degrees Celsius.
    [FiniteRange(-273.15, 2000)]
    public double NormalTemperature { get; set; } = 60;

    /// Temperature noise amplitude in degrees Celsius.
    [FiniteRange(0, 2000)]
    public double TemperatureNoiseAmplitude { get; set; } = 0.5;

    /// Rate of return toward nominal temperature per second.
    [FiniteRange(0, 100)]
    public double TemperatureResponsePerSecond { get; set; } = 0.1;

    /// Temperature increase during overheating, in degrees Celsius per second.
    [FiniteRange(0.001, 2000)]
    public double OverheatingDegreesPerSecond { get; set; } = 2;

    /// Cooling rate after a fault, in degrees Celsius per second.
    [FiniteRange(0.001, 2000)]
    public double CoolingDegreesPerSecond { get; set; } = 0.5;

    /// Nominal vibration in mm/s.
    [FiniteRange(0, 1000000)]
    public double BaseVibration { get; set; } = 1;

    /// Vibration noise amplitude in mm/s.
    [FiniteRange(0, 1000000)]
    public double VibrationNoiseAmplitude { get; set; } = 0.1;

    /// Additional vibration during a vibration fault, in mm/s.
    [FiniteRange(0, 1000000)]
    public double ExcessVibrationAmplitude { get; set; } = 3;

    /// Nominal power consumption in kW.
    [FiniteRange(0, 1000000)]
    public double NormalPowerKw { get; set; } = 15;

    /// Power noise amplitude in kW.
    [FiniteRange(0, 1000000)]
    public double PowerNoiseAmplitudeKw { get; set; } = 1.5;

    /// Power consumption during idle operation in kW.
    [FiniteRange(0, 1000000)]
    public double IdlePowerKw { get; set; } = 0.1;

    /// Probability of beginning overheating within one hour.
    [FiniteRange(0, 1)]
    public double OverheatingProbabilityPerHour { get; set; } = 0.01;

    /// Probability of beginning excessive vibration within one hour.
    [FiniteRange(0, 1)]
    public double ExcessVibrationProbabilityPerHour { get; set; } = 0.01;

    /// Probability of an independent failure within one hour.
    [FiniteRange(0, 1)]
    public double FailureProbabilityPerHour { get; set; } = 0.002;

    /// Increase of normalized wear per hour; wear is between zero and one.
    [FiniteRange(0, 1)]
    public double WearPerHour { get; set; } = 0;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (IdlePowerKw > NormalPowerKw)
        {
            yield return new ValidationResult(
                "Idle power cannot exceed nominal operating power.",
                new[] { nameof(IdlePowerKw), nameof(NormalPowerKw) });
        }
    }
}
