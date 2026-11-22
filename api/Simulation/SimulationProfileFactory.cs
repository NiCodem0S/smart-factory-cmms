using System.Text.Json;
using System.Text.Json.Nodes;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Simulation;

public static class SimulationProfileFactory
{
    /// The profile owns nominal targets; legacy JSON remains compatible and keeps custom metadata.
    public static void SynchronizeNominalProperties(Machine machine)
    {
        if (machine.SimulationProfile is not { } profile) return;
        JsonObject properties;
        try { properties = JsonNode.Parse(machine.StaticProperties ?? "{}") as JsonObject ?? new(); }
        catch (JsonException) { properties = new(); }
        properties["NormTemp"] = profile.NormalTemperature;
        properties["BaseVib"] = profile.BaseVibration;
        properties["NormPower"] = profile.NormalPowerKw;
        machine.StaticProperties = properties.ToJsonString();
    }

    /// Preserves valid legacy baselines; invalid/missing values use Stable defaults.
    public static SimulationProfile CreateStable(Machine machine, int tickIntervalMs)
    {
        var profile = new SimulationProfile
        {
            MachineId = machine.Id,
            TickIntervalMs = tickIntervalMs
        };

        if (!string.IsNullOrWhiteSpace(machine.StaticProperties))
        {
            try
            {
                using var document = JsonDocument.Parse(machine.StaticProperties);
                if (document.RootElement.ValueKind == JsonValueKind.Object)
                {
                    profile.NormalTemperature = ReadNumber(document.RootElement, "NormTemp", profile.NormalTemperature, -273.15, 2000);
                    profile.BaseVibration = ReadNumber(document.RootElement, "BaseVib", profile.BaseVibration, 0, 1000000);
                    profile.NormalPowerKw = ReadNumber(document.RootElement, "NormPower", profile.NormalPowerKw, 0, 1000000);
                }
            }
            catch (JsonException)
            {
                // Legacy JSON is optional. Never rewrite it while creating the new profile.
            }
        }

        profile.IdlePowerKw = Math.Min(profile.IdlePowerKw, profile.NormalPowerKw);
        // Keep the Stable noise proportional for machines with a small nominal power.
        profile.PowerNoiseAmplitudeKw = Math.Min(profile.PowerNoiseAmplitudeKw, profile.NormalPowerKw * 0.1);
        return profile;
    }

    private static double ReadNumber(JsonElement json, string key, double fallback, double minimum, double maximum) =>
        json.TryGetProperty(key, out var property) &&
        property.ValueKind == JsonValueKind.Number &&
        property.TryGetDouble(out var value) && double.IsFinite(value) &&
        value >= minimum && value <= maximum ? value : fallback;
}
