using System.Threading.Channels;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services
{
    public class TelemetryChannel
    {
        private readonly Channel<TelemetryRead> _channel;

        public TelemetryChannel(SimulationDiagnostics diagnostics)
        {
            var options = new BoundedChannelOptions(10000)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true
            };

            _channel = Channel.CreateBounded<TelemetryRead>(options, _ => diagnostics.Drop());
        }

        public ValueTask AddTelemetryAsync(TelemetryRead telemetry, CancellationToken ct = default)
        {
            return _channel.Writer.WriteAsync(telemetry, ct);
        }

        public IAsyncEnumerable<TelemetryRead> ReadAllAsync(CancellationToken ct = default)
        {
            return _channel.Reader.ReadAllAsync(ct);
        }

        public int Count => _channel.Reader.CanCount ? _channel.Reader.Count : 0;
        public bool TryRead(out TelemetryRead? value) => _channel.Reader.TryRead(out value);
        public void Complete() => _channel.Writer.TryComplete();
    }
}
