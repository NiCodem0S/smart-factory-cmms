using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class MachineDetailDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public MachineStatus Status { get; set; } = MachineStatus.Offline;  // Running, Warning, Maintenance, Error, Offline
        public DateTime InstallationDate { get; set; }
        public string? StaticProperties { get; set; }  // JSON string with additional properties
        public bool IsActive { get; set; }
        public double TotalOperatingHours { get; set; } = 0;
        public DateTime? LastStatusChangedAt { get; set; } = DateTime.UtcNow;
        public Guid FactoryHallId { get; set; }
        public Guid? ProductionLineId { get; set; }

        // Production Tracking
        public string? Icon { get; set; } = "PrecisionManufacturing"; // Default icon
        public int TotalProduced { get; set; } 
        public double CycleTimeSeconds { get; set; }
        public int OrderInLine { get; set; }

        // Aggregated data
        public int TotalWorkOrders { get; set; }
        public int OpenWorkOrders { get; set; }
        public List<TelemetryReadDto> LatestTelemetry { get; set; } = new List<TelemetryReadDto>();  // Last 10
        public List<IncidentDto> RecentIncidents { get; set; } = new List<IncidentDto>();  // Last 5
        public List<AlertDto> ActiveAlerts { get; set; } = new List<AlertDto>();  // Active only
        public List<CreateAlertThresholdDto> AlertThresholds { get; set; } = new();
    }
}
