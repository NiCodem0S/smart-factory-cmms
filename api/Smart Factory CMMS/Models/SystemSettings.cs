namespace Smart_Factory_CMMS.Models
{
    public class SystemSettings
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string SiteName { get; set; } = "Smart Factory Plant";
        public string Timezone { get; set; } = "UTC";
        public string Currency { get; set; } = "PLN";
        public decimal PeakPowerLimitMw { get; set; } = 1.0m;
        public string? SlackWebhookUrl { get; set; }
        public int RawTelemetryRetentionDays { get; set; } = 30;
        public bool EnableEmailAlerts { get; set; } = true;
    }
}
