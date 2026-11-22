using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;

namespace SmartFactoryCMMS.Api.Services;

public sealed class SimulationAutomationService(SimulationOrchestrator runtime, IOptions<SimulationOptions> options,
    ILogger<SimulationAutomationService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(options.Value.AutomationIntervalSeconds));
        do
        {
            try
            {
                await runtime.RunAutomationAsync(DateTimeOffset.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Automatic production recovery failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
