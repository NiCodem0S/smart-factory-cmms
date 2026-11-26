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
[Route("api/maintenance")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MaintenanceController(ApplicationDbContext db, IUserContext user) : ControllerBase
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.Ordinal)
    {
        "Open",
        "InProgress",
        "Review",
        "Resolved"
    };

    private static readonly HashSet<string> AllowedTypes = new(StringComparer.Ordinal)
    {
        "Routine",
        "Predictive",
        "Critical"
    };

    private bool HasAccess() =>
        user.IsAuthenticated &&
        (user.IsSuperAdmin || (user.Role is UserRole.HallAdmin or UserRole.Technician && user.FactoryHallId is not null));

    [HttpGet("workorders")]
    public async Task<ActionResult<MaintenanceOverviewDto>> GetOverview(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] Guid? factoryHallId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] Guid? assignedUserId = null,
        [FromQuery] Guid? machineId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? resolvedRange = "7d",
        CancellationToken ct = default)
    {
        if (!HasAccess()) return Forbid();

        if (!user.IsSuperAdmin && factoryHallId.HasValue && factoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Factory hall not found." });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 100);

        var effectiveHallId = user.IsSuperAdmin ? factoryHallId : user.FactoryHallId;
        var nowUtc = DateTime.UtcNow;

        // Hall-scoped base query
        var baseQuery = db.WorkOrders.AsNoTracking()
            .Where(w => w.Machine != null && w.Machine.IsActive);

        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            baseQuery = baseQuery.Where(w => w.Machine!.FactoryHallId == hallId);
        }

        // Scoped query for status counts (after assignee / machine / type / search filters)
        var scopedQuery = baseQuery;

        if (assignedUserId.HasValue)
        {
            var assigneeId = assignedUserId.Value;
            scopedQuery = scopedQuery.Where(w => w.AssignedUserId == assigneeId);
        }

        if (machineId.HasValue)
        {
            var mId = machineId.Value;
            scopedQuery = scopedQuery.Where(w => w.MachineId == mId);
        }

        if (!string.IsNullOrWhiteSpace(type) && AllowedTypes.Contains(type.Trim()))
        {
            var t = type.Trim();
            scopedQuery = scopedQuery.Where(w => w.Type == t);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            scopedQuery = scopedQuery.Where(w =>
                w.TicketNumber.ToLower().Contains(term) ||
                w.Title.ToLower().Contains(term) ||
                (w.Description != null && w.Description.ToLower().Contains(term)) ||
                w.Machine!.Name.ToLower().Contains(term) ||
                (w.Machine.SerialNumber != null && w.Machine.SerialNumber.ToLower().Contains(term)) ||
                (w.AssignedUser != null && w.AssignedUser.FullName.ToLower().Contains(term)));
        }

        // 1. Summary counts across current scope (respecting resolvedRange for Resolved column count)
        var normResolvedRange = (resolvedRange ?? "7d").Trim().ToLowerInvariant();
        DateTime? resolvedCutoffUtc = normResolvedRange switch
        {
            "24h" => nowUtc.AddHours(-24),
            "7d" => nowUtc.AddDays(-7),
            "30d" => nowUtc.AddDays(-30),
            _ => null
        };

        var summaryRows = await scopedQuery
            .Select(w => new { w.Status, w.Type, w.DueDate, w.ResolvedAt, w.CreatedAt })
            .ToListAsync(ct);

        int openCount = 0, inProgressCount = 0, reviewCount = 0, resolvedCount = 0, overdueCount = 0, criticalOpenCount = 0, scheduledTodayCount = 0;
        var todayUtc = nowUtc.Date;
        foreach (var row in summaryRows)
        {
            var normalized = NormalizeStatus(row.Status);
            if (normalized == "Resolved")
            {
                var refTime = row.ResolvedAt ?? row.CreatedAt;
                if (!resolvedCutoffUtc.HasValue || DateTime.SpecifyKind(refTime, DateTimeKind.Utc) >= resolvedCutoffUtc.Value)
                {
                    resolvedCount++;
                }
            }
            else
            {
                if (normalized == "InProgress") inProgressCount++;
                else if (normalized == "Review") reviewCount++;
                else openCount++;

                if (row.Type == "Critical") criticalOpenCount++;
                if (row.DueDate.HasValue)
                {
                    var dueUtc = DateTime.SpecifyKind(row.DueDate.Value, DateTimeKind.Utc);
                    if (dueUtc < nowUtc) overdueCount++;
                    else if (dueUtc.Date == todayUtc) scheduledTodayCount++;
                }
            }
        }

        var summary = new MaintenanceSummaryDto(
            Total: openCount + inProgressCount + reviewCount + resolvedCount,
            Open: openCount,
            InProgress: inProgressCount,
            Review: reviewCount,
            Resolved: resolvedCount,
            Overdue: overdueCount,
            CriticalOpen: criticalOpenCount,
            ScheduledToday: scheduledTodayCount);

        // 2. Team workload (all active users in hall scope + their open/in-progress count)
        var usersQuery = db.Users.AsNoTracking().Where(u => u.IsActive);
        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            usersQuery = usersQuery.Where(u => u.FactoryHallId == hallId || u.Role == UserRole.SuperAdmin);
        }
        var hallUsers = await usersQuery
            .OrderBy(u => u.Role == UserRole.Technician ? 0 : u.Role == UserRole.HallAdmin ? 1 : 2)
            .ThenBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.Role, u.FactoryHallId })
            .ToListAsync(ct);

        var activeCountsByUser = await baseQuery
            .Where(w => w.AssignedUserId != null && w.Status != "Resolved")
            .GroupBy(w => w.AssignedUserId!.Value)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        var assignees = hallUsers
            .Select(u => new MaintenanceAssigneeDto(
                u.Id,
                u.FullName,
                u.Role.ToString(),
                u.FactoryHallId,
                activeCountsByUser.GetValueOrDefault(u.Id, 0)))
            .OrderByDescending(a => a.ActiveWorkOrdersCount)
            .ThenBy(a => a.FullName)
            .ToList();

        // 3. Machines currently in Maintenance or Error (service attention list)
        var attentionQuery = db.Machines.AsNoTracking()
            .Where(m => m.IsActive && (m.Status == MachineStatus.Maintenance || m.Status == MachineStatus.Error));
        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            attentionQuery = attentionQuery.Where(m => m.FactoryHallId == hallId);
        }
        var attentionRaw = await attentionQuery
            .OrderBy(m => m.Status == MachineStatus.Maintenance ? 0 : 1)
            .ThenBy(m => m.Name)
            .Take(8)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.SerialNumber,
                m.Status,
                m.TelemetrySource,
                m.FactoryHallId,
                FactoryHallName = m.FactoryHall.Name,
                ProductionLineName = m.ProductionLine != null ? m.ProductionLine.Name : null
            })
            .ToListAsync(ct);

        var attentionIds = attentionRaw.Select(m => m.Id).ToList();
        var attentionWoCounts = attentionIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.WorkOrders.AsNoTracking()
                .Where(w => attentionIds.Contains(w.MachineId) && w.Status != "Resolved")
                .GroupBy(w => w.MachineId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var attentionMachines = attentionRaw
            .Select(m => new MaintenanceAttentionMachineDto(
                m.Id,
                m.Name,
                m.SerialNumber,
                m.Status.ToString(),
                m.TelemetrySource.ToString(),
                m.FactoryHallId,
                m.FactoryHallName,
                m.ProductionLineName,
                attentionWoCounts.GetValueOrDefault(m.Id, 0)))
            .ToList();

        // 4. Filtered + paginated work orders
        var filteredQuery = scopedQuery;
        if (resolvedCutoffUtc.HasValue)
        {
            var cutoff = resolvedCutoffUtc.Value;
            filteredQuery = filteredQuery.Where(w =>
                w.Status != "Resolved" ||
                (w.ResolvedAt != null ? w.ResolvedAt >= cutoff : w.CreatedAt >= cutoff));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim();
            if (string.Equals(st, "Overdue", StringComparison.OrdinalIgnoreCase))
            {
                filteredQuery = filteredQuery.Where(w => w.Status != "Resolved" && w.DueDate != null && w.DueDate < nowUtc);
            }
            else if (string.Equals(st, "DueToday", StringComparison.OrdinalIgnoreCase))
            {
                var tomorrowUtc = todayUtc.AddDays(1);
                filteredQuery = filteredQuery.Where(w => w.Status != "Resolved" && w.DueDate != null && w.DueDate >= nowUtc && w.DueDate < tomorrowUtc);
            }
            else if (string.Equals(st, "Open", StringComparison.OrdinalIgnoreCase))
            {
                filteredQuery = filteredQuery.Where(w => w.Status == "Open" || w.Status == "To Do");
            }
            else if (AllowedStatuses.Contains(st))
            {
                filteredQuery = filteredQuery.Where(w => w.Status == st);
            }
        }

        var totalFiltered = await filteredQuery.CountAsync(ct);
        var pageRows = await filteredQuery
            .OrderBy(w => w.Status == "Resolved" ? 2 : w.Type == "Critical" ? 0 : 1)
            .ThenBy(w => w.DueDate ?? DateTime.MaxValue)
            .ThenByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => new
            {
                w.Id,
                w.TicketNumber,
                w.Title,
                w.Description,
                w.Type,
                w.Status,
                w.MachineId,
                MachineName = w.Machine!.Name,
                MachineSerialNumber = w.Machine.SerialNumber,
                MachineStatus = w.Machine.Status,
                w.Machine.FactoryHallId,
                FactoryHallName = w.Machine.FactoryHall.Name,
                ProductionLineName = w.Machine.ProductionLine != null ? w.Machine.ProductionLine.Name : null,
                w.AssignedUserId,
                AssigneeName = w.AssignedUser != null ? w.AssignedUser.FullName : null,
                w.CreatedAt,
                w.DueDate,
                w.ResolvedAt
            })
            .ToListAsync(ct);

        var items = pageRows.Select(r =>
        {
            var normalizedStatus = NormalizeStatus(r.Status);
            var createdUtc = DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc);
            var dueUtc = r.DueDate.HasValue ? DateTime.SpecifyKind(r.DueDate.Value, DateTimeKind.Utc) : (DateTime?)null;
            var resolvedUtc = r.ResolvedAt.HasValue ? DateTime.SpecifyKind(r.ResolvedAt.Value, DateTimeKind.Utc) : (DateTime?)null;
            var isOverdue = normalizedStatus != "Resolved" && dueUtc.HasValue && dueUtc.Value < nowUtc;

            return new MaintenanceWorkOrderDto(
                r.Id,
                r.TicketNumber,
                r.Title,
                r.Description,
                r.Type,
                normalizedStatus,
                r.MachineId,
                r.MachineName,
                r.MachineSerialNumber,
                r.MachineStatus.ToString(),
                r.FactoryHallId,
                r.FactoryHallName,
                r.ProductionLineName,
                r.AssignedUserId,
                r.AssigneeName,
                createdUtc,
                dueUtc,
                resolvedUtc,
                isOverdue);
        }).ToList();

        return Ok(new MaintenanceOverviewDto(
            new PagedResult<MaintenanceWorkOrderDto>
            {
                Data = items,
                TotalCount = totalFiltered,
                PageNumber = page,
                PageSize = pageSize
            },
            summary,
            assignees,
            attentionMachines,
            nowUtc));
    }

    [HttpGet("machines")]
    public async Task<ActionResult<List<MaintenanceMachineOptionDto>>> GetMachines(
        [FromQuery] Guid? factoryHallId = null,
        CancellationToken ct = default)
    {
        if (!HasAccess()) return Forbid();
        if (!user.IsSuperAdmin && factoryHallId.HasValue && factoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Factory hall not found." });
        }

        var effectiveHallId = user.IsSuperAdmin ? factoryHallId : user.FactoryHallId;
        var query = db.Machines.AsNoTracking().Where(m => m.IsActive);
        if (effectiveHallId.HasValue)
        {
            var hallId = effectiveHallId.Value;
            query = query.Where(m => m.FactoryHallId == hallId);
        }

        var options = await query
            .OrderBy(m => m.FactoryHall.Name)
            .ThenBy(m => m.Name)
            .Select(m => new MaintenanceMachineOptionDto(
                m.Id,
                m.Name,
                m.SerialNumber,
                m.Status.ToString(),
                m.FactoryHallId,
                m.FactoryHall.Name,
                m.ProductionLine != null ? m.ProductionLine.Name : null))
            .ToListAsync(ct);

        return Ok(options);
    }

    [HttpPost("workorders")]
    public async Task<ActionResult<MaintenanceWorkOrderDto>> CreateWorkOrder(
        [FromBody] CreateMaintenanceWorkOrderDto dto,
        CancellationToken ct = default)
    {
        if (!HasAccess()) return Forbid();

        var machine = await db.Machines.AsNoTracking()
            .Include(m => m.FactoryHall)
            .Include(m => m.ProductionLine)
            .FirstOrDefaultAsync(m => m.Id == dto.MachineId && m.IsActive, ct);

        if (machine is null)
        {
            return NotFound(new { message = "Machine not found." });
        }

        if (!user.IsSuperAdmin && machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Machine not found." });
        }

        var type = string.IsNullOrWhiteSpace(dto.Type) ? "Routine" : dto.Type.Trim();
        if (!AllowedTypes.Contains(type))
        {
            return BadRequest(new { message = "Type must be Routine, Predictive, or Critical." });
        }

        User? assignee = null;
        if (dto.AssignedUserId.HasValue)
        {
            assignee = await db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == dto.AssignedUserId.Value && u.IsActive, ct);
            if (assignee is null)
            {
                return BadRequest(new { message = "Assigned user not found." });
            }
        }

        var code = string.IsNullOrWhiteSpace(machine.SerialNumber)
            ? machine.Id.ToString("N")[..4].ToUpperInvariant()
            : machine.SerialNumber.Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
        if (code.Length > 10) code = code[..10];

        var nowUtc = DateTime.UtcNow;
        var dueUtc = dto.DueDateUtc.HasValue ? DateTime.SpecifyKind(dto.DueDateUtc.Value.ToUniversalTime(), DateTimeKind.Utc) : nowUtc.AddDays(3);

        var workOrder = new WorkOrder
        {
            Id = Guid.NewGuid(),
            TicketNumber = $"WO-{code}-{Guid.NewGuid().ToString("N")[..5].ToUpperInvariant()}",
            MachineId = machine.Id,
            Title = dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Type = type,
            Status = "Open",
            AssignedUserId = assignee?.Id,
            CreatedAt = nowUtc,
            DueDate = dueUtc
        };

        db.WorkOrders.Add(workOrder);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetOverview), new { id = workOrder.Id }, new MaintenanceWorkOrderDto(
            workOrder.Id,
            workOrder.TicketNumber,
            workOrder.Title,
            workOrder.Description,
            workOrder.Type,
            workOrder.Status,
            machine.Id,
            machine.Name,
            machine.SerialNumber,
            machine.Status.ToString(),
            machine.FactoryHallId,
            machine.FactoryHall.Name,
            machine.ProductionLine?.Name,
            workOrder.AssignedUserId,
            assignee?.FullName,
            nowUtc,
            dueUtc,
            null,
            dueUtc < nowUtc));
    }

    [HttpPatch("workorders/{id:guid}")]
    public async Task<IActionResult> PatchWorkOrder(
        Guid id,
        [FromBody] PatchMaintenanceWorkOrderDto dto,
        CancellationToken ct = default)
    {
        if (!HasAccess()) return Forbid();

        var workOrder = await db.WorkOrders
            .Include(w => w.Machine)
            .FirstOrDefaultAsync(w => w.Id == id && w.Machine != null && w.Machine.IsActive, ct);

        if (workOrder?.Machine is null)
        {
            return NotFound(new { message = "Work order not found." });
        }

        if (!user.IsSuperAdmin && workOrder.Machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Work order not found." });
        }

        if (dto.Status is not null)
        {
            var nextStatus = dto.Status.Trim();
            if (!AllowedStatuses.Contains(nextStatus))
            {
                return BadRequest(new { message = "Status must be Open, InProgress, Review, or Resolved." });
            }
            workOrder.Status = nextStatus;
            workOrder.ResolvedAt = nextStatus == "Resolved" ? DateTime.UtcNow : null;
        }

        if (dto.Type is not null)
        {
            var nextType = dto.Type.Trim();
            if (!AllowedTypes.Contains(nextType))
            {
                return BadRequest(new { message = "Type must be Routine, Predictive, or Critical." });
            }
            workOrder.Type = nextType;
        }

        if (dto.Title is not null && !string.IsNullOrWhiteSpace(dto.Title))
        {
            workOrder.Title = dto.Title.Trim();
        }

        if (dto.Description is not null)
        {
            workOrder.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        }

        if (dto.ClearAssignee)
        {
            workOrder.AssignedUserId = null;
        }
        else if (dto.AssignedUserId.HasValue)
        {
            var exists = await db.Users.AsNoTracking().AnyAsync(u => u.Id == dto.AssignedUserId.Value && u.IsActive, ct);
            if (!exists) return BadRequest(new { message = "Assigned user not found." });
            workOrder.AssignedUserId = dto.AssignedUserId.Value;
        }

        if (dto.ClearDueDate)
        {
            workOrder.DueDate = null;
        }
        else if (dto.DueDateUtc.HasValue)
        {
            workOrder.DueDate = DateTime.SpecifyKind(dto.DueDateUtc.Value.ToUniversalTime(), DateTimeKind.Utc);
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpDelete("workorders/{id:guid}")]
    public async Task<IActionResult> DeleteWorkOrder(Guid id, CancellationToken ct = default)
    {
        if (!HasAccess()) return Forbid();

        var workOrder = await db.WorkOrders
            .Include(w => w.Machine)
            .FirstOrDefaultAsync(w => w.Id == id && w.Machine != null && w.Machine.IsActive, ct);

        if (workOrder?.Machine is null)
        {
            return NotFound(new { message = "Work order not found." });
        }

        if (!user.IsSuperAdmin && workOrder.Machine.FactoryHallId != user.FactoryHallId)
        {
            return NotFound(new { message = "Work order not found." });
        }

        db.WorkOrders.Remove(workOrder);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static string NormalizeStatus(string? status) =>
        status switch
        {
            "InProgress" => "InProgress",
            "Review" => "Review",
            "Resolved" => "Resolved",
            _ => "Open"
        };
}
