using System;

namespace Smart_Factory_CMMS.Models
{
    public class TelemetryRead
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public decimal? Temperature { get; set; }
        public decimal? Vibration { get; set; }
        public int? NetworkLatencyMs { get; set; }
        public decimal? PowerLoadKw { get; set; }
        public string? AdditionalMetrics { get; set; } // JSON

        public Machine? Machine { get; set; }
    }
}