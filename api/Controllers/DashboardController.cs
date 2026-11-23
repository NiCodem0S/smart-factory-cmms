using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Controllers;

[ApiController]
[Authorize(Roles = "SuperAdmin,HallAdmin,Technician")]
[Route("api/dashboard")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DashboardController(ApplicationDbContext db, IUserContext user) : ControllerBase
{
    private const int RecentIncidentLimit = 20;
    private const int RecentWorkOrderLimit = 30;
    private static readonly TimeSpan TelemetryFreshness = TimeSpan.FromMinutes(1);
    private static readonly HashSet<string> AllowedIncidentStatuses = new(StringComparer.Ordinal)
    {
        "Active",
        "Acknowledged",
        "Resolved"
    };
    private static readonly HashSet<string> AllowedWorkOrderStatuses = new(StringComparer.Ordinal)
    {
        "Open",
        "InProgress",
        "Resolved"
    };

    private bool HasDashboardAccess() =>
        user.IsAuthenticated &&
        (user.IsSuperAdmin || (user.Role is UserRole.HallAdmin or UserRole.Technician && user.FactoryHallId is not null));

    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get([FromQuery] Guid? factoryHallId, CancellationToken ct)
    {
        if (!HasDashboardAccess())
        {
            return Forbid();
        }

        if (!user.IsSuperAdmin && factoryHallId.HasValue && factoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Factory hall not found." });
        }

        var effectiveHallId = user.IsSuperAdmin ? factoryHallId : user.FactoryHallId;
        var halls = db.FactoryHalls.AsNoTracking();
        if (effectiveHallId.HasValue)
        {
            halls = halls.Where(h => h.Id == effectiveHallId.Value);
        }

        var hallIds = await halls.OrderBy(h => h.Name).ThenBy(h => h.Id).Select(h => h.Id).ToListAsync(ct);
        if (effectiveHallId.HasValue && hallIds.Count == 0)
        {
            return NotFound(new { message = "Factory hall not found." });
        }

        var generatedAtUtc = DateTime.UtcNow;
        var accessibleMachines = db.Machines.AsNoTracking().Where(m => m.IsActive && hallIds.Contains(m.FactoryHallId));
        var machines = await DashboardQuery.ProjectMachines(accessibleMachines, db.TelemetryRead.AsNoTracking(), generatedAtUtc).ToListAsync(ct);
        for (int i = 0; i < machines.Count; i++)
        {
            if (machines[i].LatestTelemetry is { } telemetry)
            {
                machines[i] = machines[i] with
                {
                    LatestTelemetry = telemetry with { TimestampUtc = DateTime.SpecifyKind(telemetry.TimestampUtc, DateTimeKind.Utc) }
                };
            }
        }

        var accessibleIncidents = from incident in db.Incidents.AsNoTracking()
                                  join machine in accessibleMachines on incident.MachineId equals machine.Id
                                  where incident.TriggeredAt <= generatedAtUtc
                                  select new { Incident = incident, Machine = machine };
        var criticalCount = await accessibleIncidents.CountAsync(i => i.Incident.Severity == "Critical" && i.Incident.Status == "Active", ct);
        var incidents = await accessibleIncidents.OrderByDescending(i => i.Incident.TriggeredAt)
            .ThenByDescending(i => i.Incident.Id).Take(RecentIncidentLimit)
            .Select(i => new DashboardIncidentDto(i.Incident.Id, i.Machine.Id, i.Machine.Name, i.Machine.FactoryHallId,
                i.Incident.TriggeredAt, i.Incident.Severity, i.Incident.Status, i.Incident.Message)).ToListAsync(ct);
        for (int i = 0; i < incidents.Count; i++)
        {
            incidents[i] = incidents[i] with { TriggeredAtUtc = DateTime.SpecifyKind(incidents[i].TriggeredAtUtc, DateTimeKind.Utc) };
        }

        var productionLines = await db.ProductionLines.AsNoTracking()
            .Where(l => hallIds.Contains(l.FactoryHallId))
            .OrderBy(l => l.OrderInHall ?? int.MaxValue)
            .ThenBy(l => l.Name)
            .Select(l => new DashboardProductionLineDto(
                l.Id,
                l.Name,
                l.Status,
                l.FactoryHallId,
                l.FactoryHall.Name,
                l.OrderInHall,
                l.LastStatusChangedAt,
                l.CurrentProduct != null ? l.CurrentProduct.Name : null,
                l.CurrentProduct != null ? l.CurrentProduct.SKUNumber : null))
            .ToListAsync(ct);
        for (int i = 0; i < productionLines.Count; i++)
        {
            if (productionLines[i].LastStatusChangedAtUtc is { } changedAt)
            {
                productionLines[i] = productionLines[i] with
                {
                    LastStatusChangedAtUtc = DateTime.SpecifyKind(changedAt, DateTimeKind.Utc)
                };
            }
        }

        var accessibleWorkOrders = from wo in db.WorkOrders.AsNoTracking()
                                   join machine in accessibleMachines on wo.MachineId equals machine.Id
                                   select new { WorkOrder = wo, Machine = machine };
        var workOrders = await accessibleWorkOrders
            .OrderBy(x => x.WorkOrder.Status == "Resolved" ? 1 : 0)
            .ThenByDescending(x => x.WorkOrder.CreatedAt)
            .Take(RecentWorkOrderLimit)
            .Select(x => new DashboardWorkOrderDto(
                x.WorkOrder.Id,
                x.WorkOrder.TicketNumber,
                x.Machine.Id,
                x.Machine.Name,
                x.Machine.FactoryHallId,
                x.WorkOrder.Title,
                x.WorkOrder.Type,
                x.WorkOrder.Status,
                x.WorkOrder.AssignedUserId,
                x.WorkOrder.AssignedUser != null ? x.WorkOrder.AssignedUser.FullName : null,
                x.WorkOrder.CreatedAt,
                x.WorkOrder.DueDate))
            .ToListAsync(ct);
        for (int i = 0; i < workOrders.Count; i++)
        {
            workOrders[i] = workOrders[i] with
            {
                CreatedAtUtc = DateTime.SpecifyKind(workOrders[i].CreatedAtUtc, DateTimeKind.Utc),
                DueDateUtc = workOrders[i].DueDateUtc is { } due ? DateTime.SpecifyKind(due, DateTimeKind.Utc) : null
            };
        }

        var machineIds = machines.Select(m => m.Id).ToList();
        var thresholds = machineIds.Count == 0
            ? new List<DashboardThresholdDto>()
            : await db.AlertThresholds.AsNoTracking()
                .Where(t => machineIds.Contains(t.MachineId))
                .Select(t => new DashboardThresholdDto(t.MachineId, t.MetricType, t.WarningValue, t.CriticalValue))
                .ToListAsync(ct);

        var settings = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var peakPowerLimitKw = settings is { PeakPowerLimitMw: > 0 } ? settings.PeakPowerLimitMw * 1000m : 2500m;
        var siteName = string.IsNullOrWhiteSpace(settings?.SiteName) ? "Smart Factory Plant" : settings.SiteName;
        var shifts = await db.WorkShifts.AsNoTracking().ToListAsync(ct);
        var currentShift = ResolveCurrentShift(shifts, settings?.Timezone, generatedAtUtc);

        var latestFreshAtUtc = generatedAtUtc - TelemetryFreshness;
        var fresh = machines.Select(m => m.LatestTelemetry).OfType<DashboardTelemetryDto>()
            .Where(t => t.TimestampUtc >= latestFreshAtUtc).ToArray();
        var powerReadings = fresh.Count(t => t.PowerLoadKw.HasValue);
        var summary = new DashboardSummaryDto(
            machines.Count,
            machines.Count(m => m.Status == MachineStatus.Running),
            machines.Count(m => m.Status == MachineStatus.Warning),
            machines.Count(m => m.Status == MachineStatus.Error),
            machines.Count(m => m.Status == MachineStatus.Maintenance),
            machines.Count(m => m.Status == MachineStatus.Offline),
            criticalCount,
            machines.Sum(m => (long)m.TotalProduced),
            powerReadings == 0 ? null : fresh.Sum(t => t.PowerLoadKw),
            fresh.Average(t => t.NetworkLatencyMs),
            powerReadings);

        return Ok(new DashboardDto(
            generatedAtUtc,
            effectiveHallId,
            hallIds,
            machines,
            incidents,
            summary,
            productionLines,
            workOrders,
            thresholds,
            peakPowerLimitKw,
            currentShift,
            siteName));
    }

    [HttpPatch("incidents/{incidentId:guid}/status")]
    public async Task<IActionResult> UpdateIncidentStatus(Guid incidentId, [FromBody] UpdateIncidentStatusDto dto, CancellationToken ct)
    {
        if (!HasDashboardAccess())
        {
            return Forbid();
        }

        if (dto is null || string.IsNullOrWhiteSpace(dto.Status) || !AllowedIncidentStatuses.Contains(dto.Status))
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

    [HttpPost("workorders/dispatch")]
    public async Task<ActionResult<DashboardWorkOrderDto>> DispatchWorkOrder([FromBody] DispatchWorkOrderDto dto, CancellationToken ct)
    {
        if (!HasDashboardAccess())
        {
            return Forbid();
        }

        var machine = await db.Machines.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == dto.MachineId && m.IsActive, ct);
        if (machine is null)
        {
            return NotFound(new { message = "Machine not found." });
        }

        if (!user.IsSuperAdmin && machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Machine not found." });
        }

        var assignee = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.FactoryHallId == machine.FactoryHallId && u.Role == UserRole.Technician)
            .OrderBy(u => u.FullName)
            .FirstOrDefaultAsync(ct)
            ?? await db.Users.AsNoTracking()
                .Where(u => u.IsActive && u.FactoryHallId == machine.FactoryHallId)
                .OrderBy(u => u.FullName)
                .FirstOrDefaultAsync(ct)
            ?? (user.UserId.HasValue
                ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == user.UserId.Value, ct)
                : null);

        var code = string.IsNullOrWhiteSpace(machine.SerialNumber)
            ? machine.Id.ToString("N")[..4].ToUpperInvariant()
            : machine.SerialNumber.Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
        if (code.Length > 10) code = code[..10];

        var workOrderType = !string.IsNullOrWhiteSpace(dto.Type)
            ? dto.Type.Trim()
            : machine.Status == MachineStatus.Error
                ? "Critical"
                : machine.Status == MachineStatus.Warning
                    ? "Predictive"
                    : "Routine";

        var title = !string.IsNullOrWhiteSpace(dto.Title)
            ? dto.Title.Trim()
            : machine.Status == MachineStatus.Error
                ? $"Emergency Repair: {machine.Name}"
                : $"Diagnostics Dispatch: {machine.Name}";

        var nowUtc = DateTime.UtcNow;
        var workOrder = new WorkOrder
        {
            Id = Guid.NewGuid(),
            TicketNumber = $"WO-{code}-{Guid.NewGuid().ToString("N")[..5].ToUpperInvariant()}",
            MachineId = machine.Id,
            Title = title,
            Description = $"Dispatched from Live Operations dashboard for {machine.Name}.",
            Type = workOrderType,
            Status = "InProgress",
            AssignedUserId = assignee?.Id,
            CreatedAt = nowUtc,
            DueDate = nowUtc.AddDays(3)
        };

        db.WorkOrders.Add(workOrder);
        await db.SaveChangesAsync(ct);

        return Ok(new DashboardWorkOrderDto(
            workOrder.Id,
            workOrder.TicketNumber,
            machine.Id,
            machine.Name,
            machine.FactoryHallId,
            workOrder.Title,
            workOrder.Type,
            workOrder.Status,
            workOrder.AssignedUserId,
            assignee?.FullName,
            DateTime.SpecifyKind(workOrder.CreatedAt, DateTimeKind.Utc),
            workOrder.DueDate is { } due ? DateTime.SpecifyKind(due, DateTimeKind.Utc) : null));
    }

    [HttpPatch("workorders/{workOrderId:guid}/status")]
    public async Task<IActionResult> UpdateWorkOrderStatus(Guid workOrderId, [FromBody] UpdateWorkOrderStatusDto dto, CancellationToken ct)
    {
        if (!HasDashboardAccess())
        {
            return Forbid();
        }

        if (dto is null || string.IsNullOrWhiteSpace(dto.Status) || !AllowedWorkOrderStatuses.Contains(dto.Status))
        {
            return BadRequest(new { message = "Status must be Open, InProgress, or Resolved." });
        }

        var workOrder = await db.WorkOrders.Include(w => w.Machine)
            .FirstOrDefaultAsync(w => w.Id == workOrderId && w.Machine != null && w.Machine.IsActive, ct);
        if (workOrder?.Machine is null)
        {
            return NotFound(new { message = "Work order not found." });
        }

        if (!user.IsSuperAdmin && workOrder.Machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Work order not found." });
        }

        workOrder.Status = dto.Status;
        workOrder.ResolvedAt = dto.Status == "Resolved" ? DateTime.UtcNow : null;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static DashboardShiftDto? ResolveCurrentShift(IReadOnlyList<WorkShift> shifts, string? timezoneId, DateTime utcNow)
    {
        if (shifts.Count == 0) return null;

        var tz = TimeZoneInfo.Utc;
        if (!string.IsNullOrWhiteSpace(timezoneId))
        {
            try
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
            }
            catch
            {
                tz = TimeZoneInfo.Utc;
            }
        }

        var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz).TimeOfDay;
        foreach (var shift in shifts)
        {
            var overnight = shift.EndTime <= shift.StartTime;
            var duration = overnight
                ? TimeSpan.FromHours(24) - shift.StartTime + shift.EndTime
                : shift.EndTime - shift.StartTime;
            if (duration <= TimeSpan.Zero) continue;

            var inShift = overnight
                ? localTime >= shift.StartTime || localTime < shift.EndTime
                : localTime >= shift.StartTime && localTime < shift.EndTime;
            if (!inShift) continue;

            var elapsed = overnight && localTime < shift.StartTime
                ? TimeSpan.FromHours(24) - shift.StartTime + localTime
                : localTime - shift.StartTime;
            var pct = Math.Clamp((int)Math.Round(elapsed.TotalMinutes / duration.TotalMinutes * 100), 0, 100);
            return new DashboardShiftDto(
                shift.Name,
                shift.StartTime.ToString(@"hh\:mm"),
                shift.EndTime.ToString(@"hh\:mm"),
                pct);
        }

        var fallback = shifts[0];
        return new DashboardShiftDto(
            fallback.Name,
            fallback.StartTime.ToString(@"hh\:mm"),
            fallback.EndTime.ToString(@"hh\:mm"),
            0);
    }
}
