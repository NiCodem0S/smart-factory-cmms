using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Mappers;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Simulation;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public sealed class SimulationRuntimeTests
{
    private sealed class StateStore : ISimulationStateStore
    {
        public volatile bool Available = true;
        public readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, MachineSimState> States = new();
        public Task<bool> IsAvailableAsync(CancellationToken ct = default) => Task.FromResult(Available);
        public Task<MachineSimState?> ReadAsync(Guid id, CancellationToken ct = default) => Task.FromResult(States.GetValueOrDefault(id));
        public Task WriteAsync(MachineSimState state, CancellationToken ct = default)
        {
            if (!Available) throw new InvalidOperationException("Redis disconnected");
            States[state.MachineId] = state; return Task.CompletedTask;
        }
        public Task DeleteAsync(Guid id, CancellationToken ct = default) { States.TryRemove(id, out _); return Task.CompletedTask; }
    }
    private sealed class Faults { public volatile bool SqlUnavailable; }
    private sealed class Checkpoints(ApplicationDbContext db, SimulationDiagnostics diagnostics, Faults faults) : ISimulationCheckpointStore
    {
        private readonly SimulationCheckpointStore _inner = new(db, diagnostics);
        public Task<MachineSimState?> ReadAsync(Guid id, CancellationToken ct = default) => _inner.ReadAsync(id, ct);
        public Task SaveAsync(Machine m, MachineSimState s, IReadOnlyList<SimulationStatusChanged> events, CancellationToken ct = default) =>
            faults.SqlUnavailable ? Task.FromException(new InvalidOperationException("SQL disconnected")) : _inner.SaveAsync(m, s, events, ct);
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public ServiceProvider Services { get; }
        public StateStore Redis { get; } = new();
        public Faults Faults { get; } = new();
        public SimulationOrchestrator Runtime => Services.GetRequiredService<SimulationOrchestrator>();
        public Guid Hall { get; } = Guid.NewGuid();
        public Guid Line { get; } = Guid.NewGuid();
        public Guid First { get; } = Guid.NewGuid();
        public Guid Second { get; } = Guid.NewGuid();
        public SimulationActor Admin => new(UserRole.HallAdmin, Hall, true);
        public Fixture(bool automation = false)
        {
            var collection = new ServiceCollection();
            var database = Guid.NewGuid().ToString();
            collection.AddLogging(); collection.AddSignalR();
            collection.AddSingleton<IOptions<SimulationOptions>>(Options.Create(new SimulationOptions { DefaultTickIntervalMs = 100, ReconcileIntervalSeconds = 1, HistorySampleIntervalSeconds = 1, AutomationEnabled = automation }));
            collection.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(database));
            collection.AddSingleton<ISimulationStateStore>(Redis);
            collection.AddSingleton(Faults);
            collection.AddSingleton<SimulationDiagnostics>(); collection.AddSingleton<TelemetryChannel>();
            collection.AddScoped<ISimulationCheckpointStore, Checkpoints>(); collection.AddSingleton<SimulationOrchestrator>();
            collection.AddSingleton<IMapper>(new Mapper(new MapperConfiguration(c => c.AddProfile<MachineMappingProfile>(), NullLoggerFactory.Instance)));
            Services = collection.BuildServiceProvider();
        }
        public static async Task<Fixture> Create(bool hosted = true, bool automation = false)
        {
            var f = new Fixture(automation);
            await f.Db(async db => {
                db.FactoryHalls.Add(new FactoryHall { Id = f.Hall, Name = "Runtime test hall" });
                db.ProductionLines.Add(new ProductionLine { Id = f.Line, FactoryHallId = f.Hall, Name = "Line", Status = "Halted" });
                foreach (var id in new[] { f.First, f.Second })
                    db.Machines.Add(new Machine { Id = id, Name = id.ToString(), Category = "Test", FactoryHallId = f.Hall, ProductionLineId = f.Line, CycleTimeSeconds = .1 });
                await db.SaveChangesAsync();
                foreach (var profile in db.SimulationProfiles) {
                    profile.OverheatingProbabilityPerHour = 0; profile.ExcessVibrationProbabilityPerHour = 0; profile.FailureProbabilityPerHour = 0;
                }
                await db.SaveChangesAsync();
            });
            if (hosted) await f.Runtime.StartAsync(CancellationToken.None);
            return f;
        }
        public async Task Db(Func<ApplicationDbContext, Task> action) { using var scope = Services.CreateScope(); await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()); }
        public async Task<T> Query<T>(Func<ApplicationDbContext, Task<T>> action) { using var scope = Services.CreateScope(); return await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()); }
        public async ValueTask DisposeAsync() { await Runtime.StopAsync(CancellationToken.None); await Services.DisposeAsync(); }
    }
    private static async Task Until(Func<bool> condition)
    {
        var end = DateTime.UtcNow.AddSeconds(6);
        while (!condition() && DateTime.UtcNow < end) await Task.Delay(30);
        Assert.True(condition(), "Condition not reached within 6 seconds");
    }
    private static async Task StatusError(int status, Func<Task> action) => Assert.Equal(status, (await Assert.ThrowsAsync<SimulationRequestException>(action)).StatusCode);

    [Fact]
    public async Task StartRequiresOperationalMachineAndRedisAndIsIdempotent()
    {
        await using var f = await Fixture.Create();
        await StatusError(409, () => f.Runtime.StartAsync(f.First, f.Admin, false));
        f.Redis.Available = false;
        await StatusError(503, () => f.Runtime.StartAsync(f.First, f.Admin, true));
        Assert.Equal(MachineStatus.Offline, await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.Status).SingleAsync()));
        Assert.False(await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.SimulationEnabled).SingleAsync()));
        f.Redis.Available = true;
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await Until(() => f.Redis.States[f.First].TickNumber >= 2);
        var tick = f.Redis.States[f.First].TickNumber;
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        Assert.True(f.Runtime.IsRunning(f.First));
        Assert.True(f.Redis.States[f.First].TickNumber >= tick);
        Assert.Single(await f.Query(db => db.SimulationCheckpoints.ToListAsync()));
    }

    [Fact]
    public async Task LineRequiresEveryWorkerAndHaltPreservesTelemetryWithoutProducing()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await StatusError(409, () => f.Runtime.SetLineAsync(f.Line, f.Admin, true));
        await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        await Until(() => f.Redis.States[f.First].TotalProduced >= 2);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, false);
        var stopped = f.Runtime.Inspect(f.First, true).State!;
        await Until(() => f.Redis.States[f.First].TickNumber >= stopped.TickNumber + 3);
        Assert.True(f.Runtime.IsRunning(f.First));
        Assert.Equal(stopped.TotalProduced, f.Redis.States[f.First].TotalProduced);
        Assert.Equal(MachineStatus.Running, f.Redis.States[f.First].MachineStatus);
    }

    [Fact]
    public async Task StoppingSimulationHaltsLineAndResumingDoesNotRestartProduction()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true); await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        await f.Runtime.StopAsync(f.First, f.Admin, false);
        Assert.False(f.Runtime.IsRunning(f.First)); Assert.True(f.Runtime.IsRunning(f.Second));
        Assert.Equal(MachineStatus.Running, await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.Status).SingleAsync()));
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
        await f.Runtime.StartAsync(f.First, f.Admin, false);
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
    }

    [Fact]
    public async Task RedisFailurePausesWorkerPersistsCheckpointAndResumesDesiredRequest()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true); await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        f.Redis.Available = false;
        await Until(() => !f.Runtime.IsRunning(f.First) && !f.Runtime.IsRunning(f.Second));
        Assert.True(await f.Query(db => db.Machines.AllAsync(m => m.SimulationEnabled)));
        Assert.Equal("Faulted", f.Runtime.Inspect(f.First, true).Status);
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
        f.Redis.Available = true;
        await Until(() => f.Runtime.IsRunning(f.First) && f.Runtime.IsRunning(f.Second));
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
    }

    [Fact]
    public async Task FailedSqlCheckpointIsRetriedBeforeWorkerResumes()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await Until(() => f.Redis.States[f.First].TickNumber > 1);
        f.Faults.SqlUnavailable = true;
        await f.Runtime.CheckpointAllAsync(CancellationToken.None);
        Assert.False(f.Runtime.IsRunning(f.First));
        var uncommitted = f.Runtime.Inspect(f.First, true).State!;
        f.Faults.SqlUnavailable = false;
        await Until(() => f.Runtime.IsRunning(f.First));
        Assert.True((await f.Query(db => db.SimulationCheckpoints.SingleAsync())).TickNumber >= uncommitted.TickNumber);
    }

    [Fact]
    public async Task MaintenanceResetsFaultAndRepairLeavesMachineOffline()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await f.Runtime.MaintenanceAsync(f.First, f.Admin, false);
        Assert.False(f.Runtime.IsRunning(f.First));
        await StatusError(409, () => f.Runtime.StartAsync(f.First, f.Admin, true));
        await f.Runtime.MaintenanceAsync(f.First, f.Admin, true);
        var machine = await f.Query(db => db.Machines.SingleAsync(m => m.Id == f.First));
        Assert.Equal(MachineStatus.Offline, machine.Status); Assert.False(machine.SimulationEnabled);
        var checkpoint = await f.Query(db => db.SimulationCheckpoints.SingleAsync());
        Assert.Equal(0, checkpoint.Wear); Assert.Equal(SimulationFaultMode.None, checkpoint.FaultMode);
    }

    [Fact]
    public async Task ProfileUpdatesApplyWhileRunningAndRejectStaleVersions()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        var profile = await f.Query(db => db.SimulationProfiles.SingleAsync(p => p.MachineId == f.First));
        var dto = new ApplySimulationPresetDto { Preset = SimulationPreset.WearAndTear, Version = profile.Version };
        await f.Runtime.ApplyPresetAsync(f.First, f.Admin, dto);
        await Until(() => f.Redis.States[f.First].ProfileVersion > profile.Version);
        await StatusError(409, () => f.Runtime.ApplyPresetAsync(f.First, f.Admin, dto));
        Assert.True(f.Runtime.IsRunning(f.First));
    }

    [Fact]
    public async Task TenantAndRoleChecksApplyToEveryCommand()
    {
        await using var f = await Fixture.Create();
        await StatusError(403, () => f.Runtime.StartAsync(f.First, new(UserRole.Technician, f.Hall, true), true));
        await StatusError(404, () => f.Runtime.StartAsync(f.First, new(UserRole.HallAdmin, Guid.NewGuid(), true), true));
        await StatusError(404, () => f.Runtime.SetLineAsync(f.Line, new(UserRole.HallAdmin, null, true), true));
        await StatusError(403, () => f.Runtime.StopAsync(f.First, new(UserRole.SuperAdmin, null, false), true));
        Assert.True(new SimulationActor(UserRole.Technician, f.Hall, true).CanRead(f.Hall));
        Assert.False(new SimulationActor(UserRole.Technician, null, true).CanRead(f.Hall));
    }

    [Fact]
    public async Task DeactivationStopsWorkerAndRemovesRedisSnapshot()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await f.Runtime.DeleteMachineAsync(f.First, f.Admin);
        Assert.False(f.Runtime.IsRunning(f.First)); Assert.False(f.Redis.States.ContainsKey(f.First));
        Assert.False(await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.IsActive).SingleAsync()));
        await StatusError(404, () => f.Runtime.StartAsync(f.First, f.Admin, true));
    }

    [Fact]
    public async Task RestoreUsesSqlCheckpointAndDoesNotProduceDuringDowntime()
    {
        await using var f = await Fixture.Create(false);
        var timestamp = DateTimeOffset.UtcNow.AddHours(-3);
        await f.Db(async db => {
            var machine = await db.Machines.Include(m => m.SimulationProfile).SingleAsync(m => m.Id == f.First);
            machine.Status = MachineStatus.Running; machine.SimulationEnabled = true;
            var state = MachineSimState.CreateInitial(machine.Id, SimulationProfileSnapshot.FromParameters(machine.SimulationProfile!, machine.SimulationProfile!.Version), timestamp, machine.Status, 99)
                with { TickNumber = 100, CycleProgressSeconds = .05 };
            await new SimulationCheckpointStore(db, f.Services.GetRequiredService<SimulationDiagnostics>()).SaveAsync(machine, state, []);
            f.Redis.States[machine.Id] = state with { TotalProduced = 5000, TickNumber = 9999 };
        });
        await f.Runtime.StartAsync(CancellationToken.None);
        await Until(() => f.Runtime.IsRunning(f.First));
        var restored = f.Redis.States[f.First];
        Assert.Equal(99, restored.TotalProduced); Assert.InRange(restored.TickNumber, 100, 110);
        Assert.True(restored.LastTickAtUtc > timestamp.AddHours(2));
        Assert.Equal(.05, restored.CycleProgressSeconds);
    }

    [Fact]
    public async Task ManualFaultIsDurableHaltsLineAndCannotBeClearedWithoutRepair()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        var triggered = await f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.ExcessVibration);
        Assert.Equal(MachineStatus.Error, triggered.MachineStatus);
        Assert.Equal(SimulationFaultMode.ExcessVibration, triggered.FaultMode);
        Assert.Equal(0, triggered.Vibration); // stopped drive; the event retains the actual peak
        Assert.Equal(0, triggered.CycleProgressSeconds);
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
        Assert.Equal(triggered.TickNumber, (await f.Query(db => db.SimulationCheckpoints.SingleAsync(c => c.MachineId == f.First))).TickNumber);
        Assert.Single(await f.Query(db => db.Incidents.Where(i => i.MachineId == f.First && i.Severity == "Critical").ToListAsync()));
        var peak = Assert.Single(await f.Query(db => db.TelemetryRead.Where(t => t.MachineId == f.First).ToListAsync()));
        Assert.True(peak.Vibration > (decimal)f.Redis.States[f.First].Vibration);
        await StatusError(409, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Normal));
        await StatusError(409, () => f.Runtime.StopAsync(f.First, f.Admin, true));
        await f.Runtime.MaintenanceAsync(f.First, f.Admin, false);
        await StatusError(409, () => f.Runtime.StopAsync(f.First, f.Admin, true));
        await f.Runtime.MaintenanceAsync(f.First, f.Admin, true);
        Assert.Equal("Resolved", await f.Query(db => db.Incidents.Select(i => i.Status).SingleAsync()));
        Assert.Equal(MachineStatus.Offline, await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.Status).SingleAsync()));
    }

    [Fact]
    public async Task ScenariosRespectProductionAccessAndRedisAvailability()
    {
        await using var f = await Fixture.Create();
        await StatusError(403, () => f.Runtime.TriggerScenarioAsync(f.First, new(UserRole.Technician, f.Hall, true), SimulationScenario.Failure));
        await StatusError(404, () => f.Runtime.TriggerScenarioAsync(f.First, new(UserRole.HallAdmin, Guid.NewGuid(), true), SimulationScenario.Failure));
        await StatusError(409, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Failure));
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await StatusError(400, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, (SimulationScenario)999));
        await StatusError(409, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Overheating));
        f.Redis.Available = false;
        await StatusError(503, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Failure));
    }

    [Fact]
    public async Task WarningCanRecoverAndProgressiveOverheatingEventuallyFaults()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        var warning = await f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.TemperatureWarning);
        Assert.Equal(MachineStatus.Warning, warning.MachineStatus);
        Assert.False(warning.IsOverheating);
        var normal = await f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Normal);
        Assert.Equal(MachineStatus.Running, normal.MachineStatus);
        Assert.True(normal.TotalProduced >= warning.TotalProduced);
        Assert.Equal("Resolved", await f.Query(db => db.Incidents.Select(i => i.Status).SingleAsync()));
        var heating = await f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Overheating);
        Assert.True(heating.IsOverheating);
        Assert.Equal(MachineStatus.Warning, heating.MachineStatus);
        await Until(() => f.Redis.States[f.First].MachineStatus == MachineStatus.Error);
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
    }

    [Fact]
    public async Task UnsupportedScenarioTargetsDoNotPoisonTheRunningWorker()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        await f.Runtime.UpdateThresholdsAsync(f.First, f.Admin, new() {
            new() { MetricType = "Temperature", WarningValue = 2000000, CriticalValue = 3000000 }
        });
        await StatusError(409, () => f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Overheating));
        Assert.True(f.Runtime.IsRunning(f.First));
        Assert.InRange(f.Redis.States[f.First].Temperature, 0, 100);
        Assert.Empty(await f.Query(db => db.Incidents.ToListAsync()));
    }

    [Fact]
    public async Task NominalEditsShareProfileAndMetadataAndRejectStaleForms()
    {
        await using var f = await Fixture.Create();
        await f.Db(async db => {
            var m = await db.Machines.SingleAsync(m => m.Id == f.First);
            m.StaticProperties = "{\"Firmware\":\"v2\",\"NormTemp\":60}";
            await db.SaveChangesAsync();
        });
        var profile = await f.Query(db => db.SimulationProfiles.SingleAsync(p => p.MachineId == f.First));
        var dto = new UpdateMachineDto { Name = "Edited", Category = "Test", FactoryHallId = f.Hall,
            ProductionLineId = f.Line, NormTemp = 80, BaseVib = 2, NormPower = 25, SimulationProfileVersion = profile.Version,
            AlertThresholds = new() { new() { MetricType = "Temperature", WarningValue = 95, CriticalValue = 110 } } };
        await f.Runtime.EditMachineAsync(f.First, f.Admin, dto);
        Assert.Single(await f.Query(db => db.AlertThresholds.Where(t => t.MachineId == f.First).ToListAsync()));
        var updated = await f.Query(db => db.SimulationProfiles.SingleAsync(p => p.MachineId == f.First));
        Assert.Equal(80, updated.NormalTemperature);
        Assert.Equal(2, updated.BaseVibration);
        Assert.Equal(25, updated.NormalPowerKw);
        Assert.Equal(SimulationPreset.Custom, updated.Preset);
        var json = System.Text.Json.JsonDocument.Parse((await f.Query(db => db.Machines.SingleAsync(m => m.Id == f.First))).StaticProperties!);
        Assert.Equal("v2", json.RootElement.GetProperty("Firmware").GetString());
        Assert.Equal(80, json.RootElement.GetProperty("NormTemp").GetDouble());
        dto.NormTemp = 90;
        await StatusError(409, () => f.Runtime.EditMachineAsync(f.First, f.Admin, dto));
        await f.Runtime.ApplyPresetAsync(f.First, f.Admin, new() { Version = updated.Version, Preset = SimulationPreset.Chaos });
        var afterPreset = await f.Query(db => db.Machines.Include(m => m.SimulationProfile).SingleAsync(m => m.Id == f.First));
        using var presetJson = System.Text.Json.JsonDocument.Parse(afterPreset.StaticProperties!);
        Assert.Equal(afterPreset.SimulationProfile!.NormalTemperature, presetJson.RootElement.GetProperty("NormTemp").GetDouble());
        Assert.Equal("v2", presetJson.RootElement.GetProperty("Firmware").GetString());
    }

    [Fact]
    public async Task AutomationStartsProductionAndItsSettingIsPersistentAndRestricted()
    {
        await using var f = await Fixture.Create(automation: true);
        await Until(() => f.Runtime.RedisAvailable);
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        Assert.True(f.Runtime.IsHealthyLine(f.Line));
        Assert.True(f.Runtime.IsRunning(f.First));
        Assert.True(f.Runtime.IsRunning(f.Second));
        await Until(() => f.Redis.States[f.First].TotalProduced > 0);
        await StatusError(403, () => f.Runtime.SetAutomationAsync(f.Admin, false));
        await StatusError(403, () => f.Runtime.SetAutomationAsync(new(UserRole.SuperAdmin, null, false), false));
        await f.Runtime.SetAutomationAsync(new(UserRole.SuperAdmin, null, true), false);
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        Assert.False(f.Runtime.AutomationEnabled);
        Assert.False(await f.Query(db => db.SystemSettings.Select(s => s.SimulationAutomationEnabled!.Value).SingleAsync()));
        Assert.True(f.Runtime.IsHealthyLine(f.Line)); // pausing recovery does not stop production
    }

    [Fact]
    public async Task AutomationRotatesLinesPreservesFaultsAndRepairsWithoutLosingProduction()
    {
        await using var f = await Fixture.Create(automation: true);
        var otherLine = Guid.NewGuid(); var otherMachine = Guid.NewGuid();
        await f.Db(async db => {
            db.ProductionLines.Add(new() { Id = otherLine, FactoryHallId = f.Hall, Name = "Alternative", Status = "Halted" });
            db.Machines.Add(new() { Id = otherMachine, FactoryHallId = f.Hall, ProductionLineId = otherLine, Name = "Alternative machine", Category = "Test" });
            await db.SaveChangesAsync();
            var p = await db.SimulationProfiles.SingleAsync(p => p.MachineId == otherMachine);
            p.OverheatingProbabilityPerHour = 0; p.ExcessVibrationProbabilityPerHour = 0; p.FailureProbabilityPerHour = 0;
            await db.SaveChangesAsync();
        });
        await f.Runtime.StartAsync(f.First, f.Admin, true); await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        var now = DateTimeOffset.UtcNow;
        await f.Runtime.RunAutomationAsync(now);
        var faulted = await f.Runtime.TriggerScenarioAsync(f.First, f.Admin, SimulationScenario.Failure);
        await f.Runtime.RunAutomationAsync(now);
        Assert.True(f.Runtime.IsHealthyLine(otherLine));
        Assert.Equal(MachineStatus.Error, f.Redis.States[f.First].MachineStatus);
        var deadline = await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.AutomaticRepairAtUtc).SingleAsync());
        Assert.InRange(deadline!.Value, now.AddSeconds(90), DateTimeOffset.UtcNow.AddSeconds(240));
        // Every line can fail. With no healthy alternative left, urgent repair takes priority over the deadline.
        await f.Runtime.TriggerScenarioAsync(otherMachine, f.Admin, SimulationScenario.Failure);
        await f.Runtime.RunAutomationAsync(now.AddSeconds(1));
        Assert.True(f.Runtime.IsHealthyLine(f.Line));
        Assert.Equal(MachineStatus.Error, f.Redis.States[otherMachine].MachineStatus);
        Assert.True(f.Redis.States[f.First].TotalProduced >= faulted.TotalProduced);
        Assert.Equal(SimulationFaultMode.None, f.Redis.States[f.First].FaultMode);
        Assert.Equal(0, f.Redis.States[f.First].Wear);
        Assert.Equal("Resolved", await f.Query(db => db.Incidents.Where(i => i.MachineId == f.First).Select(i => i.Status).SingleAsync()));
        await f.Runtime.RunAutomationAsync(now.AddSeconds(300));
        Assert.True(f.Runtime.IsHealthyLine(otherLine));
        Assert.Null(await f.Query(db => db.Machines.Where(m => m.Id == otherMachine).Select(m => m.AutomaticRepairAtUtc).SingleAsync()));
    }

    [Fact]
    public async Task AutomationRespectsPlannedMaintenanceAndNeverClaimsCoverageWithoutRedis()
    {
        await using var f = await Fixture.Create(automation: true);
        await f.Runtime.MaintenanceAsync(f.Second, f.Admin, false);
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        Assert.False(f.Runtime.IsHealthyLine(f.Line));
        Assert.Equal(MachineStatus.Maintenance, await f.Query(db => db.Machines.Where(m => m.Id == f.Second).Select(m => m.Status).SingleAsync()));
        var visible = await f.Query(db => db.Machines.ToListAsync());
        Assert.NotNull(f.Runtime.AutomationStatus(visible).Warning);
        f.Redis.Available = false;
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        Assert.False(f.Runtime.IsHealthyLine(f.Line));
        Assert.Contains("Redis", f.Runtime.AutomationStatus(visible).Warning!);
    }

    [Fact]
    public async Task RoutineRepairRestartsProductionWhileOtherWarningsRecover()
    {
        await using var f = await Fixture.Create(hosted: false, automation: true);
        await f.Db(async db => {
            var first = await db.Machines.SingleAsync(m => m.Id == f.First);
            first.Status = MachineStatus.Error; first.AutomaticRepairAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1);
            (await db.Machines.SingleAsync(m => m.Id == f.Second)).Status = MachineStatus.Warning;
            var otherLine = new ProductionLine { FactoryHallId = f.Hall, Name = "Backup", Status = "Halted" };
            db.ProductionLines.Add(otherLine);
            db.Machines.Add(new() { FactoryHallId = f.Hall, ProductionLineId = otherLine.Id, Name = "Backup", Category = "Test" });
            await db.SaveChangesAsync();
        });
        await f.Runtime.StartAsync(CancellationToken.None);
        await Until(() => f.Runtime.RedisAvailable);
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        await Until(() => f.Runtime.IsHealthyLine(f.Line));
        Assert.True(f.Runtime.IsRunning(f.Second));
        Assert.Equal(MachineStatus.Running, f.Redis.States[f.Second].MachineStatus);
    }

    [Fact]
    public async Task AutomationResumesItsOwnPersistedMaintenanceAfterRestart()
    {
        await using var f = await Fixture.Create(hosted: false, automation: true);
        await f.Db(async db => {
            var machine = await db.Machines.SingleAsync(m => m.Id == f.First);
            machine.Status = MachineStatus.Maintenance;
            machine.AutomaticRepairAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1);
            machine.TotalProduced = 99;
            await db.SaveChangesAsync();
        });
        await f.Runtime.StartAsync(CancellationToken.None);
        await Until(() => f.Runtime.RedisAvailable);
        await f.Runtime.RunAutomationAsync(DateTimeOffset.UtcNow);
        Assert.True(f.Runtime.IsHealthyLine(f.Line));
        Assert.True(f.Redis.States[f.First].TotalProduced >= 99);
        Assert.Null(await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.AutomaticRepairAtUtc).SingleAsync()));
    }

    [Fact]
    public async Task HistoryBackpressureDropsOldestAndReportsExactCount()
    {
        var diagnostics = new SimulationDiagnostics();
        var channel = new TelemetryChannel(diagnostics);
        for (var i = 0; i < 10005; i++) await channel.AddTelemetryAsync(new TelemetryRead { Temperature = i });
        Assert.Equal(5, diagnostics.Dropped); Assert.Equal(10000, channel.Count);
        Assert.True(channel.TryRead(out var first)); Assert.Equal(5, first!.Temperature);
    }

    [Fact]
    public async Task CriticalEventsAndCountersShareCheckpointAndRetriesDoNotDuplicateEvents()
    {
        await using var f = await Fixture.Create(false);
        var now = DateTimeOffset.UtcNow;
        var changes = new[] { new SimulationStatusChanged(f.First, now, MachineStatus.Running, MachineStatus.Error, SimulationFaultMode.Overheating, 100, 1, 15) };
        async Task Save(ApplicationDbContext db)
        {
            var machine = await db.Machines.Include(m => m.SimulationProfile).SingleAsync(m => m.Id == f.First);
            var state = MachineSimState.CreateInitial(f.First, SimulationProfileSnapshot.FromParameters(machine.SimulationProfile!, machine.SimulationProfile!.Version), now, MachineStatus.Error, 42) with { TickNumber = 10 };
            await new SimulationCheckpointStore(db, f.Services.GetRequiredService<SimulationDiagnostics>()).SaveAsync(machine, state, changes);
        }
        await f.Db(Save); await f.Db(Save);
        Assert.Single(await f.Query(db => db.Incidents.ToListAsync()));
        Assert.Single(await f.Query(db => db.TelemetryRead.ToListAsync()));
        Assert.Equal(42, await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.TotalProduced).SingleAsync()));
        Assert.Equal(MachineStatus.Error, (await f.Query(db => db.SimulationCheckpoints.SingleAsync())).MachineStatus);
    }

    [Fact]
    public async Task AddingAnOfflineMachineImmediatelyHaltsAnOtherwiseProducingLine()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true); await f.Runtime.StartAsync(f.Second, f.Admin, true);
        await f.Runtime.SetLineAsync(f.Line, f.Admin, true);
        var added = await f.Runtime.CreateMachineAsync(new Machine { Name = "New station", Category = "Test", FactoryHallId = f.Hall, ProductionLineId = f.Line }, f.Admin);
        Assert.False(added.SimulationEnabled); Assert.NotNull(added.SimulationProfile);
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
        Assert.True(f.Runtime.IsRunning(f.First)); Assert.True(f.Runtime.IsRunning(f.Second));
    }

    [Fact]
    public async Task MetadataEditDoesNotOverwriteLiveStatusAndRunningMachineCannotMove()
    {
        await using var f = await Fixture.Create();
        await f.Runtime.StartAsync(f.First, f.Admin, true);
        var edit = new UpdateMachineDto { Name = "Renamed", Category = "Test", FactoryHallId = f.Hall, ProductionLineId = f.Line };
        await f.Runtime.EditMachineAsync(f.First, f.Admin, edit);
        Assert.Equal(MachineStatus.Running, await f.Query(db => db.Machines.Where(m => m.Id == f.First).Select(m => m.Status).SingleAsync()));
        edit.ProductionLineId = null;
        await StatusError(409, () => f.Runtime.EditMachineAsync(f.First, f.Admin, edit));
    }

    [Fact]
    public async Task RestartHaltsPersistedRunningLineBeforeRestoringWorkers()
    {
        await using var f = await Fixture.Create(false);
        await f.Db(async db => {
            (await db.ProductionLines.SingleAsync()).Status = "Running";
            foreach (var machine in await db.Machines.ToListAsync()) { machine.Status = MachineStatus.Running; machine.SimulationEnabled = true; }
            await db.SaveChangesAsync();
        });
        await f.Runtime.StartAsync(CancellationToken.None);
        await Until(() => f.Runtime.IsRunning(f.First) && f.Runtime.IsRunning(f.Second));
        Assert.Equal("Halted", await f.Query(db => db.ProductionLines.Select(l => l.Status).SingleAsync()));
        await Until(() => f.Redis.States[f.First].TickNumber > 2);
        Assert.Equal(0, f.Redis.States[f.First].TotalProduced);
    }
}
