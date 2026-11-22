using System.ComponentModel.DataAnnotations;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

public sealed partial class SimulationOrchestrator
{
    public Task<MachineSimState> TriggerScenarioAsync(Guid id, SimulationActor actor, SimulationScenario scenario, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var machine = await RequireMachine(services.GetRequiredService<ApplicationDbContext>(), id, actor, token);
            if (!Enum.IsDefined(scenario))
            {
                throw new SimulationRequestException(400, "Unknown simulation scenario.");
            }

            if (!machine.SimulationEnabled || !_workers.TryGetValue(id, out var worker) || !worker.Running)
            {
                throw new SimulationRequestException(409, "Start the machine and its simulation before triggering a scenario.");
            }

            await RequireRedis(token);
            try
            {
                await AdvanceLocked(worker, DateTimeOffset.UtcNow, token);
                var config = worker.Configuration;
                var result = SimulationScenarios.Apply(worker.State, config.Profile, config.Thresholds, scenario,
                    ProductionAllowed(config.LineId), DateTimeOffset.UtcNow);
                worker.Apply(result);
                await SaveWorkerLocked(services, worker, token);
                // Also retain commands without a status transition (e.g. repeated heating or Normal).
                if (!result.StatusChanges.Any(c => c.NewStatus is MachineStatus.Warning or MachineStatus.Error))
                {
                    await history.AddTelemetryAsync(ToTelemetry(worker.State), token);
                }

                await stateStore.WriteAsync(worker.State, token);
                await Broadcast(worker, token);
                return worker.State;
            }
            catch (SimulationRequestException)
            {
                throw;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                await FaultLocked(worker, ex);
                throw;
            }
        }, ct);

    public Task<Machine> CreateMachineAsync(Machine machine, SimulationActor actor, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            actor.RequireHall(machine.FactoryHallId);
            await ValidateAssignmentAsync(db, machine.FactoryHallId, machine.ProductionLineId, token);
            ValidateThresholds(machine.AlertThresholds.Select(t => new CreateAlertThresholdDto
            {
                MetricType = t.MetricType,
                WarningValue = t.WarningValue,
                CriticalValue = t.CriticalValue
            }).ToList());
            machine.Status = MachineStatus.Offline;
            machine.SimulationEnabled = false;
            db.Machines.Add(machine);
            await EvaluateLinesLocked(db, machine.ProductionLineId, token);
            await db.SaveChangesAsync(token);
            return machine;
        }, ct);

    public Task<Machine> StartAsync(Guid id, SimulationActor actor, bool startMachine, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            if (_workers.TryGetValue(id, out var dirty) && dirty.Dirty && !dirty.Running)
            {
                await SaveWorkerLocked(services, dirty, token);
            }

            if (machine.Status is MachineStatus.Error or MachineStatus.Maintenance)
            {
                throw new SimulationRequestException(409, "Resolve the fault or finish maintenance before starting.");
            }

            if (!startMachine && machine.Status == MachineStatus.Offline)
            {
                throw new SimulationRequestException(409, "Machine is Offline. Use Start machine first.");
            }

            var reset = machine.Status == MachineStatus.Offline;
            if (startMachine && reset)
            {
                machine.Status = MachineStatus.Running;
            }

            if (IsRunning(id))
            {
                machine.SimulationEnabled = true;
                await db.SaveChangesAsync(token);
            }
            else
            {
                await StartLocked(services, machine, reset, token);
            }

            return machine;
        }, ct);

    public Task<Machine> StopAsync(Guid id, SimulationActor actor, bool stopMachine, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var machine = await RequireMachine(services.GetRequiredService<ApplicationDbContext>(), id, actor, token);
            if (stopMachine && machine.Status is MachineStatus.Error or MachineStatus.Maintenance)
            {
                throw new SimulationRequestException(409, "Complete the maintenance repair before switching the machine to Offline.");
            }

            await StopLocked(services, machine, stopMachine ? MachineStatus.Offline : null, token);
            return machine;
        }, ct);

    private async Task StopLocked(IServiceProvider services, Machine machine, MachineStatus? targetStatus, CancellationToken ct, bool resetAfterRepair = false)
    {
        _workers.TryGetValue(machine.Id, out var worker);
        if (worker is { Running: true })
        {
            await AdvanceOrFaultLocked(worker, DateTimeOffset.UtcNow, ct);
        }
        if (worker is not null)
        {
            worker.Running = false;
            worker.Cancellation.Cancel();
        }
        var store = services.GetRequiredService<ISimulationCheckpointStore>();
        var state = worker?.State ?? await store.ReadAsync(machine.Id, ct);
        var status = targetStatus ?? state?.MachineStatus ?? machine.Status;
        machine.SimulationEnabled = false;
        machine.Status = status;
        if (machine.ProductionLineId is { } lineId)
        {
            _forcedHalts.Add(lineId);
            _lineStatuses[lineId] = ProductionLinePolicy.Halted;
        }
        if (state is not null)
        {
            if (resetAfterRepair)
            {
                var profile = Configuration(machine).Profile;
                var initial = MachineSimState.CreateInitial(machine.Id, profile, DateTimeOffset.UtcNow, status, state.TotalProduced);
                state = initial with { TickNumber = state.TickNumber, Wear = 0 };
            }
            else
            {
                state = state with { MachineStatus = status };
            }

            if (worker is not null)
            {
                worker.State = state;
                worker.Dirty = true;
                worker.DisableOnSave = true;
                await SaveWorkerLocked(services, worker, ct);
            }
            else
            {
                await EvaluateLinesLocked(services.GetRequiredService<ApplicationDbContext>(), machine.ProductionLineId, ct);
                await store.SaveAsync(machine, state, Array.Empty<SimulationStatusChanged>(), ct);
            }
            try
            {
                await stateStore.WriteAsync(state, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                RedisAvailable = false;
                logger.LogWarning(ex, "Stopped snapshot could not be published for {MachineId}", machine.Id);
            }
        }
        else
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            await EvaluateLinesLocked(db, machine.ProductionLineId, ct);
            await db.SaveChangesAsync(ct);
        }
        if (_workers.TryRemove(machine.Id, out var removed))
        {
            Retire(removed);
        }

        diagnostics.SetWorkerCount(_workers.Values.Count(w => w.Running));
        _startErrors.TryRemove(machine.Id, out _);
    }

    public Task<Machine> MaintenanceAsync(Guid id, SimulationActor actor, bool complete, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            if (complete && machine.Status != MachineStatus.Maintenance)
            {
                throw new SimulationRequestException(409, "Machine must be in Maintenance to complete a repair.");
            }
            // Operator maintenance cancels scheduled recovery and remains under operator control.
            machine.AutomaticRepairAtUtc = null;
            if (complete)
            {
                await ResolveSimulationIncidents(db, id, token);
            }

            await StopLocked(services, machine, complete ? MachineStatus.Offline : MachineStatus.Maintenance, token, complete);
            return machine;
        }, ct);

    private static async Task ResolveSimulationIncidents(ApplicationDbContext db, Guid machineId, CancellationToken ct)
    {
        var incidents = await db.Incidents
            .Where(i => i.MachineId == machineId && i.Status == "Active" && i.Message.StartsWith("Simulation:"))
            .ToListAsync(ct);
        foreach (var incident in incidents)
        {
            incident.Status = "Resolved";
        }
    }

    public Task UpdateProfileAsync(Guid id, SimulationActor actor, UpdateSimulationProfileDto dto, CancellationToken ct = default) =>
        ChangeProfile(id, actor, dto.Version, dto, SimulationPreset.Custom, ct);

    public Task ApplyPresetAsync(Guid id, SimulationActor actor, ApplySimulationPresetDto dto, CancellationToken ct = default) =>
        ChangeProfile(id, actor, dto.Version, null, dto.Preset ?? throw new SimulationRequestException(400, "Preset is required."), ct);

    private Task<Machine> ChangeProfile(Guid id, SimulationActor actor, long expectedVersion, SimulationParameters? parameters, SimulationPreset preset, CancellationToken ct) =>
        Command(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            var profile = machine.SimulationProfile ?? throw new SimulationRequestException(409, "Machine profile is missing.");
            if (profile.Version != expectedVersion)
            {
                throw new SimulationRequestException(409, "Profile changed. Reload before saving.");
            }

            var settings = parameters ?? SimulationPresets.Create(preset, profile);
            Validator.ValidateObject(settings, new ValidationContext(settings), true);
            foreach (var property in typeof(SimulationParameters).GetProperties().Where(p => p.CanWrite))
            {
                property.SetValue(profile, property.GetValue(settings));
            }

            profile.Preset = preset;
            SimulationProfileFactory.SynchronizeNominalProperties(machine);
            await db.SaveChangesAsync(token);
            RefreshWorkerConfiguration(machine);
            return machine;
        }, ct);

    public Task<Machine?> EditMachineAsync(Guid id, SimulationActor actor, UpdateMachineDto dto, CancellationToken ct = default) =>
        Command<Machine?>(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            actor.RequireHall(dto.FactoryHallId);
            await ValidateAssignmentAsync(db, dto.FactoryHallId, dto.ProductionLineId, token);
            if ((IsRunning(id) || machine.SimulationEnabled) && (machine.FactoryHallId != dto.FactoryHallId || machine.ProductionLineId != dto.ProductionLineId))
            {
                throw new SimulationRequestException(409, "Stop the machine before changing its hall or production line.");
            }

            if (dto.Status.HasValue && dto.Status.Value != machine.Status)
            {
                if (dto.Status == MachineStatus.Offline && machine.Status is MachineStatus.Error or MachineStatus.Maintenance)
                {
                    throw new SimulationRequestException(409, "Complete the maintenance repair before switching the machine to Offline.");
                }

                if (dto.Status is MachineStatus.Offline or MachineStatus.Maintenance)
                {
                    machine.AutomaticRepairAtUtc = null;
                    await StopLocked(services, machine, dto.Status, token);
                }
                else
                {
                    throw new SimulationRequestException(409, "Use the machine start or maintenance actions to change its operational status.");
                }
            }
            var profile = machine.SimulationProfile ?? throw new SimulationRequestException(409, "Machine profile is missing.");
            if (dto.NormTemp != profile.NormalTemperature || dto.BaseVib != profile.BaseVibration || dto.NormPower != profile.NormalPowerKw)
            {
                if (dto.SimulationProfileVersion != profile.Version)
                {
                    throw new SimulationRequestException(409, "Nominal parameters changed. Reload the machine before saving.");
                }

                profile.NormalTemperature = dto.NormTemp;
                profile.BaseVibration = dto.BaseVib;
                profile.NormalPowerKw = dto.NormPower;
                profile.Preset = SimulationPreset.Custom;
                Validator.ValidateObject(profile, new ValidationContext(profile), true);
            }
            services.GetRequiredService<IMapper>().Map(dto, machine);
            SimulationProfileFactory.SynchronizeNominalProperties(machine);
            ValidateThresholds(dto.AlertThresholds);
            ApplyThresholds(db, machine, dto.AlertThresholds);
            await EvaluateLinesLocked(db, null, token);
            await db.SaveChangesAsync(token);
            RefreshWorkerConfiguration(machine);
            return machine;
        }, ct);

    public Task<bool> UpdateThresholdsAsync(Guid id, SimulationActor actor, List<CreateAlertThresholdDto> thresholds, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            ValidateThresholds(thresholds);
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            ApplyThresholds(db, machine, thresholds);
            await db.SaveChangesAsync(token);
            RefreshWorkerConfiguration(machine);
            return true;
        }, ct);

    private static void ApplyThresholds(ApplicationDbContext db, Machine machine, List<CreateAlertThresholdDto> thresholds)
    {
        foreach (var threshold in thresholds)
        {
            var entry = machine.AlertThresholds.FirstOrDefault(t => t.MetricType == threshold.MetricType);
            if (entry is null)
            {
                entry = new AlertThreshold { Machine = machine, MachineId = machine.Id, MetricType = threshold.MetricType };
                db.AlertThresholds.Add(entry);
            }

            entry.WarningValue = threshold.WarningValue;
            entry.CriticalValue = threshold.CriticalValue;
        }
    }

    public static void ValidateThresholds(List<CreateAlertThresholdDto>? thresholds)
    {
        if (thresholds is null || thresholds.Select(t => t.MetricType).Distinct().Count() != thresholds.Count)
        {
            throw new SimulationRequestException(400, "Threshold metrics must be unique.");
        }

        foreach (var threshold in thresholds)
        {
            Validator.ValidateObject(threshold, new ValidationContext(threshold), true);
        }
    }

    public static async Task ValidateAssignmentAsync(ApplicationDbContext db, Guid hallId, Guid? lineId, CancellationToken ct)
    {
        if (!await db.FactoryHalls.AnyAsync(h => h.Id == hallId, ct))
        {
            throw new SimulationRequestException(404, "Factory hall not found.");
        }

        if (lineId.HasValue && !await db.ProductionLines.AnyAsync(l => l.Id == lineId && l.FactoryHallId == hallId, ct))
        {
            throw new SimulationRequestException(400, "Production line must belong to the machine's hall.");
        }
    }

    public Task<Machine?> DeleteMachineAsync(Guid id, SimulationActor actor, CancellationToken ct = default) =>
        Command<Machine?>(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var machine = await RequireMachine(db, id, actor, token);
            await StopLocked(services, machine, MachineStatus.Offline, token);
            machine.IsActive = false;
            await db.SaveChangesAsync(token);
            try
            {
                await stateStore.DeleteAsync(id, token);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Redis deletion delayed for {MachineId}", id);
            }
            return machine;
        }, ct);

    public Task<ProductionLine> SetLineAsync(Guid id, SimulationActor actor, bool start, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            var db = services.GetRequiredService<ApplicationDbContext>();
            var line = await db.ProductionLines.Include(l => l.Machines).SingleOrDefaultAsync(l => l.Id == id, token)
                ?? throw new SimulationRequestException(404, "Production line not found.");
            actor.RequireHall(line.FactoryHallId);
            var now = DateTimeOffset.UtcNow;
            foreach (var worker in _workers.Values.Where(w => w.Running && w.Configuration.LineId == id))
            {
                await AdvanceOrFaultLocked(worker, now, token);
            }
            if (start)
            {
                await RequireRedis(token);
                var machines = line.Machines.Where(m => m.IsActive).ToArray();
                if (machines.Length == 0)
                {
                    throw new SimulationRequestException(409, "Production line has no active machines.");
                }

                foreach (var machine in machines)
                {
                    if (!IsReadyForProduction(machine.Id))
                    {
                        throw new SimulationRequestException(409, $"Start machine '{machine.Name}' and its simulation before starting the line; resolve any fault first.");
                    }
                }

                _forcedHalts.Remove(id);
                var warning = machines.Any(m => _workers[m.Id].State.MachineStatus == MachineStatus.Warning);
                var status = warning ? ProductionLinePolicy.Warning : ProductionLinePolicy.Running;
                if (line.Status != status)
                {
                    line.Status = status;
                }
            }
            else
            {
                _forcedHalts.Add(id);
                if (line.Status != ProductionLinePolicy.Halted)
                {
                    line.Status = ProductionLinePolicy.Halted;
                }
            }
            _lineStatuses[id] = line.Status;
            try
            {
                await db.SaveChangesAsync(token);
            }
            catch
            {
                _forcedHalts.Add(id);
                _lineStatuses[id] = ProductionLinePolicy.Halted;
                throw;
            }
            return line;
        }, ct);
}
