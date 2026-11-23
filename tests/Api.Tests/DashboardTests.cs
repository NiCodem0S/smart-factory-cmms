using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Controllers;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public sealed class DashboardTests
{
    [Theory]
    [InlineData("HallAdmin")]
    [InlineData("Technician")]
    public async Task ScopedRolesCannotSeeAnotherHallsMachinesReadingsOrIncidents(string role)
    {
        using var db = Memory();
        var own = new FactoryHall { Name = "Assembly" };
        var other = new FactoryHall { Name = "Welding" };
        var allowed = Machine(own, "Assembler", MachineStatus.Running, 10);
        var denied = Machine(other, "Welder", MachineStatus.Error, 24);
        db.AddRange(allowed, denied);
        db.TelemetryRead.AddRange(new TelemetryRead { Machine = allowed, PowerLoadKw = 4 },
            new TelemetryRead { Machine = denied, PowerLoadKw = 30 });
        db.Incidents.AddRange(new Incident { Machine = allowed, Severity = "Warning", Message = "Allowed" },
            new Incident { Machine = denied, Severity = "Critical", Message = "Denied" });
        await db.SaveChangesAsync();

        var dashboard = Controller(db, role, own.Id);
        var result = await Load(dashboard);

        Assert.Equal(own.Id, result.FactoryHallId);
        Assert.Equal(own.Id, Assert.Single(result.HallIds));
        Assert.Equal(allowed.Id, Assert.Single(result.Machines).Id);
        Assert.Equal(allowed.Id, Assert.Single(result.Incidents).MachineId);
        Assert.Equal(0, result.Summary.ActiveCriticalIncidents);
        Assert.Equal(10, result.Summary.TotalProduced);
        Assert.Equal(4, result.Summary.PowerLoadKw);
        Assert.IsType<NotFoundObjectResult>((await dashboard.Get(other.Id, default)).Result);
    }

    [Fact]
    public async Task SuperAdminCanReadAllHallsOrSelectOneIncludingEmptyHalls()
    {
        using var db = Memory();
        var first = new FactoryHall { Name = "Assembly" };
        var second = new FactoryHall { Name = "Welding" };
        var empty = new FactoryHall { Name = "Storage" };
        var line = new ProductionLine { FactoryHall = second, Name = "Welding line" };
        var firstMachine = Machine(first, "Assembler", MachineStatus.Running, 10);
        var secondMachine = Machine(second, "Welder", MachineStatus.Warning, 25);
        secondMachine.ProductionLine = line;
        secondMachine.OrderInLine = 4;
        var retired = Machine(second, "Retired", MachineStatus.Offline, 999);
        retired.IsActive = false;
        db.AddRange(firstMachine, secondMachine, retired, empty);
        await db.SaveChangesAsync();

        var dashboard = Controller(db, "SuperAdmin");
        var all = await Load(dashboard);
        Assert.Null(all.FactoryHallId);
        Assert.Equal(new[] { first.Id, empty.Id, second.Id }, all.HallIds);
        Assert.Equal(new[] { firstMachine.Id, secondMachine.Id }, all.Machines.Select(m => m.Id));
        Assert.Equal(2, all.Summary.TotalMachines);
        Assert.Equal(1, all.Summary.RunningMachines);
        Assert.Equal(1, all.Summary.WarningMachines);
        Assert.Equal(0, all.Summary.OfflineMachines);
        Assert.Equal(35, all.Summary.TotalProduced);

        var selected = await Load(dashboard, second.Id);
        var selectedMachine = Assert.Single(selected.Machines);
        Assert.Equal(line.Id, selectedMachine.ProductionLineId);
        Assert.Equal(line.Name, selectedMachine.ProductionLineName);
        Assert.Equal(4, selectedMachine.OrderInLine);
        Assert.Equal(25, selected.Summary.TotalProduced);

        var noMachines = await Load(dashboard, empty.Id);
        Assert.Equal(empty.Id, Assert.Single(noMachines.HallIds));
        Assert.Empty(noMachines.Machines);
        Assert.Empty(noMachines.Incidents);
        Assert.Null(noMachines.Summary.PowerLoadKw);
        Assert.Null(noMachines.Summary.AverageLatencyMs);
        Assert.IsType<NotFoundObjectResult>((await dashboard.Get(Guid.NewGuid(), default)).Result);
    }

    [Fact]
    public async Task MachinesKeepLatestRealReadingButFleetMetricsExcludeStaleAndFutureReadings()
    {
        using var db = Memory();
        var hall = new FactoryHall { Name = "Assembly" };
        var fresh = Machine(hall, "Fresh", MachineStatus.Running, 12);
        var stale = Machine(hall, "Stale", MachineStatus.Maintenance, 3);
        var neverRead = Machine(hall, "Never read", MachineStatus.Offline, 0);
        db.AddRange(fresh, stale, neverRead);
        var now = DateTime.UtcNow;
        db.TelemetryRead.AddRange(
            new TelemetryRead { Machine = fresh, Timestamp = now.AddSeconds(-30), Temperature = 67, PowerLoadKw = 21 },
            new TelemetryRead { Machine = fresh, Timestamp = DateTime.SpecifyKind(now.AddSeconds(-4), DateTimeKind.Unspecified), Temperature = 68, PowerLoadKw = 0, NetworkLatencyMs = 20 },
            new TelemetryRead { Machine = fresh, Timestamp = now.AddSeconds(-2) },
            new TelemetryRead { Machine = fresh, Timestamp = now.AddMinutes(5), Temperature = 98, PowerLoadKw = 500 },
            new TelemetryRead { Machine = stale, Timestamp = now.AddMinutes(-5), PowerLoadKw = 42, NetworkLatencyMs = 150 });
        await db.SaveChangesAsync();

        var result = await Load(Controller(db, "SuperAdmin"));
        var freshReading = Assert.IsType<DashboardTelemetryDto>(result.Machines.Single(m => m.Id == fresh.Id).LatestTelemetry);
        Assert.Equal(68, freshReading.Temperature);
        Assert.Equal(DateTimeKind.Utc, freshReading.TimestampUtc.Kind);
        Assert.Equal(42, result.Machines.Single(m => m.Id == stale.Id).LatestTelemetry!.PowerLoadKw);
        Assert.Null(result.Machines.Single(m => m.Id == neverRead.Id).LatestTelemetry);
        Assert.Equal(1, result.Summary.MachinesWithPowerReadings);
        Assert.Equal(0, result.Summary.PowerLoadKw);
        Assert.Equal(20, result.Summary.AverageLatencyMs);
    }

    [Fact]
    public async Task RecentIncidentFeedIsBoundedAndActiveCriticalCountIncludesOlderIncidents()
    {
        using var db = Memory();
        var hall = new FactoryHall { Name = "Assembly" };
        var machine = Machine(hall, "Assembler", MachineStatus.Running, 10);
        db.Add(machine);
        var now = DateTime.UtcNow;
        var recent = Enumerable.Range(1, 25).Select(i => new Incident
        {
            Machine = machine, TriggeredAt = now.AddMinutes(-i), Message = $"Recent {i}", Severity = "Warning"
        }).ToArray();
        db.Incidents.AddRange(recent);
        db.Incidents.AddRange(
            new Incident { Machine = machine, TriggeredAt = now.AddDays(-1), Severity = "Critical", Status = "Active" },
            new Incident { Machine = machine, TriggeredAt = now.AddDays(-2), Severity = "Critical", Status = "Resolved" },
            new Incident { Machine = machine, TriggeredAt = now.AddDays(1), Severity = "Critical", Status = "Active" });
        await db.SaveChangesAsync();

        var result = await Load(Controller(db, "SuperAdmin"));
        Assert.Equal(1, result.Summary.ActiveCriticalIncidents);
        Assert.Equal(recent.Take(20).Select(i => i.Id), result.Incidents.Select(i => i.Id));
        Assert.All(result.Incidents, i => Assert.Equal(DateTimeKind.Utc, i.TriggeredAtUtc.Kind));
    }

    [Fact]
    public async Task TechnicianWithoutAnAssignedHallCannotRequestTheDashboard()
    {
        using var db = Memory();
        var result = await Controller(db, "Technician").Get(null, default);
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task DashboardReturnsScopedLinesWorkOrdersThresholdsAndSupportsActions()
    {
        using var db = Memory();
        var hallA = new FactoryHall { Name = "Hala A" };
        var hallB = new FactoryHall { Name = "Hala B" };
        var product = new Product { Name = "EV Pack", SKUNumber = "SKU-EV1" };
        var lineA = new ProductionLine { FactoryHall = hallA, Name = "Battery Line", Status = "Running", CurrentProduct = product, OrderInHall = 1 };
        var lineB = new ProductionLine { FactoryHall = hallB, Name = "Welding Line", Status = "Halted", OrderInHall = 1 };
        var machineA = Machine(hallA, "Laser Welder LW-02", MachineStatus.Error, 120);
        machineA.SerialNumber = "LW02-2023";
        machineA.ProductionLine = lineA;
        machineA.OrderInLine = 2;
        var machineB = Machine(hallB, "Spot Welder SW-22", MachineStatus.Warning, 50);
        machineB.ProductionLine = lineB;
        var techA = new User { FullName = "Anna Smith", Email = "anna@test.local", PasswordHash = "hash", Role = UserRole.Technician, FactoryHall = hallA, IsActive = true };
        var incidentA = new Incident { Machine = machineA, Severity = "Critical", Status = "Active", Message = "Overheat" };
        var incidentB = new Incident { Machine = machineB, Severity = "Warning", Status = "Active", Message = "Vib" };
        var thresholdA = new AlertThreshold { Machine = machineA, MetricType = "Temperature", WarningValue = 90m, CriticalValue = 110m };
        db.AddRange(hallA, hallB, product, lineA, lineB, machineA, machineB, techA, incidentA, incidentB, thresholdA);
        await db.SaveChangesAsync();

        var hallAdminA = Controller(db, "HallAdmin", hallA.Id);
        var snapshot = await Load(hallAdminA);
        Assert.Single(snapshot.ProductionLines!);
        Assert.Equal("EV Pack", snapshot.ProductionLines![0].ProductName);
        Assert.Single(snapshot.Thresholds!);

        // Dispatch work order for machine in own hall
        var dispatchResult = await hallAdminA.DispatchWorkOrder(new DispatchWorkOrderDto(machineA.Id), default);
        var dispatched = Assert.IsType<DashboardWorkOrderDto>(Assert.IsType<OkObjectResult>(dispatchResult.Result).Value);
        Assert.Equal("InProgress", dispatched.Status);
        Assert.Equal("Anna Smith", dispatched.AssigneeName);
        Assert.Equal("Critical", dispatched.Type);

        // Update work order status
        Assert.IsType<NoContentResult>(await hallAdminA.UpdateWorkOrderStatus(dispatched.Id, new UpdateWorkOrderStatusDto("Resolved"), default));
        Assert.Equal("Resolved", (await db.WorkOrders.SingleAsync(w => w.Id == dispatched.Id)).Status);

        // Update incident status in own hall, blocked for other hall
        Assert.IsType<NoContentResult>(await hallAdminA.UpdateIncidentStatus(incidentA.Id, new UpdateIncidentStatusDto("Acknowledged"), default));
        Assert.Equal("Acknowledged", (await db.Incidents.SingleAsync(i => i.Id == incidentA.Id)).Status);
        Assert.IsType<NotFoundObjectResult>(await hallAdminA.UpdateIncidentStatus(incidentB.Id, new UpdateIncidentStatusDto("Resolved"), default));
        Assert.IsType<NotFoundObjectResult>((await hallAdminA.DispatchWorkOrder(new DispatchWorkOrderDto(machineB.Id), default)).Result);
    }

    [Fact]
    public void LatestTelemetryProjectionTranslatesToSql()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=localhost;Database=QueryTranslationOnly;Integrated Security=True;TrustServerCertificate=True").Options);
        var hallId = Guid.NewGuid();
        var sql = DashboardQuery.ProjectMachines(db.Machines.Where(m => m.IsActive && m.FactoryHallId == hallId),
            db.TelemetryRead, DateTime.UtcNow).ToQueryString();
        Assert.Contains("[TelemetryRead]", sql);
        Assert.Contains("SELECT TOP(1)", sql);
        Assert.Contains("[Timestamp] DESC", sql);
        Assert.Contains("[FactoryHallId]", sql);
    }

    private static ApplicationDbContext Memory() => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Machine Machine(FactoryHall hall, string name, MachineStatus status, int totalProduced) =>
        new() { FactoryHall = hall, Name = name, Status = status, TotalProduced = totalProduced };

    private static DashboardController Controller(ApplicationDbContext db, string role, Guid? hallId = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        if (hallId.HasValue)
        {
            claims.Add(new Claim("hallId", hallId.Value.ToString()));
        }

        var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) };
        return new DashboardController(db, new UserContext(new HttpContextAccessor { HttpContext = context }));
    }

    private static async Task<DashboardDto> Load(DashboardController controller, Guid? hallId = null)
    {
        var response = await controller.Get(hallId, default);
        return Assert.IsType<DashboardDto>(Assert.IsType<OkObjectResult>(response.Result).Value);
    }
}
