using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data;

public static class TelemetryHistoryQuery
{
    public static IQueryable<TelemetryRead> Build(ApplicationDbContext db, Guid machineId,
        DateTime fromUtc, DateTime toUtc, int bucketSeconds)
    {
        var samples = db.TelemetryRead.AsNoTracking().Where(t => t.MachineId == machineId &&
            t.Timestamp >= fromUtc && t.Timestamp <= toUtc && (t.Temperature != null || t.Vibration != null));
        if (bucketSeconds <= 0)
        {
            return samples;
        }

        // Select actual readings in SQL, rather than downloading an entire day or inventing averages.
        var timestamps = samples.GroupBy(t => EF.Functions.DateDiffSecond(fromUtc, t.Timestamp) / bucketSeconds)
            .Select(bucket => bucket.Max(t => t.Timestamp));
        return samples.Where(t => timestamps.Contains(t.Timestamp));
    }
}
