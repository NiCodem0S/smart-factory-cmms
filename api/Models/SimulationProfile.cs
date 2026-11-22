using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Models;

public class SimulationProfile : SimulationParameters
{
    public Guid MachineId { get; set; }
    public Machine Machine { get; set; } = null!;

    [EnumDataType(typeof(SimulationPreset))]
    public SimulationPreset Preset { get; set; } = SimulationPreset.Stable;

    [Range(1, long.MaxValue)]
    public long Version { get; set; } = 1;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
