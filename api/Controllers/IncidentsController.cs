using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Controllers;

[ApiController]
[Authorize(Roles = "SuperAdmin,HallAdmin,Technician")]
[Route("api/incidents")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class IncidentsController(ApplicationDbContext db, IUserContext user) : ControllerBase
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.Ordinal)
    {
        "Active",
        "Acknowledged",
        "Resolved"
    };

    private bool HasAccess() =>
        user.IsAuthenticated &&
        (user.IsSuperAdmin || (user.Role is UserRole.HallAdmin or UserRole.Technician && user.FactoryHallId is not null));

    [HttpGet]
    public async Task<ActionResult<IncidentHistoryResponseDto>> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] Guid? factoryHallId = null,
        [FromQuery] Guid? machineId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? severity = null,
        [FromQuery] string? range = "7d",
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (!HasAccess())
        {
            return Forbid();
        }

        if (!user.IsSuperAdmin && factoryHallId.HasValue && factoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Factory hall not found." });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 100);

        var effectiveHallId = user.IsSuperAdmin ? factoryHallId : user.FactoryHallId;
        var nowUtc = DateTime.UtcNow;

        var normalizedRange = (range ?? "7d").Trim().ToLowerInvariant();
        DateTime? cutoffUtc = normalizedRange switch
        {
            "24h" => nowUtc.AddHours(-24),
            "7d" => nowUtc.AddDays(-7),
            "30d" => nowUtc.AddDays(-30),
            _ => null
        };

        // Base scoped query (Hall + Time Range) — drives activity pulse & recurring hotspots
        var baseQuery = db.Incidents.AsNoTracking()
            .Where(i => i.Machine != null && i.Machine.IsActive && i.TriggeredAt <= nowUtc);

        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            baseQuery = baseQuery.Where(i => i.Machine!.FactoryHallId == hallId);
        }

        if (cutoffUtc.HasValue)
        {
            var since = cutoffUtc.Value;
            baseQuery = baseQuery.Where(i => i.TriggeredAt >= since);
        }

        // Apply optional machine & text search filters for summary counts + table
        var scopedQuery = baseQuery;

        if (machineId.HasValue)
        {
            var targetMachine = machineId.Value;
            scopedQuery = scopedQuery.Where(i => i.MachineId == targetMachine);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            scopedQuery = scopedQuery.Where(i =>
                i.Message.ToLower().Contains(term) ||
                i.Machine!.Name.ToLower().Contains(term) ||
                (i.Machine.SerialNumber != null && i.Machine.SerialNumber.ToLower().Contains(term)) ||
                (i.Machine.ProductionLine != null && i.Machine.ProductionLine.Name.ToLower().Contains(term)));
        }

        // 1. Summary counts across current scope (before status/severity pill filter)
        var groupedCounts = await scopedQuery
            .GroupBy(i => new { i.Status, i.Severity })
            .Select(g => new { g.Key.Status, g.Key.Severity, Count = g.Count() })
            .ToListAsync(ct);

        int active = 0, ack = 0, resolved = 0, critOpen = 0, warnOpen = 0;
        foreach (var row in groupedCounts)
        {
            if (row.Status == "Active") active += row.Count;
            else if (row.Status == "Acknowledged") ack += row.Count;
            else if (row.Status == "Resolved") resolved += row.Count;

            if (row.Status != "Resolved")
            {
                if (row.Severity == "Critical") critOpen += row.Count;
                else warnOpen += row.Count;
            }
        }
        var summary = new IncidentHistorySummaryDto(
            Total: active + ack + resolved,
            Active: active,
            Acknowledged: ack,
            Resolved: resolved,
            CriticalOpen: critOpen,
            WarningOpen: warnOpen);

        // 2. Activity timeline buckets (bound SQL query strictly to the chart window so 'all' never pulls full history)
        var (bucketCount, bucketSpan, activityStartUtc, labelFor) = ResolveBucketWindow(normalizedRange, nowUtc);
        var activityPoints = await baseQuery
            .Where(i => i.TriggeredAt >= activityStartUtc)
            .Select(i => new { i.TriggeredAt, i.Severity })
            .ToListAsync(ct);
        var activity = BuildActivityBuckets(
            activityPoints.Select(p => (DateTime.SpecifyKind(p.TriggeredAt, DateTimeKind.Utc), p.Severity)),
            bucketCount,
            bucketSpan,
            activityStartUtc,
            labelFor);

        // 3. Top 3 recurring machines in current hall + range
        var rawHotspots = await baseQuery
            .GroupBy(i => new
            {
                i.MachineId,
                MachineName = i.Machine!.Name,
                LineName = i.Machine.ProductionLine != null ? i.Machine.ProductionLine.Name : null,
                i.Severity
            })
            .Select(g => new
            {
                g.Key.MachineId,
                g.Key.MachineName,
                g.Key.LineName,
                g.Key.Severity,
                Count = g.Count()
            })
            .ToListAsync(ct);

        var hotspots = rawHotspots
            .GroupBy(x => (x.MachineId, x.MachineName, x.LineName))
            .Select(g => new IncidentHotspotDto(
                g.Key.MachineId,
                g.Key.MachineName,
                g.Key.LineName,
                g.Sum(x => x.Count),
                g.Where(x => x.Severity == "Critical").Sum(x => x.Count)))
            .OrderByDescending(h => h.TotalCount)
            .ThenByDescending(h => h.CriticalCount)
            .ThenBy(h => h.MachineName)
            .Take(3)
            .ToList();

        // 4. Filtered + paginated items
        var filteredQuery = scopedQuery;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim();
            if (string.Equals(st, "Open", StringComparison.OrdinalIgnoreCase))
            {
                filteredQuery = filteredQuery.Where(i => i.Status != "Resolved");
            }
            else if (AllowedStatuses.Contains(st))
            {
                filteredQuery = filteredQuery.Where(i => i.Status == st);
            }
        }

        if (!string.IsNullOrWhiteSpace(severity))
        {
            var sev = severity.Trim();
            if (sev is "Critical" or "Warning")
            {
                filteredQuery = filteredQuery.Where(i => i.Severity == sev);
            }
        }

        var totalFiltered = await filteredQuery.CountAsync(ct);
        var pageRows = await filteredQuery
            .OrderByDescending(i => i.TriggeredAt)
            .ThenByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new
            {
                i.Id,
                i.MachineId,
                MachineName = i.Machine!.Name,
                MachineSerialNumber = i.Machine.SerialNumber,
                MachineCategory = i.Machine.Category,
                MachineStatus = i.Machine.Status,
                i.Machine.FactoryHallId,
                FactoryHallName = i.Machine.FactoryHall.Name,
                ProductionLineName = i.Machine.ProductionLine != null ? i.Machine.ProductionLine.Name : null,
                i.TriggeredAt,
                i.Severity,
                i.Status,
                i.Message
            })
            .ToListAsync(ct);

        var pageMachineIds = pageRows.Select(r => r.MachineId).Distinct().ToList();
        var openOrderCounts = pageMachineIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.WorkOrders.AsNoTracking()
                .Where(w => pageMachineIds.Contains(w.MachineId) && w.Status != "Resolved")
                .GroupBy(w => w.MachineId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var items = pageRows.Select(r => new IncidentHistoryItemDto(
            r.Id,
            r.MachineId,
            r.MachineName,
            r.MachineSerialNumber,
            r.MachineCategory,
            r.MachineStatus.ToString(),
            r.FactoryHallId,
            r.FactoryHallName,
            r.ProductionLineName,
            DateTime.SpecifyKind(r.TriggeredAt, DateTimeKind.Utc),
            r.Severity,
            r.Status,
            r.Message,
            openOrderCounts.GetValueOrDefault(r.MachineId, 0))).ToList();

        return Ok(new IncidentHistoryResponseDto(
            new PagedResult<IncidentHistoryItemDto>
            {
                Data = items,
                TotalCount = totalFiltered,
                PageNumber = page,
                PageSize = pageSize
            },
            summary,
            activity,
            hotspots,
            nowUtc));
    }

    [HttpPatch("{incidentId:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid incidentId, [FromBody] UpdateIncidentStatusDto dto, CancellationToken ct)
    {
        if (!HasAccess())
        {
            return Forbid();
        }

        if (dto is null || string.IsNullOrWhiteSpace(dto.Status) || !AllowedStatuses.Contains(dto.Status))
        {
            return BadRequest(new { message = "Status must be Active, Acknowledged, or Resolved." });
        }

        var incident = await db.Incidents.Include(i => i.Machine)
            .FirstOrDefaultAsync(i => i.Id == incidentId && i.Machine != null && i.Machine.IsActive, ct);

        if (incident?.Machine is null)
        {
            return NotFound(new { message = "Incident not found." });
        }

        if (!user.IsSuperAdmin && incident.Machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Incident not found." });
        }

        incident.Status = dto.Status;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static (int BucketCount, TimeSpan BucketSpan, DateTime StartUtc, Func<DateTime, string> LabelFor) ResolveBucketWindow(
        string range,
        DateTime nowUtc)
    {
        if (range == "24h")
        {
            var endHour = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, nowUtc.Hour, 0, 0, DateTimeKind.Utc).AddHours(1);
            return (12, TimeSpan.FromHours(2), endHour - TimeSpan.FromHours(24), d => d.ToString("HH:mm"));
        }

        if (range == "7d")
        {
            return (7, TimeSpan.FromDays(1), nowUtc.Date.AddDays(-6), d => d.ToString("dd MMM"));
        }

        var is30d = range == "30d";
        var count = is30d ? 15 : 14;
        var span = is30d ? TimeSpan.FromDays(2) : TimeSpan.FromDays(1);
        var start = nowUtc.Date.AddDays(-(count * (int)span.TotalDays - (int)span.TotalDays));
        return (count, span, start, d => d.ToString("dd MMM"));
    }

    private static IReadOnlyList<IncidentActivityBucketDto> BuildActivityBuckets(
        IEnumerable<(DateTime TriggeredAtUtc, string Severity)> points,
        int bucketCount,
        TimeSpan bucketSpan,
        DateTime startUtc,
        Func<DateTime, string> labelFor)
    {
        var crit = new int[bucketCount];
        var warn = new int[bucketCount];
        var totalSpanTicks = bucketSpan.Ticks;

        foreach (var (ts, sev) in points)
        {
            if (ts < startUtc) continue;
            var idx = (int)((ts.Ticks - startUtc.Ticks) / totalSpanTicks);
            if (idx < 0 || idx >= bucketCount) continue;
            if (sev == "Critical") crit[idx]++;
            else warn[idx]++;
        }

        var result = new List<IncidentActivityBucketDto>(bucketCount);
        for (int i = 0; i < bucketCount; i++)
        {
            var bucketStart = startUtc.AddTicks(i * totalSpanTicks);
            result.Add(new IncidentActivityBucketDto(labelFor(bucketStart), bucketStart, crit[i], warn[i]));
        }
        return result;
    }
}
