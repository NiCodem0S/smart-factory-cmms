using System.Diagnostics.Metrics;

namespace SmartFactoryCMMS.Api.Services;

public sealed class SimulationDiagnostics
{
    private static readonly Meter Meter = new("SmartFactoryCMMS.Simulation", "1.0");
    private static readonly Counter<long> DroppedCounter = Meter.CreateCounter<long>("simulation.history.dropped");
    private static readonly Counter<long> PersistedCounter = Meter.CreateCounter<long>("simulation.history.persisted");
    private static readonly Counter<long> ErrorCounter = Meter.CreateCounter<long>("simulation.persistence.errors");
    private static readonly UpDownCounter<int> WorkerCounter = Meter.CreateUpDownCounter<int>("simulation.workers.running");
    private static readonly Histogram<double> TickDuration = Meter.CreateHistogram<double>("simulation.tick.duration", "ms");
    private static readonly Histogram<double> CheckpointLag = Meter.CreateHistogram<double>("simulation.checkpoint.lag", "s");
    private long _dropped, _persisted, _errors;
    private long _lastHistoryWriteTicks;
    private int _workers;
    public void SetWorkerCount(int count) => WorkerCounter.Add(count - Interlocked.Exchange(ref _workers, count));
    public long Dropped => Interlocked.Read(ref _dropped);
    public long Persisted => Interlocked.Read(ref _persisted);
    public long PersistenceErrors => Interlocked.Read(ref _errors);
    public DateTimeOffset? LastHistoryWriteAtUtc
    {
        get { var ticks = Interlocked.Read(ref _lastHistoryWriteTicks); return ticks == 0 ? null : new DateTimeOffset(ticks, TimeSpan.Zero); }
    }
    public string? LastHistoryError { get; private set; }
    public void Drop() { Interlocked.Increment(ref _dropped); DroppedCounter.Add(1); }
    public void HistoryWritten(int count)
    {
        Interlocked.Add(ref _persisted, count); PersistedCounter.Add(count);
        Interlocked.Exchange(ref _lastHistoryWriteTicks, DateTimeOffset.UtcNow.UtcTicks); LastHistoryError = null;
    }
    public void Failure(Exception ex, bool history = false)
    {
        Interlocked.Increment(ref _errors); ErrorCounter.Add(1);
        if (history) LastHistoryError = ex.Message;
    }
    public void RecordTick(double milliseconds) => TickDuration.Record(milliseconds);
    public void RecordCheckpoint(double seconds) => CheckpointLag.Record(seconds);
}
