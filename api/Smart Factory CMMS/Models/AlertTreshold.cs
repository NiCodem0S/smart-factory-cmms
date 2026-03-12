namespace Smart_Factory_CMMS.Models
{
    public class AlertTreshold
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid MachineId { get; set; }
        public string MetricType { get; set; } = string.Empty; // Temperature, Vibration, Ping, PacketLoss
        public decimal WarningValue { get; set; }
        public decimal CriticalValue { get; set; }

        public Machine? Machine { get; set; }
    }
}
