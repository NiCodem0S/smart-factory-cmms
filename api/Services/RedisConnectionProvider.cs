using StackExchange.Redis;

namespace SmartFactoryCMMS.Api.Services;

/// Owns the single Redis multiplexer shared by the simulation module.
/// The connection is created on first use so unavailable Redis does not stop the core API.
public sealed class RedisConnectionProvider : IAsyncDisposable
{
    private readonly IConfiguration _configuration;
    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private IConnectionMultiplexer? _connection;

    public RedisConnectionProvider(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<IConnectionMultiplexer> GetConnectionAsync(CancellationToken ct = default)
    {
        if (_connection is { } connection)
        {
            return connection;
        }

        await _connectionLock.WaitAsync(ct);
        try
        {
            if (_connection is { } existing)
            {
                return existing;
            }

            var connectionString = _configuration["Redis:ConnectionString"];
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("Redis:ConnectionString is not configured.");
            }

            var options = ConfigurationOptions.Parse(connectionString);
            options.AbortOnConnectFail = false;
            _connection = await ConnectionMultiplexer.ConnectAsync(options);
            return _connection;
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        {
            await _connection.DisposeAsync();
        }

        _connectionLock.Dispose();
    }
}
