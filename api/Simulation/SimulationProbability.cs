namespace SmartFactoryCMMS.Api.Simulation;

public static class SimulationProbability
{
    /// Converts an hourly probability using constant hazard over the actual elapsed time.
    public static double ForElapsed(double hourlyProbability, TimeSpan elapsed, double hazardMultiplier = 1)
    {
        if (!double.IsFinite(hourlyProbability) || hourlyProbability < 0 || hourlyProbability > 1)
            throw new ArgumentOutOfRangeException(nameof(hourlyProbability));
        if (elapsed < TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(elapsed));
        if (!double.IsFinite(hazardMultiplier) || hazardMultiplier < 0)
            throw new ArgumentOutOfRangeException(nameof(hazardMultiplier));
        if (elapsed == TimeSpan.Zero || hourlyProbability == 0 || hazardMultiplier == 0)
            return 0;
        if (hourlyProbability == 1)
            return 1;

        return 1 - Math.Pow(1 - hourlyProbability, elapsed.TotalHours * hazardMultiplier);
    }
}
