using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

public sealed partial class SimulationOrchestrator
{
    private volatile bool _automationEnabled = options.Value.AutomationEnabled;
    private Guid? _lastHealthyLine;
    private string? _automationWarning;
    private CancellationToken _automationLifetime;
    public bool AutomationEnabled => _automationEnabled;
    public bool IsHealthyLine(Guid id) => RedisAvailable && _lineStatuses.GetValueOrDefault(id) == ProductionLinePolicy.Running;

    private async Task RecoverCoverageAfterChange(CancellationToken ct)
    {
        if (!AutomationEnabled || _shuttingDown || _lineStatuses.Values.Any(s => s == ProductionLinePolicy.Running))
        {
            return;
        }

        try
        {
            await RunAutomationAsync(DateTimeOffset.UtcNow, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Automatic coverage recovery will retry on the next check");
        }
    }

    public SimulationAutomationDto AutomationStatus(IReadOnlyCollection<Machine> visibleMachines) => new(
        AutomationEnabled, visibleMachines.Where(m => m.ProductionLineId.HasValue).Select(m => m.ProductionLineId!.Value).Distinct().Count(IsHealthyLine),
        visibleMachines.Count(m => m.AutomaticRepairAtUtc.HasValue), _options.AutomaticRepairMinSeconds,
        _options.AutomaticRepairMaxSeconds, _automationWarning);

    public Task SetAutomationAsync(SimulationActor actor, bool enabled, CancellationToken ct = default) =>
        Command(actor, async (services, token) =>
        {
            if (actor.Role != UserRole.SuperAdmin)
            {
                throw new SimulationRequestException(403, "Only a super administrator can change factory-wide automation.");
            }

            var db = services.GetRequiredService<ApplicationDbContext>();
            var settings = await db.SystemSettings.OrderBy(s => s.Id).FirstOrDefaultAsync(token);
            if (settings is null)
            {
                settings = new SystemSettings();
                db.SystemSettings.Add(settings);
            }
            settings.SimulationAutomationEnabled = enabled;
            await db.SaveChangesAsync(token);
            _automationEnabled = enabled;
            _automationWarning = null;
            return enabled;
        }, ct);

    // Shares the same gate as ticks and operator commands. No line is exempt from faults.
    public async Task RunAutomationAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        if (_shuttingDown)
        {
            return;
        }

        await _gate.WaitAsync(ct);
        try
        {
            if (!_initialized || _shuttingDown)
            {
                return;
            }

            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            _automationEnabled = await db.SystemSettings.OrderBy(s => s.Id).Select(s => s.SimulationAutomationEnabled).FirstOrDefaultAsync(ct)
                ?? _options.AutomationEnabled;
            if (!AutomationEnabled)
            {
                _automationWarning = null;
                return;
            }
            RedisAvailable = await stateStore.IsAvailableAsync(ct);
            if (!RedisAvailable)
            {
                _automationWarning = "Automatic recovery is waiting for Redis.";
                return;
            }
            var machines = await Machines(db).Where(m => m.IsActive && m.ProductionLineId.HasValue).ToListAsync(ct);
            foreach (var machine in machines.Where(m => m.Status == MachineStatus.Error && !m.AutomaticRepairAtUtc.HasValue))
            {
                var seconds = _options.AutomaticRepairMinSeconds + Random.Shared.NextDouble() *
                    (_options.AutomaticRepairMaxSeconds - _options.AutomaticRepairMinSeconds);
                machine.AutomaticRepairAtUtc = now.AddSeconds(seconds);
            }
            // A manual repair/stop or external edit may have already resolved the original fault.
            foreach (var machine in machines.Where(m => m.Status is not (MachineStatus.Error or MachineStatus.Maintenance)))
            {
                machine.AutomaticRepairAtUtc = null;
            }

            await db.SaveChangesAsync(ct);
            foreach (var group in machines.Where(m => m.AutomaticRepairAtUtc <= now).GroupBy(m => m.ProductionLineId!.Value))
            {
                await RecoverLineLocked(group.Key, emergency: false, now, ct);
            }

            var lines = await db.ProductionLines.AsNoTracking().Where(l => db.Machines.Any(m => m.IsActive && m.ProductionLineId == l.Id)).ToListAsync(ct);
            var healthy = lines.Where(l => IsHealthyLine(l.Id)).ToArray();
            if (healthy.Length > 0)
            {
                if (!_lastHealthyLine.HasValue || !healthy.Any(l => l.Id == _lastHealthyLine))
                {
                    _lastHealthyLine = healthy[0].Id;
                }

                _automationWarning = null;
                return;
            }
            // Prefer a different line. Repairing the last failed line immediately would hide its fault scenario.
            var candidates = lines.OrderBy(l => l.Id == _lastHealthyLine)
                .ThenBy(l => machines.Count(m => m.ProductionLineId == l.Id && m.Status is MachineStatus.Error or MachineStatus.Warning))
                .ThenBy(l => machines.Count(m => m.ProductionLineId == l.Id && !IsRunning(m.Id)))
                .ThenBy(l => l.LastStatusChangedAt).ToArray();
            foreach (var line in candidates)
            {
                if (await RecoverLineLocked(line.Id, emergency: true, now, ct))
                {
                    _lastHealthyLine = line.Id;
                    _automationWarning = null;
                    logger.LogInformation("Automatic coverage restored by line {LineId}", line.Id);
                    return;
                }
            }
            _automationWarning = "No suitable line can run. Check planned maintenance, profiles and alert thresholds.";
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _automationWarning = "Automatic recovery could not finish. Check simulation and database availability.";
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<bool> RecoverLineLocked(Guid lineId, bool emergency, DateTimeOffset now, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<ApplicationDbContext>();
        var line = await db.ProductionLines.SingleAsync(l => l.Id == lineId, ct);
        var machines = await Machines(db).Where(m => m.IsActive && m.ProductionLineId == lineId).ToListAsync(ct);
        if (machines.Count == 0 || emergency && machines.Any(m => m.Status == MachineStatus.Maintenance && !m.AutomaticRepairAtUtc.HasValue))
        {
            return false;
        }
        // Never overwrite an operator's profile or thresholds to manufacture a green status.
        foreach (var machine in machines)
        {
            var config = Configuration(machine);
            if (config.Profile.NormalTemperature >= config.Thresholds.Temperature.Warning ||
                config.Profile.BaseVibration >= config.Thresholds.Vibration.Warning ||
                config.Thresholds.Power is { } power && config.Profile.NormalPowerKw >= power.Warning)
            {
                return false;
            }
        }
        foreach (var machine in machines)
        {
            var needsRepair = machine.Status is MachineStatus.Error or MachineStatus.Maintenance ||
                emergency && machine.Status == MachineStatus.Warning;
            if (needsRepair)
            {
                if (!emergency && (machine.AutomaticRepairAtUtc is null || machine.AutomaticRepairAtUtc > now))
                {
                    continue;
                }
                // The persisted deadline also identifies automation-owned maintenance after a process restart.
                machine.AutomaticRepairAtUtc ??= now;
                if (machine.Status != MachineStatus.Maintenance)
                {
                    await StopLocked(services, machine, MachineStatus.Maintenance, ct);
                }

                await ResolveSimulationIncidents(db, machine.Id, ct);
                machine.AutomaticRepairAtUtc = null;
                await StopLocked(services, machine, MachineStatus.Offline, ct, resetAfterRepair: true);
            }
        }
        if (machines.Any(m => m.Status is MachineStatus.Error or MachineStatus.Maintenance))
        {
            return false;
        }

        foreach (var machine in machines)
        {
            if (IsRunning(machine.Id))
            {
                continue;
            }

            if (_workers.TryGetValue(machine.Id, out var dirty) && dirty.Dirty)
            {
                await SaveWorkerLocked(services, dirty, ct);
            }

            var reset = machine.Status == MachineStatus.Offline;
            if (reset)
            {
                machine.Status = MachineStatus.Running;
            }

            await StartLocked(services, machine, reset, ct);
        }
        if (machines.Any(machine => !IsReadyForProduction(machine.Id)))
        {
            return false;
        }

        _forcedHalts.Remove(lineId);
        line.Status = machines.Any(m => _workers[m.Id].State.MachineStatus == MachineStatus.Warning)
            ? ProductionLinePolicy.Warning : ProductionLinePolicy.Running;
        await db.SaveChangesAsync(ct);
        _lineStatuses[lineId] = line.Status;
        return line.Status == ProductionLinePolicy.Running;
    }
}
