using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services;

public sealed class TelemetryPersister(TelemetryChannel channel, IServiceScopeFactory scopes,
    IOptions<SimulationOptions> options, SimulationDiagnostics diagnostics, ILogger<TelemetryPersister> logger) : BackgroundService
{
    private async Task Save(List<TelemetryRead> batch, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ids = batch.Select(t => t.Id).ToArray();
        var existing = await db.TelemetryRead.Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync(ct);
        db.TelemetryRead.AddRange(batch.Where(t => !existing.Contains(t.Id)));
        await db.SaveChangesAsync(ct);
        diagnostics.HistoryWritten(batch.Count);
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
}
