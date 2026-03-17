using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Api.Models
{
    public class TelemetryRead
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Temperature { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? Vibration { get; set; }
        public int? NetworkLatencyMs { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PowerLoadKw { get; set; }
        public string? AdditionalMetrics { get; set; } // JSON

        public Machine? Machine { get; set; }
    }
}