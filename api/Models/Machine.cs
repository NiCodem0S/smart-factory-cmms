namespace SmartFactoryCMMS.Api.Models
{
    public class Machine
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? SerialNumber { get; set; }
        public string Status { get; set; } = "Offline";
        public DateTime InstallationDate { get; set; }
        public string? StaticProperties { get; set; } // JSON
        public bool IsActive { get; set; } = true;

        // Relacje
        public ICollection<TelemetryRead> TelemetryReads { get; set; } = new List<TelemetryRead>();
        public ICollection<Incident> Incidents { get; set; } = new List<Incident>();
        public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
    }
}
