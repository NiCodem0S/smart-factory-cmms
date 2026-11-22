using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Validation;

namespace SmartFactoryCMMS.Api.Models;

///
/// One consistent recovery point per machine, saved together with
/// Machine.TotalProduced, Machine.Status and incidents in a single SQL transaction.
///
public class SimulationCheckpoint : IValidatableObject
{
    public Guid MachineId { get; set; }
    public Machine Machine { get; set; } = null!;

    [Range(1, int.MaxValue)]
    public int SchemaVersion { get; set; } = 1;
    [Range(0, long.MaxValue)]
    public long TickNumber { get; set; }
    [Range(1, long.MaxValue)]
    public long ProfileVersion { get; set; } = 1;

    [FiniteRange(-273.15, 1000000)]
    public double Temperature { get; set; }
    [FiniteRange(0)]
    public double Vibration { get; set; }
    [FiniteRange(0)]
    public double PowerLoadKw { get; set; }
    [FiniteRange(0)]
    public double CycleProgressSeconds { get; set; }
    [FiniteRange(0, 1)]
    public double Wear { get; set; }

    public bool IsOverheating { get; set; }
    public bool IsOvervibrating { get; set; }
    [EnumDataType(typeof(SimulationFaultMode))]
    public SimulationFaultMode FaultMode { get; set; }

    [Range(0, int.MaxValue)]
    public int TotalProduced { get; set; }
    [EnumDataType(typeof(MachineStatus))]
    public MachineStatus MachineStatus { get; set; }

    public DateTimeOffset LastTickAtUtc { get; set; }
    public DateTimeOffset SavedAtUtc { get; set; }

    // SQL Server rowversion protects the recovery point against stale writes.
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (LastTickAtUtc == default || SavedAtUtc == default || SavedAtUtc < LastTickAtUtc)
        {
            yield return new ValidationResult("Checkpoint timestamps are required and save time cannot precede the last tick.",
                new[] { nameof(LastTickAtUtc), nameof(SavedAtUtc) });
        }
    }
}
