namespace SmartFactoryCMMS.Models
{
    public class MachinePrediction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;
        public int HealthScore { get; set; } // 0-100
        public int? RemainingUsefulLifeHours { get; set; }
        public string? PredictedFailureComponent { get; set; }

        public Machine? Machine { get; set; }
    }
}
