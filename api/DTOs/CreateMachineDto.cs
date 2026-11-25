using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Validation;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateMachineDto
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(127)]
        public string Category { get; set; } = string.Empty;

        [StringLength(127)]
        public string SerialNumber { get; set; } = string.Empty;

        [Required]
        public MachineStatus Status { get; set; } = MachineStatus.Offline;

        [FiniteRange(0.001)]
        public double CycleTimeSeconds { get; set; } = 5.0;
        
        public int OrderInLine { get; set; } = 0;

        public string? Icon { get; set; } = "PrecisionManufacturing";
        
        [Required]
        public Guid FactoryHallId { get; set; }

        public Guid? ProductionLineId { get; set; }

        [FiniteRange(-273.15, 2000)]
        public double NormTemp { get; set; } = 60.0;
        
        [FiniteRange(0, 1000000)]
        public double BaseVib { get; set; } = 1.0;
        
        [FiniteRange(0, 1000000)]
        public double NormPower { get; set; } = 15.0;

        public TelemetrySource TelemetrySource { get; set; } = TelemetrySource.Simulated;

        [StringLength(127)]
        public string? ExternalDeviceId { get; set; }

        [Range(1, 86400)]
        public int ExpectedIntervalSeconds { get; set; } = 5;

        [Range(5, 86400)]
        public int OfflineTimeoutSeconds { get; set; } = 30;

        public List<string>? SupportedMetrics { get; set; }

        public List<CreateAlertThresholdDto> AlertThresholds { get; set; } = new();
    }
}
