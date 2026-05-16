namespace SmartFactoryCMMS.Api.DTOs
{
    public class IncidentDto
    {
        public Guid Id { get; set; }
        public Guid MachineId { get; set; }
        public DateTime TriggeredAt { get; set; }
        public string Message { get; set; } = string.Empty;      // Event description
        public string Severity { get; set; } = string.Empty;     // Warning, Critical
        public string Status { get; set; } = "Active";           // Active, Resolved, Archived
    }
}
