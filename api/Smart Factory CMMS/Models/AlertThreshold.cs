using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Models
{
    public class AlertThreshold
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public string MetricType { get; set; } = string.Empty; // Temperature, Vibration, Ping, PacketLoss

        [Column(TypeName = "decimal(18,2)")]
        public decimal WarningValue { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal CriticalValue { get; set; }

        public Machine? Machine { get; set; }
    }
}
