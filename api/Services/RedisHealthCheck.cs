using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SmartFactoryCMMS.Api.Services;

public sealed class RedisHealthCheck : IHealthCheck
{
    private readonly RedisConnectionProvider _redis;

    public RedisHealthCheck(RedisConnectionProvider redis)
    {
        _redis = redis;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var connection = await _redis.GetConnectionAsync(cancellationToken);
            if (!connection.IsConnected)
            {
                return HealthCheckResult.Unhealthy("Redis is disconnected.");
            }

            await connection.GetDatabase().PingAsync().WaitAsync(cancellationToken);
            return HealthCheckResult.Healthy("Redis responded to PING.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("Redis is unavailable.", ex);
        }
    }
}
