namespace SmartFactoryCMMS.Api.DTOs
{
    public class TelemetryReadDto
    {
        public Guid Id { get; set; }
        public Guid MachineId { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? Vibration { get; set; }
        public decimal? PowerLoadKw { get; set; }
        public int? NetworkLatencyMs { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
