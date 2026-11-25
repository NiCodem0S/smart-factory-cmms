using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

/// Monitors RealDevice machines and flips them to Offline if no telemetry arrives within OfflineTimeoutSeconds.
public sealed class DeviceWatchdogService(
    IServiceScopeFactory scopes,
    ISimulationStateStore stateStore,
    IHubContext<TelemetryHub> hub,
    ILogger<DeviceWatchdogService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckInterval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await SweepAsync(DateTimeOffset.UtcNow, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Device watchdog sweep failed");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    public async Task<int> SweepAsync(DateTimeOffset nowUtc, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var onlineDevices = await db.Machines
            .Where(m => m.IsActive
                && m.TelemetrySource == TelemetrySource.RealDevice
                && (m.Status == MachineStatus.Running || m.Status == MachineStatus.Warning))
            .ToListAsync(ct);

        if (onlineDevices.Count == 0) return 0;

        int markedOffline = 0;
        var affectedLines = new HashSet<Guid>();

        foreach (var machine in onlineDevices)
        {
            var timeoutSec = Math.Clamp(machine.OfflineTimeoutSeconds, 5, 86400);
            DateTimeOffset? lastSeen = null;
            MachineSimState? state = null;

            try
            {
                state = await stateStore.ReadAsync(machine.Id, ct);
                if (state is not null)
                {
                    lastSeen = state.LastTickAtUtc;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogDebug(ex, "Redis unavailable during watchdog read for {MachineId}", machine.Id);
            }

            if (lastSeen is null)
            {
                var latestSql = await db.TelemetryRead
                    .Where(t => t.MachineId == machine.Id)
                    .OrderByDescending(t => t.Timestamp)
                    .Select(t => (DateTime?)t.Timestamp)
                    .FirstOrDefaultAsync(ct);

                if (latestSql.HasValue)
                {
                    lastSeen = new DateTimeOffset(DateTime.SpecifyKind(latestSql.Value, DateTimeKind.Utc));
                }
                else if (machine.LastStatusChangedAt.HasValue)
                {
                    lastSeen = new DateTimeOffset(DateTime.SpecifyKind(machine.LastStatusChangedAt.Value, DateTimeKind.Utc));
                }
            }

            if (lastSeen is not null && (nowUtc - lastSeen.Value).TotalSeconds <= timeoutSec)
            {
                continue;
            }

            machine.Status = MachineStatus.Offline;
            markedOffline++;
            if (machine.ProductionLineId.HasValue)
            {
                affectedLines.Add(machine.ProductionLineId.Value);
            }

            var offlineState = (state ?? new MachineSimState
            {
                MachineId = machine.Id,
                LastTickAtUtc = lastSeen ?? nowUtc,
                TotalProduced = machine.TotalProduced
            }) with
            {
                MachineStatus = MachineStatus.Offline,
                PowerLoadKw = 0,
                Vibration = 0
            };

            try { await stateStore.WriteAsync(offlineState, ct); } catch { /* Best-effort Redis mirror */ }
            try
            {
                await hub.Clients
                    .Groups(TelemetryHub.MachineGroup(machine.FactoryHallId, machine.Id), TelemetryHub.HallGroup(machine.FactoryHallId))
                    .SendAsync("ReceiveTelemetry", offlineState, ct);
            }
            catch { /* Best-effort broadcast */ }
        }

        if (markedOffline > 0)
        {
            if (affectedLines.Count > 0)
            {
                var lines = await db.ProductionLines.Where(l => affectedLines.Contains(l.Id)).ToListAsync(ct);
                foreach (var line in lines)
                {
                    line.Status = ProductionLinePolicy.Halted;
                }
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Device watchdog marked {Count} real device(s) Offline after heartbeat timeout", markedOffline);
        }

        return markedOffline;
    }
}
