using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateAlertThresholdDto : IValidatableObject
    {
        [Required]
        [MaxLength(50)]
        public string MetricType { get; set; } = string.Empty;
        public decimal WarningValue { get; set; }
        public decimal CriticalValue { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (WarningValue >= CriticalValue)
            {
                yield return new ValidationResult("Warning threshold must be lower than the critical threshold.",
                    new[] { nameof(WarningValue), nameof(CriticalValue) });
            }
        }
    }
}
