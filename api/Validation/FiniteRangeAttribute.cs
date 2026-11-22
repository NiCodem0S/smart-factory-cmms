using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.Validation;

/// Unlike a plain numeric range, rejects NaN and infinity explicitly.
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class FiniteRangeAttribute : ValidationAttribute
{
    public double Minimum { get; }
    public double Maximum { get; }

    public FiniteRangeAttribute(double minimum, double maximum = double.MaxValue)
    {
        Minimum = minimum;
        Maximum = maximum;
    }

    public override bool IsValid(object? value) =>
        value is double number && double.IsFinite(number) && number >= Minimum && number <= Maximum;

    public override string FormatErrorMessage(string name) =>
        $"{name} must be finite and between {Minimum} and {Maximum}.";
}
