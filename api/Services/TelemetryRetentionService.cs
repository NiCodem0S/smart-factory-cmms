using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
namespace SmartFactoryCMMS.Api.Services;

public sealed class TelemetryRetentionService(IServiceScopeFactory scopes, IOptions<SimulationOptions> options,
    ILogger<TelemetryRetentionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var days = await db.SystemSettings.OrderBy(s => s.Id).Select(s => (int?)s.RawTelemetryRetentionDays).FirstOrDefaultAsync(stoppingToken);
                if (days is > 0 and <= 36500)
                {
                    var cutoff = DateTime.UtcNow.AddDays(-days.Value);
                    int removed;
                    do
                    {
                        removed = await db.TelemetryRead.Where(t => t.Timestamp < cutoff).OrderBy(t => t.Timestamp)
                            .ThenBy(t => t.Id).Take(options.Value.TelemetryCleanupBatchSize).ExecuteDeleteAsync(stoppingToken);
                        if (removed > 0)
                        {
                            logger.LogInformation("Removed {Count} expired telemetry samples", removed);
                        }
                    } while (removed == options.Value.TelemetryCleanupBatchSize);
                }
                else
                {
                    logger.LogWarning("Telemetry cleanup skipped: configure positive RawTelemetryRetentionDays in SQL");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Telemetry cleanup failed");
            }
            try
            {
                await Task.Delay(TimeSpan.FromHours(options.Value.TelemetryCleanupIntervalHours), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
