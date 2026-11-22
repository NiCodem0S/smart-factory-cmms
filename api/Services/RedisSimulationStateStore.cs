using System.Text.Json;
using System.Text.Json.Serialization;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Services;

public sealed class RedisSimulationStateStore(RedisConnectionProvider provider) : ISimulationStateStore
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static string Key(Guid id) => $"sim:state:{id:D}";

    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            var connection = await provider.GetConnectionAsync(ct);
            if (!connection.IsConnected)
            {
                return false;
            }

            await connection.GetDatabase().PingAsync().WaitAsync(ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return false;
        }
    }

    public async Task<MachineSimState?> ReadAsync(Guid machineId, CancellationToken ct = default)
    {
        var connection = await provider.GetConnectionAsync(ct);
        var value = await connection.GetDatabase().StringGetAsync(Key(machineId)).WaitAsync(ct);
        if (value.IsNullOrEmpty)
        {
            return null;
        }

        var state = JsonSerializer.Deserialize<MachineSimState>((string)value!, Json);
        if (state?.SchemaVersion != MachineSimState.CurrentSchemaVersion)
        {
            throw new InvalidOperationException("Unsupported Redis simulation snapshot.");
        }

        return state;
    }

    public async Task WriteAsync(MachineSimState state, CancellationToken ct = default)
    {
        var connection = await provider.GetConnectionAsync(ct);
        var key = Key(state.MachineId);
        var snapshot = JsonSerializer.Serialize(state, Json);
        await connection.GetDatabase().StringSetAsync(key, snapshot).WaitAsync(ct);
    }

    public async Task DeleteAsync(Guid machineId, CancellationToken ct = default)
    {
        var connection = await provider.GetConnectionAsync(ct);
        await connection.GetDatabase().KeyDeleteAsync(Key(machineId)).WaitAsync(ct);
    }
}
