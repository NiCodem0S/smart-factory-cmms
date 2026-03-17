namespace Smart_Factory_CMMS.Models
{
    public class WorkShift
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }

        public ICollection<ProductionLog> ProductionLogs { get; set; } = new List<ProductionLog>();
    }
}
