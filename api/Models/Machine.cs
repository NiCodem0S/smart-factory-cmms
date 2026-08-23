using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Models
{
    public class Machine
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? SerialNumber { get; set; }
        private MachineStatus _status = MachineStatus.Offline;
        public MachineStatus Status 
        { 
            get => _status; 
            set
            {
                if(_status != value)
                {
                    if ((_status == MachineStatus.Running || _status == MachineStatus.Warning) && LastStatusChangedAt.HasValue)
                    {
                        TotalOperatingHours += (DateTime.UtcNow - LastStatusChangedAt.Value).TotalHours;
                    }
                    _status = value;
                    LastStatusChangedAt = DateTime.UtcNow;
                }
            }

        }
        public DateTime InstallationDate { get; set; }
        public string? StaticProperties { get; set; } // JSON
        public bool IsActive { get; set; } = true;
        public double TotalOperatingHours { get; set; } = 0;
        public DateTime? LastStatusChangedAt { get; set; } = DateTime.UtcNow;
        
        // Production Tracking
        public string? Icon { get; set; } = "PrecisionManufacturing"; // Default icon
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
