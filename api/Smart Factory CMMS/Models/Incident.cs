namespace SmartFactoryCMMS.Models
{
    public class Incident
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;
        public string Message { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty; // Warning, Critical
        public string Status { get; set; } = "Active"; // Active, Resolved, Archived

        public Machine? Machine { get; set; }
    }
}
