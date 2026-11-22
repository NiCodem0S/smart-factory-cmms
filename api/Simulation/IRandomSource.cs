namespace SmartFactoryCMMS.Api.Simulation;

/// Returns a value in [0, 1). Give each worker its own source; tests may provide a fixed seed.
public interface IRandomSource
{
    double NextDouble();
}

public sealed class SystemRandomSource : IRandomSource
{
    private readonly Random _random;

    public SystemRandomSource(int? seed = null)
    {
        _random = seed.HasValue ? new Random(seed.Value) : new Random();
    }

    public double NextDouble() => _random.NextDouble();
}
