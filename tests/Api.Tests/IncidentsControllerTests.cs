using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Controllers;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public sealed class IncidentsControllerTests
{
    private sealed class StubUserContext(UserRole role, Guid? hallId, bool authenticated = true) : IUserContext
    {
        public Guid? UserId => Guid.NewGuid();
        public string? Email => "test@smartfactory.local";
        public UserRole? Role => role;
        public Guid? FactoryHallId => hallId;
        public bool IsAuthenticated => authenticated;
        public bool IsSuperAdmin => role == UserRole.SuperAdmin;
        public bool IsHallAdmin => role == UserRole.HallAdmin;
        public bool IsTechnician => role == UserRole.Technician;
        public bool HasAccessToHall(Guid targetHallId) => IsSuperAdmin || FactoryHallId == targetHallId;
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task<(Guid HallA, Guid HallB, Guid MachineA, Guid MachineB, Guid ActiveIncidentId)> SeedAsync(ApplicationDbContext db)
    {
        var hallA = new FactoryHall { Id = Guid.NewGuid(), Name = "Hall A" };
        var hallB = new FactoryHall { Id = Guid.NewGuid(), Name = "Hall B" };
        var lineA = new ProductionLine { Id = Guid.NewGuid(), Name = "Line A1", FactoryHallId = hallA.Id };
        var machineA = new Machine
        {
            Id = Guid.NewGuid(),
            Name = "CNC Mill #1",
            Category = "Milling",
            SerialNumber = "CNC-001",
            FactoryHallId = hallA.Id,
            ProductionLineId = lineA.Id,
            Status = MachineStatus.Error,
            IsActive = true
        };
        var machineB = new Machine
        {
            Id = Guid.NewGuid(),
            Name = "Hydraulic Press #2",
            Category = "Press",
            SerialNumber = "HP-002",
            FactoryHallId = hallB.Id,
            Status = MachineStatus.Running,
            IsActive = true
        };

        var activeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.FactoryHalls.AddRange(hallA, hallB);
        db.ProductionLines.Add(lineA);
        db.Machines.AddRange(machineA, machineB);
        db.Incidents.AddRange(
            new Incident { Id = activeId, MachineId = machineA.Id, Severity = "Critical", Status = "Active", Message = "Simulation: CNC Mill #1: Error (Overheating); T=96.50°C", TriggeredAt = now.AddMinutes(-10) },
            new Incident { Id = Guid.NewGuid(), MachineId = machineA.Id, Severity = "Warning", Status = "Acknowledged", Message = "Vibration spike on spindle", TriggeredAt = now.AddHours(-3) },
            new Incident { Id = Guid.NewGuid(), MachineId = machineA.Id, Severity = "Warning", Status = "Resolved", Message = "Coolant pressure dip", TriggeredAt = now.AddDays(-2) },
            new Incident { Id = Guid.NewGuid(), MachineId = machineB.Id, Severity = "Critical", Status = "Active", Message = "E-Stop triggered", TriggeredAt = now.AddMinutes(-5) });
        await db.SaveChangesAsync();

        return (hallA.Id, hallB.Id, machineA.Id, machineB.Id, activeId);
    }

    [Fact]
    public async Task SuperAdminGetsFilteredHistorySummaryActivityAndHotspots()
    {
        await using var db = CreateDb();
        var (hallA, _, machineA, _, _) = await SeedAsync(db);
        var controller = new IncidentsController(db, new StubUserContext(UserRole.SuperAdmin, null));

        var result = await controller.GetHistory(page: 1, pageSize: 10, factoryHallId: hallA, status: "Open", range: "24h");
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<IncidentHistoryResponseDto>(ok.Value);

        Assert.Equal(2, dto.Items.TotalCount);
        Assert.Equal(2, dto.Items.Data.Count);
        Assert.Equal(2, dto.Summary.Total);
        Assert.Equal(1, dto.Summary.Active);
        Assert.Equal(1, dto.Summary.Acknowledged);
        Assert.Equal(0, dto.Summary.Resolved);
        Assert.Equal(12, dto.Activity.Count);
        Assert.Single(dto.Hotspots);
        Assert.Equal(machineA, dto.Hotspots[0].MachineId);
    }

    [Fact]
    public async Task HallAdminIsScopedToOwnHallAndCannotModifyOtherHallIncidents()
    {
        await using var db = CreateDb();
        var (hallA, hallB, _, machineB, activeA) = await SeedAsync(db);
        var otherIncidentId = await db.Incidents.Where(i => i.MachineId == machineB).Select(i => i.Id).SingleAsync();
        var controller = new IncidentsController(db, new StubUserContext(UserRole.HallAdmin, hallA));

        // Requesting another hall returns 404
        var deniedHall = await controller.GetHistory(factoryHallId: hallB);
        Assert.IsType<NotFoundObjectResult>(deniedHall.Result);

        // Own hall returns only Hall A incidents
        var ownResult = await controller.GetHistory();
        var ownOk = Assert.IsType<OkObjectResult>(ownResult.Result);
        var dto = Assert.IsType<IncidentHistoryResponseDto>(ownOk.Value);
        Assert.Equal(3, dto.Items.TotalCount);
        Assert.All(dto.Items.Data, i => Assert.Equal(hallA, i.FactoryHallId));

        // Cannot update Hall B incident
        var deniedUpdate = await controller.UpdateStatus(otherIncidentId, new UpdateIncidentStatusDto("Resolved"), CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(deniedUpdate);

        // Can acknowledge & resolve own Hall A incident
        var ackResult = await controller.UpdateStatus(activeA, new UpdateIncidentStatusDto("Acknowledged"), CancellationToken.None);
        Assert.IsType<NoContentResult>(ackResult);
        Assert.Equal("Acknowledged", (await db.Incidents.FindAsync(activeA))!.Status);
    }

    [Fact]
    public async Task InvalidStatusUpdateReturns400()
    {
        await using var db = CreateDb();
        var (_, _, _, _, activeId) = await SeedAsync(db);
        var controller = new IncidentsController(db, new StubUserContext(UserRole.SuperAdmin, null));

        var bad = await controller.UpdateStatus(activeId, new UpdateIncidentStatusDto("Bogus"), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(bad);
    }

    [Fact]
    public async Task DefaultSevenDayRangeExcludesOlderResolvedIncidentsWhileAllIncludesThem()
    {
        await using var db = CreateDb();
        var (hallA, _, machineA, _, _) = await SeedAsync(db);
        db.Incidents.Add(new Incident
        {
            Id = Guid.NewGuid(),
            MachineId = machineA,
            Severity = "Warning",
            Status = "Resolved",
            Message = "Old archived sensor drift",
            TriggeredAt = DateTime.UtcNow.AddDays(-20)
        });
        await db.SaveChangesAsync();

        var controller = new IncidentsController(db, new StubUserContext(UserRole.SuperAdmin, null));

        var defaultRes = Assert.IsType<OkObjectResult>((await controller.GetHistory(factoryHallId: hallA)).Result);
        var defaultDto = Assert.IsType<IncidentHistoryResponseDto>(defaultRes.Value);
        Assert.Equal(3, defaultDto.Items.TotalCount);
        Assert.Equal(1, defaultDto.Summary.Resolved);

        var allRes = Assert.IsType<OkObjectResult>((await controller.GetHistory(factoryHallId: hallA, range: "all")).Result);
        var allDto = Assert.IsType<IncidentHistoryResponseDto>(allRes.Value);
        Assert.Equal(4, allDto.Items.TotalCount);
        Assert.Equal(2, allDto.Summary.Resolved);

        // includeInsights=false skips activity & hotspot queries while preserving exact .Skip/.Take pagination and summary
        for (int i = 0; i < 3; i++)
        {
            db.Incidents.Add(new Incident
            {
                Id = Guid.NewGuid(),
                MachineId = machineA,
                Severity = "Warning",
                Status = "Resolved",
                Message = $"Historical event #{i}",
                TriggeredAt = DateTime.UtcNow.AddDays(-25 - i)
            });
        }
        await db.SaveChangesAsync();

        var page1Res = Assert.IsType<OkObjectResult>((await controller.GetHistory(page: 1, pageSize: 5, factoryHallId: hallA, range: "all", includeInsights: false)).Result);
        var page1Dto = Assert.IsType<IncidentHistoryResponseDto>(page1Res.Value);
        Assert.Equal(7, page1Dto.Items.TotalCount);
        Assert.Equal(5, page1Dto.Items.Data.Count);
        Assert.Empty(page1Dto.Activity);
        Assert.Empty(page1Dto.Hotspots);

        var page2Res = Assert.IsType<OkObjectResult>((await controller.GetHistory(page: 2, pageSize: 5, factoryHallId: hallA, range: "all", includeInsights: false)).Result);
        var page2Dto = Assert.IsType<IncidentHistoryResponseDto>(page2Res.Value);
        Assert.Equal(7, page2Dto.Items.TotalCount);
        Assert.Equal(2, page2Dto.Items.Data.Count);
    }
}
