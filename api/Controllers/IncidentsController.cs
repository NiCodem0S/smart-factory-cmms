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
        [FromQuery] bool includeInsights = true,
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
        if (normalizedRange == "all" && db.Database.IsRelational())
        {
            // Full-archive queries get an extended, bounded SQL timeout (60s) to protect the connection pool.
            db.Database.SetCommandTimeout(60);
        }

        DateTime? cutoffUtc = normalizedRange switch
        {
            "24h" => nowUtc.AddHours(-24),
            "7d" => nowUtc.AddDays(-7),
            "30d" => nowUtc.AddDays(-30),
            _ => null
        };

        // Preload lightweight active machine metadata once (tens of rows) so all Incidents queries run
        // purely against the indexed Incidents table with zero multi-table SQL JOIN overhead.
        var machinesQuery = db.Machines.AsNoTracking().Where(m => m.IsActive);
        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            machinesQuery = machinesQuery.Where(m => m.FactoryHallId == hallId);
        }

        var machineMeta = await machinesQuery
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.SerialNumber,
                m.Category,
                m.Status,
                m.FactoryHallId,
                FactoryHallName = m.FactoryHall.Name,
                ProductionLineName = m.ProductionLine != null ? m.ProductionLine.Name : null
            })
            .ToDictionaryAsync(m => m.Id, ct);

        if (machineMeta.Count == 0)
        {
            return Ok(new IncidentHistoryResponseDto(
                new PagedResult<IncidentHistoryItemDto> { Data = new(), TotalCount = 0, PageNumber = page, PageSize = pageSize },
                new IncidentHistorySummaryDto(0, 0, 0, 0, 0, 0),
                Array.Empty<IncidentActivityBucketDto>(),
                Array.Empty<IncidentHotspotDto>(),
                nowUtc));
        }

        var accessibleIds = machineMeta.Keys.ToArray();
        var needsMachineScopeFilter = effectiveHallId.HasValue || await db.Machines.AsNoTracking().AnyAsync(m => !m.IsActive, ct);

        // Single-table indexed base query (Hall + Time Range)
        var baseQuery = db.Incidents.AsNoTracking()
            .Where(i => i.TriggeredAt <= nowUtc);

        if (needsMachineScopeFilter)
        {
            baseQuery = baseQuery.Where(i => accessibleIds.Contains(i.MachineId));
        }

        if (cutoffUtc.HasValue)
        {
            var since = cutoffUtc.Value;
            baseQuery = baseQuery.Where(i => i.TriggeredAt >= since);
        }

        // Scoped query for summary + paginated table
        var scopedQuery = baseQuery;
        if (machineId.HasValue)
        {
            var targetMachine = machineId.Value;
            scopedQuery = scopedQuery.Where(i => i.MachineId == targetMachine);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            if (term.Length > 128)
            {
                term = term[..128];
            }
            var matchingMachineIds = machineMeta.Values
                .Where(m =>
                    m.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                    (m.SerialNumber != null && m.SerialNumber.Contains(term, StringComparison.OrdinalIgnoreCase)) ||
                    (m.ProductionLineName != null && m.ProductionLineName.Contains(term, StringComparison.OrdinalIgnoreCase)))
                .Select(m => m.Id)
                .ToArray();

            if (matchingMachineIds.Length > 0)
            {
                scopedQuery = scopedQuery.Where(i =>
                    matchingMachineIds.Contains(i.MachineId) ||
                    i.Message.Contains(term));
            }
            else
            {
                scopedQuery = scopedQuery.Where(i => i.Message.Contains(term));
            }
        }

        // 1. Summary counts via single indexed GROUP BY (returns at most 6 rows)
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

        // 2 & 3. Activity Pulse & Recurring Hotspots (aggregated in SQL — never pulls raw incident rows;
        // skipped on pure pagination/tab switches when includeInsights=false)
        IReadOnlyList<IncidentActivityBucketDto> activity = Array.Empty<IncidentActivityBucketDto>();
        IReadOnlyList<IncidentHotspotDto> hotspots = Array.Empty<IncidentHotspotDto>();

        if (includeInsights)
        {
            var (bucketCount, bucketSpan, activityStartUtc, labelFor) = ResolveBucketWindow(normalizedRange, nowUtc);
            var activityQuery = baseQuery.Where(i => i.TriggeredAt >= activityStartUtc);

            if (normalizedRange == "24h")
            {
                var hourlyGroups = await activityQuery
                    .GroupBy(i => new
                    {
                        i.TriggeredAt.Year,
                        i.TriggeredAt.Month,
                        i.TriggeredAt.Day,
                        i.TriggeredAt.Hour,
                        i.Severity
                    })
                    .Select(g => new
                    {
                        g.Key.Year,
                        g.Key.Month,
                        g.Key.Day,
                        g.Key.Hour,
                        g.Key.Severity,
                        Count = g.Count()
                    })
                    .ToListAsync(ct);

                activity = BuildActivityBucketsFromCounts(
                    hourlyGroups.Select(g => (new DateTime(g.Year, g.Month, g.Day, g.Hour, 0, 0, DateTimeKind.Utc), g.Severity, g.Count)),
                    bucketCount,
                    bucketSpan,
                    activityStartUtc,
                    labelFor);
            }
            else
            {
                var dailyGroups = await activityQuery
                    .GroupBy(i => new
                    {
                        i.TriggeredAt.Year,
                        i.TriggeredAt.Month,
                        i.TriggeredAt.Day,
                        i.Severity
                    })
                    .Select(g => new
                    {
                        g.Key.Year,
                        g.Key.Month,
                        g.Key.Day,
                        g.Key.Severity,
                        Count = g.Count()
                    })
                    .ToListAsync(ct);

                activity = BuildActivityBucketsFromCounts(
                    dailyGroups.Select(g => (new DateTime(g.Year, g.Month, g.Day, 0, 0, 0, DateTimeKind.Utc), g.Severity, g.Count)),
                    bucketCount,
                    bucketSpan,
                    activityStartUtc,
                    labelFor);
            }

            var rawHotspots = await baseQuery
                .GroupBy(i => new { i.MachineId, i.Severity })
                .Select(g => new { g.Key.MachineId, g.Key.Severity, Count = g.Count() })
                .ToListAsync(ct);

            hotspots = rawHotspots
                .GroupBy(x => x.MachineId)
                .Select(g =>
                {
                    var m = machineMeta[g.Key];
                    return new IncidentHotspotDto(
                        g.Key,
                        m.Name,
                        m.ProductionLineName,
                        g.Sum(x => x.Count),
                        g.Where(x => x.Severity == "Critical").Sum(x => x.Count));
                })
                .OrderByDescending(h => h.TotalCount)
                .ThenByDescending(h => h.CriticalCount)
                .ThenBy(h => h.MachineName)
                .Take(3)
                .ToList();
        }

        // 4. Filtered + paginated rows using SQL OFFSET/FETCH (.Skip().Take())
        var filteredQuery = scopedQuery;
        string? normalizedStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim();
            if (string.Equals(st, "Open", StringComparison.OrdinalIgnoreCase))
            {
                normalizedStatus = "Open";
                filteredQuery = filteredQuery.Where(i => i.Status != "Resolved");
            }
            else if (AllowedStatuses.Contains(st))
            {
                normalizedStatus = st;
                filteredQuery = filteredQuery.Where(i => i.Status == st);
            }
        }

        string? normalizedSeverity = null;
        if (!string.IsNullOrWhiteSpace(severity))
        {
            var sev = severity.Trim();
            if (sev is "Critical" or "Warning")
            {
                normalizedSeverity = sev;
                filteredQuery = filteredQuery.Where(i => i.Severity == sev);
            }
        }

        // Compute totalFiltered straight from groupedCounts — avoids an extra full COUNT(*) scan!
        var totalFiltered = groupedCounts
            .Where(r =>
                (normalizedStatus is null ||
                 (normalizedStatus == "Open" ? r.Status != "Resolved" : r.Status == normalizedStatus)) &&
                (normalizedSeverity is null || r.Severity == normalizedSeverity))
            .Sum(r => r.Count);

        // Clamp page to actual range so abusive deep OFFSETs cannot waste SQL scan work
        var maxPage = Math.Max(1, (int)Math.Ceiling((double)totalFiltered / pageSize));
        var effectivePage = Math.Min(page, maxPage);

        var pageRows = totalFiltered == 0
            ? new()
            : await filteredQuery
                .OrderByDescending(i => i.TriggeredAt)
                .ThenByDescending(i => i.Id)
                .Skip((effectivePage - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new
                {
                    i.Id,
                    i.MachineId,
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

        var items = pageRows.Select(r =>
        {
            var m = machineMeta[r.MachineId];
            return new IncidentHistoryItemDto(
                r.Id,
                r.MachineId,
                m.Name,
                m.SerialNumber,
                m.Category,
                m.Status.ToString(),
                m.FactoryHallId,
                m.FactoryHallName,
                m.ProductionLineName,
                DateTime.SpecifyKind(r.TriggeredAt, DateTimeKind.Utc),
                r.Severity,
                r.Status,
                r.Message,
                openOrderCounts.GetValueOrDefault(r.MachineId, 0));
        }).ToList();

        return Ok(new IncidentHistoryResponseDto(
            new PagedResult<IncidentHistoryItemDto>
            {
                Data = items,
                TotalCount = totalFiltered,
                PageNumber = effectivePage,
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

    private static IReadOnlyList<IncidentActivityBucketDto> BuildActivityBucketsFromCounts(
        IEnumerable<(DateTime BucketUtc, string Severity, int Count)> counts,
        int bucketCount,
        TimeSpan bucketSpan,
        DateTime startUtc,
        Func<DateTime, string> labelFor)
    {
        var crit = new int[bucketCount];
        var warn = new int[bucketCount];
        var totalSpanTicks = bucketSpan.Ticks;

        foreach (var (ts, sev, count) in counts)
        {
            if (ts < startUtc) continue;
            var idx = (int)((ts.Ticks - startUtc.Ticks) / totalSpanTicks);
            if (idx < 0 || idx >= bucketCount) continue;
            if (sev == "Critical") crit[idx] += count;
            else warn[idx] += count;
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
