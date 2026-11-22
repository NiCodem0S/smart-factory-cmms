using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.DTOs;

public class SimulationProfileDto : SimulationParameters
{
    public Guid MachineId { get; set; }
    public SimulationPreset Preset { get; set; }
    public long Version { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public class UpdateSimulationProfileDto : SimulationParameters
{
    // Expected version prevents overwriting a concurrent profile edit.
    [Range(1, long.MaxValue)]
    public long Version { get; set; }
}

public class ApplySimulationPresetDto : IValidatableObject
{
    [Required]
    [EnumDataType(typeof(SimulationPreset))]
    public SimulationPreset? Preset { get; set; }

    [Range(1, long.MaxValue)]
    public long Version { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Preset == SimulationPreset.Custom)
        {
            yield return new ValidationResult("Custom is the result of manual editing, not a preset to apply.",
                new[] { nameof(Preset) });
        }
    }
}
