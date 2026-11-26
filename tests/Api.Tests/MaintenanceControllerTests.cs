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

public sealed class MaintenanceControllerTests
{
    private sealed class StubUserContext(UserRole role, Guid? hallId, bool authenticated = true) : IUserContext
    {
        public Guid? UserId => Guid.NewGuid();
        public string? Email => "maint-test@smartfactory.local";
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

    private static async Task<(Guid HallA, Guid HallB, Guid MachineA, Guid MachineB, Guid TechA)> SeedAsync(ApplicationDbContext db)
    {
        var hallA = new FactoryHall { Id = Guid.NewGuid(), Name = "Hall A" };
        var hallB = new FactoryHall { Id = Guid.NewGuid(), Name = "Hall B" };
        var techA = new User { Id = Guid.NewGuid(), FullName = "Jan Kowalski", Email = "jan@test.local", PasswordHash = "x", Role = UserRole.Technician, FactoryHallId = hallA.Id, IsActive = true };
        var machineA = new Machine { Id = Guid.NewGuid(), Name = "CNC Mill #1", Category = "Milling", SerialNumber = "CNC-01", FactoryHallId = hallA.Id, Status = MachineStatus.Maintenance, IsActive = true };
        var machineB = new Machine { Id = Guid.NewGuid(), Name = "Press #2", Category = "Press", SerialNumber = "PR-02", FactoryHallId = hallB.Id, Status = MachineStatus.Running, IsActive = true };

        var now = DateTime.UtcNow;
        db.FactoryHalls.AddRange(hallA, hallB);
        db.Users.Add(techA);
        db.Machines.AddRange(machineA, machineB);
        db.WorkOrders.AddRange(
            new WorkOrder { Id = Guid.NewGuid(), TicketNumber = "WO-A1", MachineId = machineA.Id, Title = "Overdue spindle repair", Type = "Critical", Status = "Open", AssignedUserId = techA.Id, CreatedAt = now.AddDays(-5), DueDate = now.AddDays(-1) },
            new WorkOrder { Id = Guid.NewGuid(), TicketNumber = "WO-A2", MachineId = machineA.Id, Title = "Coolant flush", Type = "Routine", Status = "Resolved", AssignedUserId = techA.Id, CreatedAt = now.AddDays(-3), DueDate = now.AddDays(1), ResolvedAt = now.AddHours(-2) },
            new WorkOrder { Id = Guid.NewGuid(), TicketNumber = "WO-B1", MachineId = machineB.Id, Title = "Hall B check", Type = "Predictive", Status = "InProgress", CreatedAt = now.AddDays(-1), DueDate = now.AddDays(2) });
        await db.SaveChangesAsync();

        return (hallA.Id, hallB.Id, machineA.Id, machineB.Id, techA.Id);
    }

    [Fact]
    public async Task OverviewComputesSummaryOverdueWorkloadAndAttentionMachines()
    {
        await using var db = CreateDb();
        var (hallA, _, machineA, _, techA) = await SeedAsync(db);
        var controller = new MaintenanceController(db, new StubUserContext(UserRole.SuperAdmin, null));

        var res = Assert.IsType<OkObjectResult>((await controller.GetOverview(factoryHallId: hallA)).Result);
        var dto = Assert.IsType<MaintenanceOverviewDto>(res.Value);

        Assert.Equal(2, dto.Summary.Total);
        Assert.Equal(1, dto.Summary.Open);
        Assert.Equal(1, dto.Summary.Resolved);
        Assert.Equal(1, dto.Summary.Overdue);
        Assert.Equal(1, dto.Summary.CriticalOpen);
        Assert.Single(dto.Assignees);
        Assert.Equal(techA, dto.Assignees[0].UserId);
        Assert.Equal(1, dto.Assignees[0].ActiveWorkOrdersCount);
        Assert.Single(dto.AttentionMachines);
        Assert.Equal(machineA, dto.AttentionMachines[0].MachineId);

        // Overdue filter returns only the overdue unresolved work order
        var overdueRes = Assert.IsType<OkObjectResult>((await controller.GetOverview(factoryHallId: hallA, status: "Overdue")).Result);
        var overdueDto = Assert.IsType<MaintenanceOverviewDto>(overdueRes.Value);
        Assert.Single(overdueDto.Items.Data);
        Assert.True(overdueDto.Items.Data[0].IsOverdue);
    }

    [Fact]
    public async Task CreatePatchAndDeleteEnforceTenantScopeAndGenerateUniqueTickets()
    {
        await using var db = CreateDb();
        var (hallA, _, machineA, machineB, techA) = await SeedAsync(db);
        var hallAdmin = new MaintenanceController(db, new StubUserContext(UserRole.HallAdmin, hallA));

        // Cannot create work order for another hall's machine
        var crossHall = await hallAdmin.CreateWorkOrder(new CreateMaintenanceWorkOrderDto
        {
            MachineId = machineB,
            Title = "Unauthorized",
            Type = "Routine"
        });
        Assert.IsType<NotFoundObjectResult>(crossHall.Result);

        // Create valid work order on own hall
        var createdResult = Assert.IsType<CreatedAtActionResult>((await hallAdmin.CreateWorkOrder(new CreateMaintenanceWorkOrderDto
        {
            MachineId = machineA,
            Title = "Replace belt",
            Description = "Drive belt shows cracks",
            Type = "Predictive",
            AssignedUserId = techA
        })).Result);
        var created = Assert.IsType<MaintenanceWorkOrderDto>(createdResult.Value);
        Assert.StartsWith("WO-CNC01-", created.TicketNumber);
        Assert.Equal("Open", created.Status);

        // Patch status to Review, then Resolved sets ResolvedAt
        var reviewRes = await hallAdmin.PatchWorkOrder(created.Id, new PatchMaintenanceWorkOrderDto { Status = "Review" });
        Assert.IsType<NoContentResult>(reviewRes);
        Assert.Equal("Review", (await db.WorkOrders.FindAsync(created.Id))!.Status);

        var patchRes = await hallAdmin.PatchWorkOrder(created.Id, new PatchMaintenanceWorkOrderDto { Status = "Resolved" });
        Assert.IsType<NoContentResult>(patchRes);
        var updated = await db.WorkOrders.FindAsync(created.Id);
        Assert.Equal("Resolved", updated!.Status);
        Assert.NotNull(updated.ResolvedAt);

        // Delete removes work order
        var delRes = await hallAdmin.DeleteWorkOrder(created.Id);
        Assert.IsType<NoContentResult>(delRes);
        Assert.Null(await db.WorkOrders.FindAsync(created.Id));
    }
}
