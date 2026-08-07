using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Models
{
    public class Machine
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? SerialNumber { get; set; }
        public MachineStatus Status { get; set; } = MachineStatus.Offline;
        public DateTime InstallationDate { get; set; }
        public string? StaticProperties { get; set; } // JSON
        public bool IsActive { get; set; } = true;
        public double TotalOperatingHours { get; set; } = 0;
        public DateTime? LastStatusChangedAt { get; set; } = DateTime.UtcNow;
        
        // Production Tracking
        public string? Icon { get; set; } = "fa-cogs"; // Default icon
        public int TotalProduced { get; set; } = 0;
        public double CycleTimeSeconds { get; set; } = 5.0; // Simulated time to produce one part
        public int OrderInLine { get; set; } = 0;

        // Relacje
        public Guid FactoryHallId { get; set; }
        public FactoryHall FactoryHall { get; set; } = null!;

        public Guid? ProductionLineId { get; set; }
        public ProductionLine? ProductionLine { get; set; }
        
        public ICollection<TelemetryRead> TelemetryReads { get; set; } = new List<TelemetryRead>();
        public ICollection<Incident> Incidents { get; set; } = new List<Incident>();
        public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
        public ICollection<AlertThreshold> AlertThresholds { get; set; } = new List<AlertThreshold>();
    }
}
