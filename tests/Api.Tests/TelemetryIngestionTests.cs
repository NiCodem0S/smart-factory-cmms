using System.Collections.Concurrent;
using AutoMapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Mappers;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public sealed class TelemetryIngestionTests
{
    private sealed class InMemoryStateStore : ISimulationStateStore
    {
        public readonly ConcurrentDictionary<Guid, MachineSimState> States = new();
        public Task<bool> IsAvailableAsync(CancellationToken ct = default) => Task.FromResult(true);
        public Task<MachineSimState?> ReadAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(States.GetValueOrDefault(id));
        public Task WriteAsync(MachineSimState state, CancellationToken ct = default)
        {
            States[state.MachineId] = state;
            return Task.CompletedTask;
        }
        public Task DeleteAsync(Guid id, CancellationToken ct = default)
        {
            States.TryRemove(id, out _);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeHistoryQueue : ITelemetryHistoryQueue
    {
        private readonly ConcurrentQueue<(string EntryId, TelemetryRead Sample)> _queue = new();
        private long _seq;
        public readonly ConcurrentBag<TelemetryRead> Enqueued = new();
        public readonly ConcurrentBag<string> Acknowledged = new();

        public ValueTask EnqueueAsync(TelemetryRead sample, CancellationToken ct = default)
        {
            var id = $"{Interlocked.Increment(ref _seq)}-0";
            _queue.Enqueue((id, sample));
            Enqueued.Add(sample);
            return ValueTask.CompletedTask;
        }

        public Task<QueuedTelemetryBatch> ReadBatchAsync(int maxCount, CancellationToken ct = default)
        {
            var samples = new List<TelemetryRead>();
            var ids = new List<string>();
            while (samples.Count < maxCount && _queue.TryDequeue(out var item))
            {
                samples.Add(item.Sample);
                ids.Add(item.EntryId);
            }
            return Task.FromResult(new QueuedTelemetryBatch(samples, ids, FromRedisStream: true));
        }

        public Task AcknowledgeAsync(IReadOnlyList<string> streamEntryIds, CancellationToken ct = default)
        {
            foreach (var id in streamEntryIds) Acknowledged.Add(id);
            return Task.CompletedTask;
        }

        public Task<long> GetApproximateLengthAsync(CancellationToken ct = default) =>
            Task.FromResult((long)_queue.Count);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public ServiceProvider Services { get; }
        public InMemoryStateStore Redis { get; } = new();
        public FakeHistoryQueue Queue { get; } = new();
        public TelemetryIngestionService Ingestion => Services.GetRequiredService<TelemetryIngestionService>();
        public DeviceWatchdogService Watchdog => Services.GetRequiredService<DeviceWatchdogService>();
        public SimulationOrchestrator Orchestrator => Services.GetRequiredService<SimulationOrchestrator>();
        public TelemetryPersister Persister => Services.GetRequiredService<TelemetryPersister>();

        public Guid HallId { get; } = Guid.NewGuid();
        public Guid LineId { get; } = Guid.NewGuid();
        public Guid RealMachineId { get; } = Guid.NewGuid();
        public string RawDeviceKey { get; }
        public SimulationActor Admin => new(UserRole.HallAdmin, HallId, true);

        private Fixture(string rawKey)
        {
            RawDeviceKey = rawKey;
            var services = new ServiceCollection();
            var dbName = Guid.NewGuid().ToString();
            services.AddLogging();
            services.AddSignalR();
            services.AddSingleton<IOptions<SimulationOptions>>(Options.Create(new SimulationOptions
            {
                HistorySampleIntervalSeconds = 10,
                HistoryBatchSize = 50,
                CheckpointIntervalSeconds = 15,
                ReconcileIntervalSeconds = 1
            }));
            services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(dbName));
            services.AddSingleton<ISimulationStateStore>(Redis);
            services.AddSingleton<ITelemetryHistoryQueue>(Queue);
            services.AddSingleton<SimulationDiagnostics>();
            services.AddSingleton<TelemetryChannel>();
            services.AddScoped<ISimulationCheckpointStore, SimulationCheckpointStore>();
            services.AddSingleton<SimulationOrchestrator>();
            services.AddSingleton<TelemetryIngestionService>();
            services.AddSingleton<DeviceWatchdogService>();
            services.AddSingleton<TelemetryPersister>();
            services.AddSingleton<IMapper>(new Mapper(
                new MapperConfiguration(c => c.AddProfile<MachineMappingProfile>(), NullLoggerFactory.Instance)));
            Services = services.BuildServiceProvider();
        }

        public static async Task<Fixture> CreateAsync(int offlineTimeoutSeconds = 30)
        {
            var (raw, hash, prefix) = DeviceKeyService.Generate();
            var fixture = new Fixture(raw);
            await fixture.DbAsync(async db =>
            {
                db.FactoryHalls.Add(new FactoryHall { Id = fixture.HallId, Name = "IoT Hall" });
                db.ProductionLines.Add(new ProductionLine
                {
                    Id = fixture.LineId,
                    FactoryHallId = fixture.HallId,
                    Name = "IoT Line 1",
                    Status = ProductionLinePolicy.Halted
                });
                db.Machines.Add(new Machine
                {
                    Id = fixture.RealMachineId,
                    Name = "CNC Press PLC #1",
                    Category = "Press",
                    SerialNumber = "PLC-001",
                    FactoryHallId = fixture.HallId,
                    ProductionLineId = fixture.LineId,
                    Status = MachineStatus.Offline,
                    TelemetrySource = TelemetrySource.RealDevice,
                    ExternalDeviceId = "plc-hall1-press01",
                    DeviceKeyHash = hash,
                    DeviceKeyPrefix = prefix,
                    ExpectedIntervalSeconds = 5,
                    OfflineTimeoutSeconds = offlineTimeoutSeconds,
                    SupportedMetrics = "[\"Temperature\",\"Vibration\",\"PowerLoadKw\",\"ProductionCounter\"]",
                    AlertThresholds = new List<AlertThreshold>
                    {
                        new() { MetricType = "Temperature", WarningValue = 75m, CriticalValue = 90m },
                        new() { MetricType = "Vibration", WarningValue = 4.0m, CriticalValue = 6.0m }
                    }
                });
                await db.SaveChangesAsync();
            });
            return fixture;
        }

        public async Task DbAsync(Func<ApplicationDbContext, Task> action)
        {
            using var scope = Services.CreateScope();
            await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        }

        public async Task<T> QueryAsync<T>(Func<ApplicationDbContext, Task<T>> action)
        {
            using var scope = Services.CreateScope();
            return await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        }

        public async ValueTask DisposeAsync()
        {
            await Services.DisposeAsync();
        }
    }

    [Fact]
    public async Task MissingOrInvalidDeviceKeyReturns401()
    {
        await using var f = await Fixture.CreateAsync();
        var payload = new TelemetryIngestRequestDto { Temperature = 55.2 };

        var missing = await Assert.ThrowsAsync<SimulationRequestException>(() => f.Ingestion.IngestAsync(null, payload));
        Assert.Equal(401, missing.StatusCode);

        var invalid = await Assert.ThrowsAsync<SimulationRequestException>(() => f.Ingestion.IngestAsync("sf_dev_wrong", payload));
        Assert.Equal(401, invalid.StatusCode);
    }

    [Fact]
    public async Task SingleReadingTransitionsOfflineToRunningUpdatesRedisAndQueuesHistory()
    {
        await using var f = await Fixture.CreateAsync();

        var result = await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            Temperature = 62.4,
            Vibration = 1.25,
            PowerLoadKw = 14.8,
            ProducedDelta = 3
        });

        Assert.Equal(f.RealMachineId, result.MachineId);
        Assert.Equal(1, result.AcceptedSamples);
        Assert.Equal(1, result.QueuedHistorySamples);
        Assert.Equal("Running", result.Status);
        Assert.Equal(3, result.TotalProduced);

        var machine = await f.QueryAsync(db => db.Machines.SingleAsync(m => m.Id == f.RealMachineId));
        Assert.Equal(MachineStatus.Running, machine.Status);
        Assert.Equal(3, machine.TotalProduced);
        Assert.Empty(await f.QueryAsync(db => db.SimulationProfiles.ToListAsync()));

        Assert.True(f.Redis.States.TryGetValue(f.RealMachineId, out var state));
        Assert.Equal(62.4, state.Temperature, 2);
        Assert.Equal(1.25, state.Vibration, 2);
        Assert.Equal(14.8, state.PowerLoadKw, 2);
        Assert.Equal(MachineStatus.Running, state.MachineStatus);
        Assert.Single(f.Queue.Enqueued);
    }

    [Fact]
    public async Task BatchSamplesThrottleFlatReadingsAndQueueDeadbandJumps()
    {
        await using var f = await Fixture.CreateAsync();
        var t0 = DateTimeOffset.UtcNow.AddSeconds(-4);

        var result = await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            Samples = new List<TelemetryIngestSampleDto>
            {
                new() { TimestampUtc = t0, Temperature = 60.0, Vibration = 1.0, PowerLoadKw = 12.0, TotalProduced = 100 },
                new() { TimestampUtc = t0.AddSeconds(1), Temperature = 60.1, Vibration = 1.02, PowerLoadKw = 12.2, ProducedDelta = 1 },
                new() { TimestampUtc = t0.AddSeconds(2), Temperature = 60.2, Vibration = 1.04, PowerLoadKw = 12.1, ProducedDelta = 1 },
                new() { TimestampUtc = t0.AddSeconds(3), Temperature = 61.5, Vibration = 1.05, PowerLoadKw = 12.3, ProducedDelta = 2 }
            }
        });

        Assert.Equal(4, result.AcceptedSamples);
        // Sample 0 queued (first write), samples 1 & 2 suppressed (< 0.5°C deadband within 10s), sample 3 queued (+1.5°C jump)
        Assert.Equal(2, result.QueuedHistorySamples);
        Assert.Equal(104, result.TotalProduced);
        Assert.Equal(2, f.Queue.Enqueued.Count);
    }

    [Fact]
    public async Task ThresholdBreachPersistsIncidentImmediatelyAndHaltsLine()
    {
        await using var f = await Fixture.CreateAsync();
        var ts = DateTimeOffset.UtcNow.AddSeconds(-2);

        // Bring online and start line
        await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            TimestampUtc = ts,
            Temperature = 60.0,
            Vibration = 1.0
        });
        await f.DbAsync(async db =>
        {
            var line = await db.ProductionLines.SingleAsync(l => l.Id == f.LineId);
            line.Status = ProductionLinePolicy.Running;
            await db.SaveChangesAsync();
        });

        // Push critical overheating reading
        var critTs = ts.AddSeconds(1);
        var result = await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            TimestampUtc = critTs,
            Temperature = 94.5,
            Vibration = 1.2
        });

        Assert.Equal("Error", result.Status);
        Assert.Equal(0, result.QueuedHistorySamples); // Persisted directly via Critical Path

        var incidents = await f.QueryAsync(db => db.Incidents.Where(i => i.MachineId == f.RealMachineId).ToListAsync());
        Assert.Single(incidents);
        Assert.Equal("Critical", incidents[0].Severity);
        Assert.Equal("Active", incidents[0].Status);

        var criticalReads = await f.QueryAsync(db => db.TelemetryRead.Where(t => t.MachineId == f.RealMachineId).ToListAsync());
        Assert.Single(criticalReads);
        Assert.Equal(94.5m, criticalReads[0].Temperature);

        var lineStatus = await f.QueryAsync(db => db.ProductionLines.Where(l => l.Id == f.LineId).Select(l => l.Status).SingleAsync());
        Assert.Equal(ProductionLinePolicy.Halted, lineStatus);

        // Idempotent retry of the exact same timestamp must not duplicate Incident or TelemetryRead
        await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            TimestampUtc = critTs,
            Temperature = 94.5,
            Vibration = 1.2
        });
        Assert.Single(await f.QueryAsync(db => db.Incidents.Where(i => i.MachineId == f.RealMachineId).ToListAsync()));
        Assert.Single(await f.QueryAsync(db => db.TelemetryRead.Where(t => t.MachineId == f.RealMachineId).ToListAsync()));
    }

    [Fact]
    public async Task MaintenanceSuppressesFaultAlertsWhileStreamingLiveState()
    {
        await using var f = await Fixture.CreateAsync();

        await f.Orchestrator.MaintenanceAsync(f.RealMachineId, f.Admin, complete: false);
        var result = await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            Temperature = 98.0,
            Vibration = 7.2
        });

        Assert.Equal("Maintenance", result.Status);
        Assert.Empty(await f.QueryAsync(db => db.Incidents.ToListAsync()));
        Assert.Equal(98.0, f.Redis.States[f.RealMachineId].Temperature, 2);

        // Completing repair returns RealDevice to Offline until healthy readings arrive
        await f.Orchestrator.MaintenanceAsync(f.RealMachineId, f.Admin, complete: true);
        Assert.Equal(MachineStatus.Offline, await f.QueryAsync(db => db.Machines.Where(m => m.Id == f.RealMachineId).Select(m => m.Status).SingleAsync()));

        var resumed = await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto { Temperature = 58.0, Vibration = 1.1 });
        Assert.Equal("Running", resumed.Status);
    }

    [Fact]
    public async Task RealDeviceRejectsSimulationCommandsAndKeyRotationRevokesOldKey()
    {
        await using var f = await Fixture.CreateAsync();

        Assert.Equal(409, (await Assert.ThrowsAsync<SimulationRequestException>(() =>
            f.Orchestrator.StartAsync(f.RealMachineId, f.Admin, startMachine: true))).StatusCode);
        Assert.Equal(409, (await Assert.ThrowsAsync<SimulationRequestException>(() =>
            f.Orchestrator.StopAsync(f.RealMachineId, f.Admin, stopMachine: true))).StatusCode);
        Assert.Equal(409, (await Assert.ThrowsAsync<SimulationRequestException>(() =>
            f.Orchestrator.TriggerScenarioAsync(f.RealMachineId, f.Admin, SimulationScenario.Overheating))).StatusCode);
        Assert.Equal(409, (await Assert.ThrowsAsync<SimulationRequestException>(() =>
            f.Orchestrator.ApplyPresetAsync(f.RealMachineId, f.Admin, new ApplySimulationPresetDto { Preset = SimulationPreset.Stable, Version = 1 }))).StatusCode);

        var (newKey, prefix) = await f.Orchestrator.RotateDeviceKeyAsync(f.RealMachineId, f.Admin);
        Assert.StartsWith("sf_dev_", newKey);
        Assert.StartsWith("sf_dev_", prefix);

        // Old key must now be rejected
        var oldRejected = await Assert.ThrowsAsync<SimulationRequestException>(() =>
            f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto { Temperature = 55.0 }));
        Assert.Equal(401, oldRejected.StatusCode);

        // New key must succeed
        var accepted = await f.Ingestion.IngestAsync(newKey, new TelemetryIngestRequestDto { Temperature = 55.0 });
        Assert.Equal("Running", accepted.Status);
    }

    [Fact]
    public async Task WatchdogMarksStaleRealDeviceOfflineAndHaltsLine()
    {
        await using var f = await Fixture.CreateAsync(offlineTimeoutSeconds: 30);
        var lastSeen = DateTimeOffset.UtcNow;

        await f.Ingestion.IngestAsync(f.RawDeviceKey, new TelemetryIngestRequestDto
        {
            TimestampUtc = lastSeen,
            Temperature = 60.0,
            Vibration = 1.0,
            PowerLoadKw = 12.0
        });
        await f.DbAsync(async db =>
        {
            var line = await db.ProductionLines.SingleAsync(l => l.Id == f.LineId);
            line.Status = ProductionLinePolicy.Running;
            await db.SaveChangesAsync();
        });

        // Within 30s timeout -> still online
        var earlySweep = await f.Watchdog.SweepAsync(lastSeen.AddSeconds(15));
        Assert.Equal(0, earlySweep);
        Assert.Equal(MachineStatus.Running, await f.QueryAsync(db => db.Machines.Where(m => m.Id == f.RealMachineId).Select(m => m.Status).SingleAsync()));

        // Past 30s timeout -> marked Offline & line halted
        var lateSweep = await f.Watchdog.SweepAsync(lastSeen.AddSeconds(45));
        Assert.Equal(1, lateSweep);
        Assert.Equal(MachineStatus.Offline, await f.QueryAsync(db => db.Machines.Where(m => m.Id == f.RealMachineId).Select(m => m.Status).SingleAsync()));
        Assert.Equal(ProductionLinePolicy.Halted, await f.QueryAsync(db => db.ProductionLines.Where(l => l.Id == f.LineId).Select(l => l.Status).SingleAsync()));
        Assert.Equal(MachineStatus.Offline, f.Redis.States[f.RealMachineId].MachineStatus);
    }

    [Fact]
    public async Task TelemetryPersisterDrainsStreamQueueAndAcknowledgesAfterSqlCommit()
    {
        await using var f = await Fixture.CreateAsync();
        var now = DateTime.UtcNow;
        var sharedId = Guid.NewGuid();

        await f.Queue.EnqueueAsync(new TelemetryRead { Id = sharedId, MachineId = f.RealMachineId, Timestamp = now.AddSeconds(-2), Temperature = 61.0m });
        await f.Queue.EnqueueAsync(new TelemetryRead { Id = sharedId, MachineId = f.RealMachineId, Timestamp = now.AddSeconds(-2), Temperature = 61.0m }); // Duplicate idempotency check
        await f.Queue.EnqueueAsync(new TelemetryRead { Id = Guid.NewGuid(), MachineId = f.RealMachineId, Timestamp = now.AddSeconds(-1), Temperature = 62.0m });

        await f.Persister.StartAsync(CancellationToken.None);
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (f.Queue.Acknowledged.Count < 3 && DateTime.UtcNow < deadline)
        {
            await Task.Delay(50);
        }
        await f.Persister.StopAsync(CancellationToken.None);

        Assert.Equal(3, f.Queue.Acknowledged.Count);
        var rows = await f.QueryAsync(db => db.TelemetryRead.Where(t => t.MachineId == f.RealMachineId).ToListAsync());
        Assert.Equal(2, rows.Count);
    }
}
