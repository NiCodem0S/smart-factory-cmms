using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Services;

public sealed class TelemetryPersister(
    TelemetryChannel channel,
    IServiceScopeFactory scopes,
    IOptions<SimulationOptions> options,
    SimulationDiagnostics diagnostics,
    ILogger<TelemetryPersister> logger,
    ITelemetryHistoryQueue? streamQueue = null) : BackgroundService
{
    private async Task Save(List<TelemetryRead> batch, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var distinct = batch
            .GroupBy(t => t.Id)
            .Select(g => g.Last())
            .ToList();
        var ids = distinct.Select(t => t.Id).ToArray();
        var existing = await db.TelemetryRead.Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync(ct);
        var existingSet = existing.ToHashSet();
        var toInsert = distinct.Where(t => !existingSet.Contains(t.Id)).ToList();
        if (toInsert.Count > 0)
        {
            db.TelemetryRead.AddRange(toInsert);
            await db.SaveChangesAsync(ct);
        }
        diagnostics.HistoryWritten(distinct.Count);
        batch.Clear();
    }

    private void CollectPending(List<TelemetryRead> batch, int limit)
    {
        while (batch.Count < limit && channel.TryRead(out var sample))
        {
            if (sample is not null)
            {
                batch.Add(sample);
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (streamQueue is not null)
        {
            await RunStreamLoopAsync(stoppingToken);
            return;
        }

        await RunChannelLoopAsync(stoppingToken);
    }

    private async Task RunStreamLoopAsync(CancellationToken stoppingToken)
    {
        var batch = new List<TelemetryRead>();
        IReadOnlyList<string> pendingEntryIds = Array.Empty<string>();
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                if (batch.Count == 0)
                {
                    var pulled = await streamQueue!.ReadBatchAsync(options.Value.HistoryBatchSize, stoppingToken);
                    if (pulled.Samples.Count == 0)
                    {
                        await Task.Delay(250, stoppingToken);
                        continue;
                    }
                    batch.AddRange(pulled.Samples);
                    pendingEntryIds = pulled.StreamEntryIds;
                }

                try
                {
                    await Save(batch, stoppingToken);
                    if (pendingEntryIds.Count > 0)
                    {
                        await streamQueue!.AcknowledgeAsync(pendingEntryIds, stoppingToken);
                        pendingEntryIds = Array.Empty<string>();
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    diagnostics.Failure(ex, history: true);
                    logger.LogError(ex, "History persistence failed; retaining current Redis Stream batch for retry");
                    await Task.Delay(TimeSpan.FromSeconds(options.Value.ReconcileIntervalSeconds), stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally
        {
            await FlushInMemoryFallbackOnShutdownAsync(batch);
        }
    }

    private async Task RunChannelLoopAsync(CancellationToken stoppingToken)
    {
        var batch = new List<TelemetryRead>();
        try
        {
            await foreach (var sample in channel.ReadAllAsync(stoppingToken))
            {
                batch.Add(sample);
                CollectPending(batch, options.Value.HistoryBatchSize);

                while (batch.Count > 0)
                {
                    try
                    {
                        await Save(batch, stoppingToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        diagnostics.Failure(ex, history: true);
                        logger.LogError(ex, "History persistence failed; retaining the current batch for retry");
                        await Task.Delay(TimeSpan.FromSeconds(options.Value.ReconcileIntervalSeconds), stoppingToken);
                    }
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally
        {
            await FlushInMemoryFallbackOnShutdownAsync(batch);
        }
    }

    private async Task FlushInMemoryFallbackOnShutdownAsync(List<TelemetryRead> batch)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try
        {
            CollectPending(batch, int.MaxValue);
            if (batch.Count > 0)
            {
                await Save(batch, timeout.Token);
            }
        }
        catch (Exception ex)
        {
            diagnostics.Failure(ex, history: true);
            logger.LogError(ex, "Final telemetry flush failed");
        }
    }
}
