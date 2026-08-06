using System.Threading.Channels;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services
{
    public class TelemetryChannel
    {
        private readonly Channel<TelemetryRead> _channel;

        public TelemetryChannel()
        {
            var options = new BoundedChannelOptions(10000)
            {
                FullMode = BoundedChannelFullMode.DropOldest
            };

            _channel = Channel.CreateBounded<TelemetryRead>(options);
        }

        public async ValueTask AddTelemetryAsync(TelemetryRead telemetry, CancellationToken ct = default)
        {
            await _channel.Writer.WriteAsync(telemetry, ct);
        }

        public IAsyncEnumerable<TelemetryRead> ReadAllAsync(CancellationToken ct = default)
        {
            return _channel.Reader.ReadAllAsync(ct);
        }
    }
}