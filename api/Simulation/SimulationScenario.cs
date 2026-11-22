using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

public enum SimulationScenario
{
    Normal, TemperatureWarning, Overheating, ExcessVibration, Failure
}

/// One operator-injected event. Subsequent ticks continue with the regular physics.
public static class SimulationScenarios
{
    public static SimulationTickResult Apply(MachineSimState previous, SimulationProfileSnapshot profile,
        SimulationThresholds thresholds, SimulationScenario scenario, bool producing, DateTimeOffset now)
    {
        if (!Enum.IsDefined(scenario))
        {
            throw new SimulationRequestException(400, "Unknown simulation scenario.");
        }

        if (previous.MachineStatus is not (MachineStatus.Running or MachineStatus.Warning))
        {
            throw new SimulationRequestException(409, "Scenarios require a healthy running machine. Repair an existing fault first.");
        }

        if (!producing && scenario is not (SimulationScenario.Normal or SimulationScenario.Failure))
        {
            throw new SimulationRequestException(409, "Start the production line before triggering temperature or vibration scenarios.");
        }

        if (now <= previous.LastTickAtUtc)
        {
            now = previous.LastTickAtUtc.AddTicks(1);
        }

        var state = previous with
        {
            TickNumber = checked(previous.TickNumber + 1),
            ProfileVersion = profile.Version,
            LastTickAtUtc = now.ToUniversalTime()
        };
        switch (scenario)
        {
            case SimulationScenario.Normal:
                var temperature = producing ? profile.NormalTemperature + 10 * previous.Wear : profile.AmbientTemperature;
                var vibration = producing ? profile.BaseVibration * (1 + previous.Wear) : 0;
                var power = producing ? profile.NormalPowerKw * (1 + .1 * previous.Wear) : profile.IdlePowerKw;
                if (temperature >= thresholds.Temperature.Warning || vibration >= thresholds.Vibration.Warning ||
                    thresholds.Power is { } limit && power >= limit.Warning)
                {
                    throw new SimulationRequestException(409, "Normal targets exceed a warning threshold. Adjust the profile or thresholds first.");
                }

                state = state with
                {
                    MachineStatus = MachineStatus.Running,
                    Temperature = temperature,
                    Vibration = vibration,
                    PowerLoadKw = power,
                    IsOverheating = false,
                    IsOvervibrating = false,
                    FaultMode = SimulationFaultMode.None
                };
                break;
            case SimulationScenario.TemperatureWarning:
            case SimulationScenario.Overheating:
                state = state with
                {
                    MachineStatus = MachineStatus.Warning,
                    Temperature = (thresholds.Temperature.Warning + thresholds.Temperature.Critical) / 2,
                    IsOverheating = scenario == SimulationScenario.Overheating,
                    FaultMode = SimulationFaultMode.Overheating
                };
                break;
            case SimulationScenario.ExcessVibration:
                state = state with
                {
                    MachineStatus = MachineStatus.Error,
                    Vibration = thresholds.Vibration.Critical + Math.Max(.1, Math.Abs(thresholds.Vibration.Critical) * .1),
                    FaultMode = SimulationFaultMode.ExcessVibration
                };
                break;
            case SimulationScenario.Failure:
                state = state with
                {
                    MachineStatus = MachineStatus.Error,
                    FaultMode = SimulationFaultMode.Generic
                };
                break;
        }
        if (!double.IsFinite(state.Temperature) || state.Temperature is < -273.15 or > 1000000 ||
            !double.IsFinite(state.Vibration) || state.Vibration is < 0 or > 9000000000000000)
        {
            throw new SimulationRequestException(409, "Scenario targets exceed the supported telemetry range. Adjust the alert thresholds first.");
        }
        // Retain the triggering reading in durable event history; the drive stops immediately on an error.
        var changes = state.MachineStatus == previous.MachineStatus ? Array.Empty<SimulationStatusChanged>() :
            new[] { new SimulationStatusChanged(state.MachineId, state.LastTickAtUtc, previous.MachineStatus,
                state.MachineStatus, state.FaultMode, state.Temperature, state.Vibration, state.PowerLoadKw) };
        if (state.MachineStatus == MachineStatus.Error)
        {
            state = state with
            {
                Vibration = 0,
                PowerLoadKw = profile.IdlePowerKw,
                CycleProgressSeconds = 0,
                IsOvervibrating = false
            };
        }

        return new(state, changes, 0);
    }
}
