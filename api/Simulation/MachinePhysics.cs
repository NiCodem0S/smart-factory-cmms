using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Simulation;

// Advances the previous snapshot using elapsed time, the active profile and the supplied random source.
public sealed class MachinePhysics
{
    // Numerical resolution, not a worker scheduling interval. It bounds threshold-crossing/part loss error.
    public static readonly TimeSpan IntegrationStep = TimeSpan.FromMilliseconds(100);
    public static readonly TimeSpan MaximumStepDuration = TimeSpan.FromMinutes(5);
    private const double MaximumWearHazardMultiplier = 5;
    private const double MaximumWearTemperatureIncrease = 10;
    private const double MaximumWearPowerIncrease = 0.1;

    public SimulationTickResult Step(MachineSimState previous, SimulationProfileSnapshot profile,
        SimulationStepContext context, DateTimeOffset now, IRandomSource random)
    {
        ArgumentNullException.ThrowIfNull(previous);
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(random);
        ValidateState(previous);
        if (context.OperationalStatus is MachineStatus.Offline or MachineStatus.Maintenance)
        {
            throw new InvalidOperationException("Offline and Maintenance machines cannot execute simulation ticks.");
        }

        if (profile.Version < previous.ProfileVersion)
        {
            throw new ArgumentException("An older profile cannot replace the state's current profile.", nameof(profile));
        }

        now = now.ToUniversalTime();
        var elapsed = now - previous.LastTickAtUtc;
        if (elapsed <= TimeSpan.Zero || elapsed > MaximumStepDuration)
        {
            throw new ArgumentOutOfRangeException(nameof(now),
                        "Elapsed time must be positive and no longer than five minutes. Rebase the clock after a restart.");
        }

        var temperature = previous.Temperature;
        var vibration = previous.Vibration;
        var power = previous.PowerLoadKw;
        var progress = previous.CycleProgressSeconds;
        var wear = previous.Wear;
        var totalProduced = previous.TotalProduced;
        var overheating = previous.IsOverheating;
        var overvibrating = previous.IsOvervibrating;
        var fault = previous.FaultMode;
        // Error remains latched even if a caller supplies Running after a profile change.
        var status = previous.MachineStatus == MachineStatus.Error || context.OperationalStatus == MachineStatus.Error
            ? MachineStatus.Error
            : previous.MachineStatus == MachineStatus.Warning ? MachineStatus.Warning : context.OperationalStatus;
        var transitions = new List<SimulationStatusChanged>();
        var timestamp = previous.LastTickAtUtc.ToUniversalTime();
        var remaining = elapsed.Ticks;

        while (remaining > 0)
        {
            var stepTicks = Math.Min(IntegrationStep.Ticks, remaining);
            var duration = TimeSpan.FromTicks(stepTicks);
            var priorStatus = status;

            // A new threshold/profile may make the existing state critical before the next integration.
            if (status != MachineStatus.Error && Classify(temperature, vibration, power, context.Thresholds) == MachineStatus.Error)
            {
                status = MachineStatus.Error;
                fault = CriticalCause(temperature, vibration, context.Thresholds);
                RecordTransition(priorStatus, status, timestamp);
                priorStatus = status;
            }

            if (status == MachineStatus.Error)
            {
                if (fault == SimulationFaultMode.None)
                {
                    fault = SimulationFaultMode.Generic;
                }

                CoolDown(duration.TotalSeconds);
            }
            else if (!context.ProductionAllowed)
            {
                // Halted line: keep the worker alive, preserve partial progress and simulate idle operation.
                CoolDown(duration.TotalSeconds);
                status = Classify(temperature, vibration, power, context.Thresholds);
                fault = CurrentFault();
            }
            else
            {
                AdvanceProduction(duration);
            }

            timestamp = timestamp.AddTicks(stepTicks);
            RecordTransition(priorStatus, status, timestamp);
            if (status == MachineStatus.Error)
            {
                progress = 0;
                // The transition retains the triggering reading. Discard the unfinished part and stop the drive.
                vibration = 0;
                power = profile.IdlePowerKw;
                overvibrating = false;
            }
            remaining -= stepTicks;
        }

        var state = previous with
        {
            TickNumber = checked(previous.TickNumber + 1),
            ProfileVersion = profile.Version,
            LastTickAtUtc = now,
            MachineStatus = status,
            Temperature = temperature,
            Vibration = vibration,
            PowerLoadKw = power,
            CycleProgressSeconds = progress,
            TotalProduced = totalProduced,
            Wear = wear,
            IsOverheating = overheating,
            IsOvervibrating = overvibrating,
            FaultMode = fault
        };
        return new SimulationTickResult(state, transitions.AsReadOnly(), totalProduced - previous.TotalProduced);

        void AdvanceProduction(TimeSpan duration)
        {
            var seconds = duration.TotalSeconds;
            wear = Math.Clamp(wear + profile.WearPerHour * duration.TotalHours, 0, 1);
            var hazardMultiplier = 1 + (MaximumWearHazardMultiplier - 1) * wear;
            if (!overheating && Occurs(profile.OverheatingProbabilityPerHour, duration, hazardMultiplier, random))
            {
                overheating = true;
            }

            if (!overvibrating && Occurs(profile.ExcessVibrationProbabilityPerHour, duration, hazardMultiplier, random))
            {
                overvibrating = true;
            }

            if (Occurs(profile.FailureProbabilityPerHour, duration, hazardMultiplier, random))
            {
                status = MachineStatus.Error;
                fault = SimulationFaultMode.Generic;
                CoolDown(seconds);
                return;
            }

            var targetTemperature = profile.NormalTemperature + MaximumWearTemperatureIncrease * wear
                + SignedNoise(random) * profile.TemperatureNoiseAmplitude;
            temperature = overheating
                ? temperature + profile.OverheatingDegreesPerSecond * seconds
                : targetTemperature + (temperature - targetTemperature) * Math.Exp(-profile.TemperatureResponsePerSecond * seconds);
            temperature = Math.Clamp(temperature, -273.15, 1000000);
            vibration = Math.Max(0, profile.BaseVibration * (1 + wear)
                + SignedNoise(random) * profile.VibrationNoiseAmplitude
                + (overvibrating ? profile.ExcessVibrationAmplitude : 0));
            power = Math.Max(0, profile.NormalPowerKw * (1 + MaximumWearPowerIncrease * wear)
                + SignedNoise(random) * profile.PowerNoiseAmplitudeKw);
            status = Classify(temperature, vibration, power, context.Thresholds);
            fault = CurrentFault();

            if (status != MachineStatus.Error)
            {
                progress += seconds;
                // Floating point accumulation must not lose a completed part at e.g. 4.999999999999 s.
                var completed = checked((int)Math.Floor(progress / context.CycleTimeSeconds + 1e-9));
                totalProduced = checked(totalProduced + completed);
                progress = Math.Max(0, progress - completed * context.CycleTimeSeconds);
            }
        }

        void CoolDown(double seconds)
        {
            temperature = MoveTowards(temperature, profile.AmbientTemperature, profile.CoolingDegreesPerSecond * seconds);
            vibration = 0;
            power = profile.IdlePowerKw;
            overvibrating = false;
            if (temperature < context.Thresholds.Temperature.Warning)
            {
                overheating = false;
            }
        }

        SimulationFaultMode CurrentFault()
        {
            if (status == MachineStatus.Error)
            {
                return CriticalCause(temperature, vibration, context.Thresholds);
            }

            if (overheating)
            {
                return SimulationFaultMode.Overheating;
            }

            return overvibrating ? SimulationFaultMode.ExcessVibration : SimulationFaultMode.None;
        }

        void RecordTransition(MachineStatus from, MachineStatus to, DateTimeOffset at)
        {
            if (from != to)
            {
                transitions.Add(new SimulationStatusChanged(previous.MachineId, at, from, to, fault, temperature, vibration, power));
            }
        }
    }

    private static MachineStatus Classify(double temperature, double vibration, double power, SimulationThresholds thresholds)
    {
        if (temperature >= thresholds.Temperature.Critical || vibration >= thresholds.Vibration.Critical ||
            (thresholds.Power is { } criticalPower && power >= criticalPower.Critical))
        {
            return MachineStatus.Error;
        }

        if (temperature >= thresholds.Temperature.Warning || vibration >= thresholds.Vibration.Warning ||
            (thresholds.Power is { } warningPower && power >= warningPower.Warning))
        {
            return MachineStatus.Warning;
        }

        return MachineStatus.Running;
    }

    private static SimulationFaultMode CriticalCause(double temperature, double vibration, SimulationThresholds thresholds) =>
        temperature >= thresholds.Temperature.Critical ? SimulationFaultMode.Overheating :
        vibration >= thresholds.Vibration.Critical ? SimulationFaultMode.ExcessVibration : SimulationFaultMode.Generic;

    private static double MoveTowards(double value, double target, double maximumChange) =>
        value < target ? Math.Min(value + maximumChange, target) : Math.Max(value - maximumChange, target);

    private static bool Occurs(double hourlyProbability, TimeSpan elapsed, double multiplier, IRandomSource random)
    {
        var probability = SimulationProbability.ForElapsed(hourlyProbability, elapsed, multiplier);
        return probability >= 1 || (probability > 0 && NextUnit(random) < probability);
    }

    private static double SignedNoise(IRandomSource random) => 2 * NextUnit(random) - 1;

    private static double NextUnit(IRandomSource random)
    {
        var value = random.NextDouble();
        if (!double.IsFinite(value) || value < 0 || value >= 1)
        {
            throw new InvalidOperationException("Random source must return a finite value in [0, 1).");
        }

        return value;
    }

    private static void ValidateState(MachineSimState state)
    {
        if (state.SchemaVersion != MachineSimState.CurrentSchemaVersion)
        {
            throw new NotSupportedException("Unsupported simulation state schema version.");
        }

        if (state.MachineId == Guid.Empty || state.TickNumber < 0 || state.ProfileVersion < 1 || state.LastTickAtUtc == default ||
                    state.TotalProduced < 0 || !Enum.IsDefined(state.MachineStatus) || !Enum.IsDefined(state.FaultMode) ||
                    !Finite(state.Temperature, -273.15, 1000000) || !Finite(state.Vibration, 0) || !Finite(state.PowerLoadKw, 0) ||
                    !Finite(state.CycleProgressSeconds, 0) || !Finite(state.Wear, 0, 1))
        {
            throw new ArgumentException("Invalid simulation state.", nameof(state));
        }
    }

    private static bool Finite(double value, double minimum, double maximum = double.MaxValue) =>
        double.IsFinite(value) && value >= minimum && value <= maximum;
}
