using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

/// Single API owner. The gate serializes ticks and all operational commands, including line transitions.
public sealed partial class SimulationOrchestrator(
    IServiceScopeFactory scopes, ISimulationStateStore stateStore, TelemetryChannel history,
    IHubContext<TelemetryHub> hub, IOptions<SimulationOptions> options,
    SimulationDiagnostics diagnostics, ILogger<SimulationOrchestrator> logger,
    ITelemetryHistoryQueue? streamQueue = null) : BackgroundService
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ConcurrentDictionary<Guid, Worker> _workers = new();
    private readonly ConcurrentDictionary<Guid, string> _lineStatuses = new();
    // Accessed only while holding _gate.
    private readonly HashSet<Guid> _forcedHalts = new();
    private readonly ConcurrentDictionary<Guid, string> _startErrors = new();
    private readonly List<Worker> _retired = new();
    private readonly SimulationOptions _options = options.Value;
    private readonly MachinePhysics _physics = new();
    private volatile bool _shuttingDown;
    private bool _initialized;
    public bool RedisAvailable { get; private set; }
    public string? ServiceError { get; private set; }

    private sealed record WorkerConfiguration(Guid HallId, Guid? LineId, double CycleTimeSeconds,
        SimulationProfileSnapshot Profile, SimulationThresholds Thresholds);

    private sealed class Worker(Guid id, WorkerConfiguration configuration, MachineSimState state)
    {
        public Guid Id { get; } = id;
        public volatile WorkerConfiguration Configuration = configuration;
        public volatile MachineSimState State = state;
        public readonly CancellationTokenSource Cancellation = new();
        public readonly IRandomSource Random = new SystemRandomSource();
        public readonly List<SimulationStatusChanged> PendingEvents = new();
        public Task Task = Task.CompletedTask;
        public volatile bool Running;
        public bool Dirty;
        public bool DisableOnSave;
        public string? Error;
        public DateTimeOffset LastHistory = DateTimeOffset.MinValue;
        public DateTimeOffset LastLive = DateTimeOffset.MinValue;

        public void Apply(SimulationTickResult result)
        {
            State = result.State;
            Dirty = true;
            PendingEvents.AddRange(result.StatusChanges);
        }
    }

    public (string Status, string? Error, MachineSimState? State) Inspect(Guid id, bool desired)
    {
        if (_workers.TryGetValue(id, out var worker))
        {
            if (worker.Running)
            {
                return ("Running", worker.Error, worker.State);
            }

            var status = worker.Error is null ? "Stopped" : "Faulted";
            return (status, worker.Error, worker.State);
        }

        if (!desired)
        {
            return ("Stopped", null, null);
        }

        if (_startErrors.TryGetValue(id, out var error))
        {
            return ("Faulted", error, null);
        }

        return ("Pending", ServiceError, null);
    }

    public bool IsRunning(Guid id) => _workers.TryGetValue(id, out var worker) && worker.Running;

    private bool IsReadyForProduction(Guid machineId) =>
        _workers.TryGetValue(machineId, out var worker) && worker.Running && ProductionLinePolicy.CanProduce(worker.State.MachineStatus);

    private bool IsMachineReadyForProduction(Machine machine) =>
        machine.TelemetrySource == TelemetrySource.RealDevice
            ? ProductionLinePolicy.CanProduce(machine.Status)
            : IsReadyForProduction(machine.Id);

    private ValueTask EnqueueHistoryAsync(TelemetryRead sample, CancellationToken ct) =>
        streamQueue is not null ? streamQueue.EnqueueAsync(sample, ct) : history.AddTelemetryAsync(sample, ct);

    private static WorkerConfiguration Configuration(Machine machine)
    {
        var profile = machine.SimulationProfile ?? throw new InvalidOperationException("Machine has no simulation profile.");
        var snapshot = SimulationProfileSnapshot.FromParameters(profile, profile.Version);
        MetricThreshold? Find(string metric)
        {
            var threshold = machine.AlertThresholds.FirstOrDefault(t => t.MetricType == metric);
            return threshold is null ? null : new MetricThreshold((double)threshold.WarningValue, (double)threshold.CriticalValue);
        }
        var defaults = SimulationThresholds.Defaults(snapshot);
        return new(machine.FactoryHallId, machine.ProductionLineId, machine.CycleTimeSeconds, snapshot,
            new SimulationThresholds(Find("Temperature") ?? defaults.Temperature,
                Find("Vibration") ?? defaults.Vibration, Find("Power") ?? Find("PowerLoadKw")));
    }

    private void RefreshWorkerConfiguration(Machine machine)
    {
        if (_workers.TryGetValue(machine.Id, out var worker))
        {
            worker.Configuration = Configuration(machine);
        }
    }

    private static IQueryable<Machine> Machines(ApplicationDbContext db) =>
        db.Machines.Include(m => m.SimulationProfile).Include(m => m.AlertThresholds);

    private static async Task<Machine> RequireMachine(ApplicationDbContext db, Guid id, SimulationActor actor, CancellationToken ct)
    {
        var machine = await Machines(db).SingleOrDefaultAsync(m => m.Id == id && m.IsActive, ct)
            ?? throw new SimulationRequestException(404, "Machine not found.");
        actor.RequireHall(machine.FactoryHallId);
        return machine;
    }

    private async Task<T> Command<T>(SimulationActor actor, Func<IServiceProvider, CancellationToken, Task<T>> action, CancellationToken ct)
    {
        actor.RequireAdmin();
        if (_shuttingDown)
        {
            throw new SimulationRequestException(503, "Simulation service is shutting down.");
        }

        await _gate.WaitAsync(ct);
        T result;
        try
        {
            using var scope = scopes.CreateScope();
            result = await action(scope.ServiceProvider, ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SimulationRequestException(409, "Data changed concurrently. Reload and retry.");
        }
        finally
        {
            _gate.Release();
        }
        await RecoverCoverageAfterChange(ct);
        return result;
    }

    private async Task RequireRedis(CancellationToken ct)
    {
        RedisAvailable = await stateStore.IsAvailableAsync(ct);
        if (!RedisAvailable)
        {
            throw new SimulationRequestException(503, "Redis is unavailable. Simulation cannot start.");
        }
    }

    private async Task StartLocked(IServiceProvider services, Machine machine, bool reset, CancellationToken ct)
    {
        if (IsRunning(machine.Id))
        {
            return;
        }

        await RequireRedis(ct);
        var configuration = Configuration(machine);
        var store = services.GetRequiredService<ISimulationCheckpointStore>();
        var saved = await store.ReadAsync(machine.Id, ct);
        var now = DateTimeOffset.UtcNow;
        MachineSimState state;
        if (saved is null || reset)
        {
            state = MachineSimState.CreateInitial(machine.Id, configuration.Profile, now, machine.Status, machine.TotalProduced)
                with
                {
                    TickNumber = saved?.TickNumber ?? 0,
                    Wear = saved?.Wear ?? 0
                };
        }
        else
        {
            state = saved with
            {
                LastTickAtUtc = now,
                ProfileVersion = configuration.Profile.Version,
                MachineStatus = machine.Status
            };
        }
        // Verify publication before committing the launch request. A failed start never enables an Offline machine.
        await stateStore.WriteAsync(state, ct);
        machine.SimulationEnabled = true;
        await store.SaveAsync(machine, state, Array.Empty<SimulationStatusChanged>(), ct);
        if (_workers.TryRemove(machine.Id, out var old))
        {
            Retire(old);
        }

        var worker = new Worker(machine.Id, configuration, state) { Running = true };
        _startErrors.TryRemove(machine.Id, out _);
        _workers[machine.Id] = worker;
        diagnostics.SetWorkerCount(_workers.Values.Count(w => w.Running));
        worker.Task = Task.Run(() => RunWorker(worker));
        await Broadcast(worker, ct);
    }

    private void Retire(Worker worker)
    {
        worker.Running = false;
        worker.Cancellation.Cancel();
        _retired.Add(worker);
    }

    private async Task RunWorker(Worker worker)
    {
        var ct = worker.Cancellation.Token;
        try
        {
            while (!ct.IsCancellationRequested && worker.Running)
            {
                await Task.Delay(worker.Configuration.Profile.TickIntervalMs, ct);
                await _gate.WaitAsync(ct);
                try
                {
                    if (!worker.Running || !_workers.TryGetValue(worker.Id, out var current) || current != worker)
                    {
                        return;
                    }

                    await AdvanceOrFaultLocked(worker, DateTimeOffset.UtcNow, ct);
                }
                finally
                {
                    _gate.Release();
                }
                await RecoverCoverageAfterChange(_automationLifetime);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested || _automationLifetime.IsCancellationRequested) { }
    }

    private bool ProductionAllowed(Guid? lineId) =>
        lineId is null || (_lineStatuses.TryGetValue(lineId.Value, out var status) && ProductionLinePolicy.IsProducing(status));

    private async Task AdvanceOrFaultLocked(Worker worker, DateTimeOffset now, CancellationToken ct)
    {
        try
        {
            await AdvanceLocked(worker, now, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await FaultLocked(worker, ex);
        }
    }

    private async Task AdvanceLocked(Worker worker, DateTimeOffset now, CancellationToken ct)
    {
        if (!worker.Running || now <= worker.State.LastTickAtUtc)
        {
            return;
        }

        var watch = Stopwatch.StartNew();
        var config = worker.Configuration;
        var context = new SimulationStepContext(worker.State.MachineStatus, ProductionAllowed(config.LineId),
            config.CycleTimeSeconds, config.Thresholds);
        var result = _physics.Step(worker.State, config.Profile, context, now, worker.Random);
        worker.Apply(result);
        if (worker.PendingEvents.Count > 0)
        {
            using var scope = scopes.CreateScope();
            await SaveWorkerLocked(scope.ServiceProvider, worker, ct);
        }

        await stateStore.WriteAsync(worker.State, ct);
        RedisAvailable = true;

        if ((now - worker.LastHistory).TotalSeconds >= _options.HistorySampleIntervalSeconds)
        {
            await EnqueueHistoryAsync(ToTelemetry(worker.State), ct);
            worker.LastHistory = now;
        }

        if ((now - worker.LastLive).TotalSeconds >= _options.LivePublishIntervalSeconds || result.StatusChanges.Count > 0)
        {
            await Broadcast(worker, ct);
        }

        diagnostics.RecordTick(watch.Elapsed.TotalMilliseconds);
    }

    public static TelemetryRead ToTelemetry(MachineSimState state) => new()
    {
        MachineId = state.MachineId,
        Timestamp = state.LastTickAtUtc.UtcDateTime,
        Temperature = (decimal)state.Temperature,
        Vibration = (decimal)state.Vibration,
        PowerLoadKw = (decimal)state.PowerLoadKw
    };

    private async Task Broadcast(Worker worker, CancellationToken ct)
    {
        try
        {
            var hallId = worker.Configuration.HallId;
            var subscribers = hub.Clients.Groups(TelemetryHub.MachineGroup(hallId, worker.Id), TelemetryHub.HallGroup(hallId));
            await subscribers.SendAsync("ReceiveTelemetry", worker.State, ct);
            worker.LastLive = DateTimeOffset.UtcNow;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Live telemetry delivery failed for {MachineId}", worker.Id);
        }
    }

    private async Task SaveWorkerLocked(IServiceProvider services, Worker worker, CancellationToken ct)
    {
        var db = services.GetRequiredService<ApplicationDbContext>();
        var machine = await db.Machines.SingleAsync(m => m.Id == worker.Id, ct);
        if (worker.DisableOnSave || worker.State.MachineStatus is MachineStatus.Offline or MachineStatus.Maintenance)
        {
            machine.SimulationEnabled = false;
        }

        machine.Status = worker.State.MachineStatus;
        machine.TotalProduced = worker.State.TotalProduced;
        await EvaluateLinesLocked(db, worker.Configuration.LineId, ct);
        await services.GetRequiredService<ISimulationCheckpointStore>().SaveAsync(machine, worker.State, worker.PendingEvents, ct);
        worker.PendingEvents.Clear();
        worker.DisableOnSave = false;
        worker.Dirty = false;
    }

    private async Task EvaluateLinesLocked(ApplicationDbContext db, Guid? lineId, CancellationToken ct)
    {
        var query = db.ProductionLines.Include(l => l.Machines).AsQueryable();
        if (lineId.HasValue)
        {
            query = query.Where(l => l.Id == lineId.Value);
        }

        foreach (var line in await query.ToListAsync(ct))
        {
            var states = line.Machines.Where(m => m.IsActive).Select(m =>
                (_workers.TryGetValue(m.Id, out var worker) ? worker.State.MachineStatus : m.Status, IsRunning(m.Id))).ToArray();
            var target = _forcedHalts.Contains(line.Id) ? ProductionLinePolicy.Halted : ProductionLinePolicy.Evaluate(line.Status, states);
            if (line.Status != target)
            {
                line.Status = target;
            }

            _lineStatuses[line.Id] = target;
        }
    }

    private async Task FaultLocked(Worker worker, Exception error)
    {
        worker.Running = false;
        worker.Error = "Simulation paused: " + error.Message;
        diagnostics.SetWorkerCount(_workers.Values.Count(w => w.Running));
        if (worker.Configuration.LineId is { } lineId)
        {
            _lineStatuses[lineId] = ProductionLinePolicy.Halted;
            _forcedHalts.Add(lineId);
        }
        logger.LogError(error, "Simulation worker {MachineId} failed", worker.Id);
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var scope = scopes.CreateScope();
            await SaveWorkerLocked(scope.ServiceProvider, worker, timeout.Token);
        }
        catch (Exception ex)
        {
            diagnostics.Failure(ex);
            logger.LogError(ex, "Final checkpoint failed for {MachineId}", worker.Id);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _automationLifetime = stoppingToken;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Reconcile(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                ServiceError = "Simulation reconciliation failed: " + ex.Message;
                logger.LogError(ex, "Simulation reconciliation failed");
            }
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_options.ReconcileIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task Reconcile(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            using var scope = scopes.CreateScope();
            var services = scope.ServiceProvider;
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machines = await Machines(db).ToListAsync(ct);
            foreach (var line in await db.ProductionLines.ToListAsync(ct))
            {
                // A crashed process cannot persist its workers' failure. Halt before restoring them,
                // so even a stale SQL Running flag never restarts production without an operator.
                if (!_initialized && ProductionLinePolicy.IsProducing(line.Status))
                {
                    line.Status = ProductionLinePolicy.Halted;
                    _forcedHalts.Add(line.Id);
                }
                _lineStatuses[line.Id] = line.Status;
            }
            if (!_initialized)
            {
                await db.SaveChangesAsync(ct);
                _initialized = true;
            }
            RedisAvailable = await stateStore.IsAvailableAsync(ct);

            foreach (var machine in machines)
            {
                await ReconcileMachineLocked(services, db, machine, ct);
            }
            await EvaluateLinesLocked(db, null, ct);
            await db.SaveChangesAsync(ct);
            ServiceError = RedisAvailable ? null : "Redis is unavailable; launch requests are waiting.";
            for (var i = _retired.Count - 1; i >= 0; i--)
            {
                if (_retired[i].Task.IsCompleted)
                {
                    _retired[i].Cancellation.Dispose();
                    _retired.RemoveAt(i);
                }
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task ReconcileMachineLocked(IServiceProvider services, ApplicationDbContext db, Machine machine, CancellationToken ct)
    {
        _workers.TryGetValue(machine.Id, out var worker);
        if (worker is { Running: false, Dirty: true })
        {
            try
            {
                await SaveWorkerLocked(services, worker, ct);
            }
            catch (Exception ex)
            {
                worker.Error = ex.Message;
                diagnostics.Failure(ex);
                return;
            }
        }
        var allowed = machine.IsActive && machine.TelemetrySource == TelemetrySource.Simulated &&
            machine.SimulationEnabled &&
            machine.Status is not (MachineStatus.Offline or MachineStatus.Maintenance);
        if (!allowed)
        {
            if (worker is not null)
            {
                await StopLocked(services, machine, machine.Status, ct);
            }
            else if (machine.SimulationEnabled)
            {
                machine.SimulationEnabled = false;
                await db.SaveChangesAsync(ct);
            }
            if (!machine.IsActive)
            {
                try
                {
                    await stateStore.DeleteAsync(machine.Id, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogDebug(ex, "Redis cleanup delayed");
                }
            }
            return;
        }
        if (worker is { Running: true })
        {
            if (!RedisAvailable)
            {
                await FaultLocked(worker, new InvalidOperationException("Redis is unavailable."));
                return;
            }
            if (worker.Configuration.HallId != machine.FactoryHallId || worker.Configuration.LineId != machine.ProductionLineId)
            {
                await StopLocked(services, machine, machine.Status, ct);
                return;
            }
            try
            {
                worker.Configuration = Configuration(machine);
            }
            catch (Exception ex)
            {
                await FaultLocked(worker, ex);
                return;
            }
            // Only the application service normally changes status; reconcile catches external SQL edits.
            if (machine.Status != worker.State.MachineStatus)
            {
                worker.State = worker.State with
                {
                    MachineStatus = machine.Status
                };
            }
        }
        else if (RedisAvailable)
        {
            try
            {
                await StartLocked(services, machine, reset: false, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                if (worker is not null)
                {
                    worker.Error = ex.Message;
                }

                _startErrors[machine.Id] = ex.Message;
                logger.LogError(ex, "Could not restore simulation {MachineId}", machine.Id);
            }
        }
    }

    public async Task CheckpointAllAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            foreach (var worker in _workers.Values.Where(w => w.Running && w.Dirty))
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    await SaveWorkerLocked(scope.ServiceProvider, worker, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    diagnostics.Failure(ex);
                    await FaultLocked(worker, ex);
                }
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _shuttingDown = true;
        await base.StopAsync(cancellationToken);
        await _gate.WaitAsync(cancellationToken);
        Worker[] workers;
        try
        {
            workers = _workers.Values.Concat(_retired).Distinct().ToArray();
            foreach (var worker in workers)
            {
                worker.Running = false;
                worker.Cancellation.Cancel();
            }
            diagnostics.SetWorkerCount(0);
            foreach (var worker in _workers.Values)
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    await SaveWorkerLocked(scope.ServiceProvider, worker, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Shutdown checkpoint failed for {MachineId}", worker.Id);
                }
            }
            history.Complete();
        }
        finally
        {
            _gate.Release();
        }
        await Task.WhenAll(workers.Select(w => w.Task)).WaitAsync(cancellationToken);
        foreach (var worker in workers)
        {
            worker.Cancellation.Dispose();
        }
    }
}
