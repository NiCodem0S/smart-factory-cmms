using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Configuration;

public class SimulationOptions : IValidatableObject
{
    public const string SectionName = "Simulation";

    [Range(SimulationParameters.MinimumTickIntervalMs, SimulationParameters.MaximumTickIntervalMs)]
    public int DefaultTickIntervalMs { get; set; } = 1000;

    [Range(1, 86400)]
    public int LivePublishIntervalSeconds { get; set; } = 1;
    [Range(1, 86400)]
    public int HistorySampleIntervalSeconds { get; set; } = 5;
    [Range(1, 86400)]
    public int CheckpointIntervalSeconds { get; set; } = 5;
    [Range(1, 86400)]
    public int ReconcileIntervalSeconds { get; set; } = 5;
    [Range(1, 8760)]
    public int TelemetryCleanupIntervalHours { get; set; } = 24;
    [Range(1, 100000)]
    public int TelemetryCleanupBatchSize { get; set; } = 5000;
    [Range(1, 10000)]
    public int HistoryBatchSize { get; set; } = 100;

    public bool AutomationEnabled { get; set; }
    [Range(1, 3600)]
    public int AutomationIntervalSeconds { get; set; } = 2;
    [Range(0, 86400)]
    public int AutomaticRepairMinSeconds { get; set; } = 90;
    [Range(0, 86400)]
    public int AutomaticRepairMaxSeconds { get; set; } = 240;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (AutomaticRepairMaxSeconds < AutomaticRepairMinSeconds)
            yield return new ValidationResult("Maximum repair delay cannot be shorter than the minimum.",
                new[] { nameof(AutomaticRepairMinSeconds), nameof(AutomaticRepairMaxSeconds) });
    }
}
