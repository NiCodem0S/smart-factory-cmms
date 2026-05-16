namespace SmartFactoryCMMS.Api.DTOs
{
    public class AlertDto
    {
        public Guid Id { get; set; }
        public Guid MachineId { get; set; }
        public string Severity { get; set; } = string.Empty;  // Critical, Warning, Info
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool Acknowledged { get; set; }
    }
}
