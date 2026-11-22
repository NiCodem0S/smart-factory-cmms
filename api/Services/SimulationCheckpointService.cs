using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
namespace SmartFactoryCMMS.Api.Services;

public sealed class SimulationCheckpointService(SimulationOrchestrator runtime, IOptions<SimulationOptions> options,
    ILogger<SimulationCheckpointService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(options.Value.CheckpointIntervalSeconds));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await runtime.CheckpointAllAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Checkpoint pass failed");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
