namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateAlertThresholdDto
    {
        public string MetricType { get; set; } = string.Empty;
        public decimal WarningValue { get; set; }
        public decimal CriticalValue { get; set; }
    }
}
