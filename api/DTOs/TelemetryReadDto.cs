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
        private DateTime _timestamp;
        // SQL datetime2 loses Kind; telemetry timestamps are stored in UTC.
        public DateTime Timestamp
        {
            get => _timestamp;
            set => _timestamp = value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();
        }
    }
}
