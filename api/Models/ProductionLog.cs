using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Api.Models
{
    public class ProductionLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public Guid ShiftId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public int GoodParts { get; set; } = 0;
        public int DefectiveParts { get; set; } = 0;
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AverageCycleTimeSeconds { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? IdealCycleTimeSeconds { get; set; }
        public int ActiveOperatingSeconds { get; set; } = 0;

        public Machine? Machine { get; set; }
        public WorkShift? Shift { get; set; }
    }
}
