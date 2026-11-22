using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Simulation;
using Xunit;
using Xunit.Abstractions;

namespace SmartFactoryCMMS.Api.Tests;

public class MachinePhysicsTests
{
    private static readonly DateTimeOffset Epoch = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid MachineId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private readonly MachinePhysics _physics = new();
    private readonly ITestOutputHelper _output;

    public MachinePhysicsTests(ITestOutputHelper output) => _output = output;

    private static SimulationParameters QuietParameters() => new()
    {
        TemperatureNoiseAmplitude = 0,
        VibrationNoiseAmplitude = 0,
        PowerNoiseAmplitudeKw = 0,
        OverheatingProbabilityPerHour = 0,
        ExcessVibrationProbabilityPerHour = 0,
        FailureProbabilityPerHour = 0
    };

    private static SimulationProfileSnapshot Snapshot(SimulationParameters? parameters = null, long version = 1) =>
        SimulationProfileSnapshot.FromParameters(parameters ?? QuietParameters(), version);

    private static MachineSimState Initial(SimulationProfileSnapshot profile) =>
        MachineSimState.CreateInitial(MachineId, profile, Epoch);

    private static SimulationStepContext Context(SimulationProfileSnapshot profile, MachineStatus status = MachineStatus.Running,
        bool production = true, double cycleSeconds = 5, SimulationThresholds? thresholds = null) =>
        new(status, production, cycleSeconds, thresholds ?? SimulationThresholds.Defaults(profile));

    private (MachineSimState State, List<SimulationStatusChanged> Events) Run(
        SimulationProfileSnapshot profile, TimeSpan interval, TimeSpan total, int seed = 123)
    {
        var random = new SystemRandomSource(seed);
        var state = Initial(profile);
        var events = new List<SimulationStatusChanged>();
        var remaining = total.Ticks;
        while (remaining > 0)
        {
            var duration = TimeSpan.FromTicks(Math.Min(interval.Ticks, remaining));
            var result = _physics.Step(state, profile, Context(profile, state.MachineStatus), state.LastTickAtUtc + duration, random);
            state = result.State;
            events.AddRange(result.StatusChanges);
            remaining -= duration.Ticks;
        }
        return (state, events);
    }

    [Theory]
    [InlineData(SimulationPreset.Stable, 1000)]
    [InlineData(SimulationPreset.Stable, 5000)]
    [InlineData(SimulationPreset.Stable, 60000)]
    [InlineData(SimulationPreset.WearAndTear, 1000)]
    [InlineData(SimulationPreset.WearAndTear, 5000)]
    [InlineData(SimulationPreset.WearAndTear, 60000)]
    [InlineData(SimulationPreset.Chaos, 1000)]
    [InlineData(SimulationPreset.Chaos, 5000)]
    [InlineData(SimulationPreset.Chaos, 60000)]
    public void DifferentTickIntervalsGiveSameTrajectoryForSameElapsedTimeAndSeed(SimulationPreset preset, int intervalMs)
    {
        var parameters = SimulationPresets.Create(preset);
        parameters.TickIntervalMs = 100;
        var reference = Run(Snapshot(parameters), TimeSpan.FromMilliseconds(100), TimeSpan.FromMinutes(1));
        parameters.TickIntervalMs = intervalMs;
        var other = Run(Snapshot(parameters), TimeSpan.FromMilliseconds(intervalMs), TimeSpan.FromMinutes(1));

        // TickNumber counts outer calls; all physical state and transition timestamps must agree.
        Assert.Equal(reference.State with { TickNumber = 0 }, other.State with { TickNumber = 0 });
        Assert.Equal(reference.Events, other.Events);
    }

    [Theory]
    [InlineData(0.1)]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(60)]
    public void HourlyFailureProbabilityDoesNotDependOnNumberOfTicks(double seconds)
    {
        var probability = SimulationProbability.ForElapsed(0.1, TimeSpan.FromSeconds(seconds));
        var cumulative = 1 - Math.Pow(1 - probability, 3600 / seconds);
        Assert.Equal(0.1, cumulative, 9);
    }

    [Fact]
    public void ProbabilityHandlesZeroCertaintyWearMultiplierAndInvalidValues()
    {
        Assert.Equal(0, SimulationProbability.ForElapsed(0, TimeSpan.FromSeconds(1)));
        Assert.Equal(0, SimulationProbability.ForElapsed(1, TimeSpan.Zero));
        Assert.Equal(1, SimulationProbability.ForElapsed(1, TimeSpan.FromMilliseconds(100)));
        Assert.Equal(1 - Math.Pow(0.9, 5), SimulationProbability.ForElapsed(0.1, TimeSpan.FromHours(1), 5));
        Assert.Throws<ArgumentOutOfRangeException>(() => SimulationProbability.ForElapsed(double.NaN, TimeSpan.FromSeconds(1)));
        Assert.Throws<ArgumentOutOfRangeException>(() => SimulationProbability.ForElapsed(1.1, TimeSpan.FromSeconds(1)));
    }

    [Fact]
    public void ProductionUsesActualTimeAndDoesNotMutatePreviousSnapshot()
    {
        var profile = Snapshot();
        var previous = Initial(profile);
        var result = _physics.Step(previous, profile, Context(profile, cycleSeconds: 1), Epoch.AddSeconds(2.5), new ConstantRandom());
        Assert.Equal(2, result.PartsProduced);
        Assert.Equal(2, result.State.TotalProduced);
        Assert.Equal(0.5, result.State.CycleProgressSeconds, 9);
        Assert.Equal(0, previous.TotalProduced);
        Assert.Equal(0, previous.TickNumber);
        Assert.Equal(Epoch, previous.LastTickAtUtc);
    }

    [Fact]
    public void IdleMachineCoolsWithoutProducingWearingOrDiscardingPartialProgress()
    {
        var parameters = QuietParameters();
        parameters.WearPerHour = 1;
        var profile = Snapshot(parameters);
        var previous = Initial(profile) with { CycleProgressSeconds = 2, TotalProduced = 17, Wear = 0.5 };
        var result = _physics.Step(previous, profile, Context(profile, production: false), Epoch.AddSeconds(10), new ThrowingRandom());
        Assert.Equal(0, result.PartsProduced);
        Assert.Equal(17, result.State.TotalProduced);
        Assert.Equal(2, result.State.CycleProgressSeconds);
        Assert.Equal(0.5, result.State.Wear);
        Assert.Equal(55, result.State.Temperature, 9);
        Assert.Equal(0, result.State.Vibration);
        Assert.Equal(profile.IdlePowerKw, result.State.PowerLoadKw);
    }

    [Fact]
    public void WarningIsEmittedOnlyOnTransitionAndProductionContinues()
    {
        var parameters = QuietParameters();
        parameters.TemperatureResponsePerSecond = 0;
        var profile = Snapshot(parameters);
        var state = Initial(profile) with { Temperature = 80 };
        var first = _physics.Step(state, profile, Context(profile), Epoch.AddSeconds(5), new ConstantRandom());
        Assert.Equal(MachineStatus.Warning, first.State.MachineStatus);
        Assert.Equal(MachineStatus.Warning, Assert.Single(first.StatusChanges).NewStatus);
        Assert.Equal(1, first.PartsProduced);
        var second = _physics.Step(first.State, profile, Context(profile, MachineStatus.Warning), Epoch.AddSeconds(6), new ConstantRandom());
        Assert.Empty(second.StatusChanges);

        parameters.TemperatureResponsePerSecond = 0.1;
        var nextProfile = Snapshot(parameters, version: 2);
        var recovered = _physics.Step(second.State, nextProfile, Context(nextProfile, MachineStatus.Warning), Epoch.AddSeconds(16), new ConstantRandom());
        Assert.Equal(MachineStatus.Running, recovered.State.MachineStatus);
        Assert.Equal(MachineStatus.Running, Assert.Single(recovered.StatusChanges).NewStatus);
        Assert.Equal(2, recovered.State.ProfileVersion);
    }

    [Fact]
    public void OverheatingFaultStopsProductionAndRetainsTriggeringMeasurement()
    {
        var profile = Snapshot();
        var state = Initial(profile) with { Temperature = 89.9, IsOverheating = true, CycleProgressSeconds = 2, TotalProduced = 17 };
        var result = _physics.Step(state, profile, Context(profile), Epoch.AddSeconds(1), new ConstantRandom());
        var fault = Assert.Single(result.StatusChanges);
        Assert.Equal(MachineStatus.Error, result.State.MachineStatus);
        Assert.Equal(SimulationFaultMode.Overheating, fault.FaultMode);
        Assert.True(fault.Temperature >= 90);
        Assert.Equal(Epoch.AddMilliseconds(100), fault.OccurredAtUtc);
        Assert.Equal(17, result.State.TotalProduced);
        Assert.Equal(0, result.State.CycleProgressSeconds);
        Assert.Equal(0, result.PartsProduced);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void VibrationAndGenericFailureProduceOneErrorTransition(bool generic)
    {
        var parameters = QuietParameters();
        parameters.FailureProbabilityPerHour = generic ? 1 : 0;
        parameters.ExcessVibrationProbabilityPerHour = generic ? 0 : 1;
        parameters.ExcessVibrationAmplitude = 4;
        var profile = Snapshot(parameters);
        var first = _physics.Step(Initial(profile), profile, Context(profile), Epoch.AddSeconds(1), new ConstantRandom());
        var transition = Assert.Single(first.StatusChanges);
        Assert.Equal(MachineStatus.Error, transition.NewStatus);
        Assert.Equal(generic ? SimulationFaultMode.Generic : SimulationFaultMode.ExcessVibration, transition.FaultMode);
        if (!generic) Assert.True(transition.Vibration >= 5);
        var second = _physics.Step(first.State, profile, Context(profile, MachineStatus.Error), Epoch.AddSeconds(2), new ThrowingRandom());
        Assert.Empty(second.StatusChanges);
        Assert.Equal(MachineStatus.Error, second.State.MachineStatus);
    }

    [Fact]
    public void ErrorCoolsAndClearsPhysicalFlagsWithoutAutomaticallyRepairingMachine()
    {
        var profile = Snapshot();
        var state = Initial(profile) with
        {
            MachineStatus = MachineStatus.Error, FaultMode = SimulationFaultMode.Overheating,
            Temperature = 100, IsOverheating = true, IsOvervibrating = true, CycleProgressSeconds = 2, TotalProduced = 17
        };
        // Even a stale caller-supplied Running cannot clear a latched Error.
        var cooled = _physics.Step(state, profile, Context(profile), Epoch.AddSeconds(60), new ThrowingRandom());
        Assert.Equal(70, cooled.State.Temperature, 9);
        Assert.False(cooled.State.IsOverheating);
        Assert.False(cooled.State.IsOvervibrating);
        Assert.Equal(MachineStatus.Error, cooled.State.MachineStatus);
        Assert.Equal(SimulationFaultMode.Overheating, cooled.State.FaultMode);
        Assert.Equal(17, cooled.State.TotalProduced);
        Assert.Equal(0, cooled.State.CycleProgressSeconds);
        Assert.Empty(cooled.StatusChanges);
        var ambient = _physics.Step(cooled.State, profile, Context(profile, MachineStatus.Error), Epoch.AddSeconds(360), new ThrowingRandom());
        Assert.Equal(25, ambient.State.Temperature);
    }

    [Fact]
    public void NewCriticalThresholdIsAppliedBeforeAnyProduction()
    {
        var profile = Snapshot();
        var thresholds = new SimulationThresholds(new MetricThreshold(40, 50), new MetricThreshold(3, 5));
        var result = _physics.Step(Initial(profile), profile, Context(profile, thresholds: thresholds), Epoch.AddSeconds(1), new ThrowingRandom());
        Assert.Equal(MachineStatus.Error, result.State.MachineStatus);
        Assert.Equal(Epoch, Assert.Single(result.StatusChanges).OccurredAtUtc);
        Assert.Equal(0, result.PartsProduced);
    }

    [Fact]
    public void ExplicitPowerThresholdIsRespected()
    {
        var profile = Snapshot();
        var thresholds = new SimulationThresholds(new MetricThreshold(75, 90), new MetricThreshold(3, 5), new MetricThreshold(10, 12));
        var result = _physics.Step(Initial(profile), profile, Context(profile, thresholds: thresholds), Epoch.AddSeconds(1), new ConstantRandom());
        Assert.Equal(MachineStatus.Error, result.State.MachineStatus);
        Assert.True(Assert.Single(result.StatusChanges).PowerLoadKw >= 12);
    }

    [Fact]
    public void WearUsesWorkingTimeAndIsBounded()
    {
        var parameters = QuietParameters();
        parameters.WearPerHour = 1;
        var profile = Snapshot(parameters);
        var result = _physics.Step(Initial(profile), profile, Context(profile), Epoch.AddSeconds(60), new ConstantRandom());
        Assert.Equal(1.0 / 60, result.State.Wear, 9);
        var worn = _physics.Step(Initial(profile) with { Wear = 0.999 }, profile, Context(profile), Epoch.AddSeconds(60), new ConstantRandom());
        Assert.Equal(1, worn.State.Wear);
        Assert.True(worn.State.Vibration > result.State.Vibration);
        Assert.True(worn.State.PowerLoadKw > result.State.PowerLoadKw);
        Assert.True(worn.State.Temperature > result.State.Temperature);
    }

    [Theory]
    [InlineData(MachineStatus.Offline)]
    [InlineData(MachineStatus.Maintenance)]
    public void InactiveOperationalStatesCannotTick(MachineStatus status)
    {
        var profile = Snapshot();
        Assert.Throws<InvalidOperationException>(() => _physics.Step(Initial(profile), profile,
            Context(profile, status), Epoch.AddSeconds(1), new ThrowingRandom()));
    }

    [Fact]
    public void InvalidClockStateProfileAndRandomSourceAreRejected()
    {
        var profile = Snapshot();
        var state = Initial(profile);
        Assert.Throws<ArgumentOutOfRangeException>(() => _physics.Step(state, profile, Context(profile), Epoch, new ThrowingRandom()));
        Assert.Throws<ArgumentOutOfRangeException>(() => _physics.Step(state, profile, Context(profile), Epoch.AddSeconds(-1), new ThrowingRandom()));
        Assert.Throws<ArgumentOutOfRangeException>(() => _physics.Step(state, profile, Context(profile), Epoch.AddMinutes(6), new ThrowingRandom()));
        Assert.Throws<NotSupportedException>(() => _physics.Step(state with { SchemaVersion = 2 }, profile, Context(profile), Epoch.AddSeconds(1), new ThrowingRandom()));
        Assert.Throws<ArgumentException>(() => _physics.Step(state with { Wear = double.NaN }, profile, Context(profile), Epoch.AddSeconds(1), new ThrowingRandom()));
        Assert.Throws<ArgumentException>(() => _physics.Step(state with { ProfileVersion = 2 }, profile, Context(profile), Epoch.AddSeconds(1), new ThrowingRandom()));
        Assert.Throws<InvalidOperationException>(() => _physics.Step(state, profile, Context(profile), Epoch.AddSeconds(1), new ConstantRandom(1)));
    }

    [Fact]
    public void ProfileSnapshotIsIndependentFromLaterParameterEdits()
    {
        var parameters = QuietParameters();
        var snapshot = Snapshot(parameters);
        parameters.NormalTemperature = 150;
        Assert.Equal(60, snapshot.NormalTemperature);
        Assert.Throws<ArgumentException>(() => new MetricThreshold(90, 80));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SimulationStepContext(MachineStatus.Running, true, 0, SimulationThresholds.Defaults(snapshot)));
    }

    [Theory]
    [InlineData(SimulationPreset.Stable)]
    [InlineData(SimulationPreset.WearAndTear)]
    [InlineData(SimulationPreset.Chaos)]
    public void TracePresetTicks(SimulationPreset preset)
    {
        var profile = Snapshot(SimulationPresets.Create(preset));
        var random = new SystemRandomSource(123);
        var state = Initial(profile);
        for (var second = 1; second <= 12; second++)
        {
            var result = _physics.Step(state, profile, Context(profile, state.MachineStatus), Epoch.AddSeconds(second), random);
            state = result.State;
            _output.WriteLine($"{preset}: t={second}s temperature={state.Temperature:F2}, vibration={state.Vibration:F2}, power={state.PowerLoadKw:F2}, wear={state.Wear:F6}, parts={state.TotalProduced}, status={state.MachineStatus}");
        }
        if (preset == SimulationPreset.Chaos) Assert.Equal(MachineStatus.Error, state.MachineStatus);
        else Assert.Equal(MachineStatus.Running, state.MachineStatus);
    }

    [Fact]
    public void PresetsPreserveBaselinesButReplacePreviousCustomTuning()
    {
        var custom = QuietParameters();
        custom.NormalTemperature = 120;
        custom.NormalPowerKw = 2;
        custom.BaseVibration = 4;
        custom.TickIntervalMs = 2500;
        custom.WearPerHour = 1;
        custom.OverheatingProbabilityPerHour = 1;
        var stable = SimulationPresets.Create(SimulationPreset.Stable, custom);
        Assert.Equal(120, stable.NormalTemperature);
        Assert.Equal(2, stable.NormalPowerKw);
        Assert.Equal(4, stable.BaseVibration);
        Assert.Equal(2500, stable.TickIntervalMs);
        Assert.Equal(0, stable.WearPerHour);
        Assert.Equal(0.01, stable.OverheatingProbabilityPerHour);
        Assert.Equal(0.2, stable.PowerNoiseAmplitudeKw);
        Assert.Equal(1, custom.WearPerHour);
        Assert.Throws<ArgumentOutOfRangeException>(() => SimulationPresets.Create(SimulationPreset.Custom));

        var machine = new Machine { StaticProperties = "{\"NormPower\":2}" };
        var created = SimulationProfileFactory.CreateStable(machine, 1000);
        Assert.Equal(Snapshot(SimulationPresets.Create(SimulationPreset.Stable, created)), Snapshot(created));
    }

    private sealed class ConstantRandom(double value = 0.5) : IRandomSource
    {
        public double NextDouble() => value;
    }

    private sealed class ThrowingRandom : IRandomSource
    {
        public double NextDouble() => throw new InvalidOperationException("Idle/Error/rejected ticks must not consume random numbers.");
    }
}
