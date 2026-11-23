using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Mappers;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories;
using SmartFactoryCMMS.Api.Services;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public sealed class ProductionLinesTests
{
    [Fact]
    public async Task GetProductionLinesReturnsOrderedActiveMachinesPerLineAndFiltersByHall()
    {
        using var db = Memory();
        var hallA = new FactoryHall { Name = "Hall A" };
        var hallB = new FactoryHall { Name = "Hall B" };
        var line1 = new ProductionLine { FactoryHall = hallA, Name = "Assembly 1", Status = "Running", OrderInHall = 1 };
        var line2 = new ProductionLine { FactoryHall = hallB, Name = "Welding 1", Status = "Halted", OrderInHall = 1 };

        var m2 = new Machine { Name = "Station 2", Category = "Robot", SerialNumber = "SN-2", FactoryHall = hallA, ProductionLine = line1, OrderInLine = 2, Status = MachineStatus.Running, TotalProduced = 42, CycleTimeSeconds = 4.5 };
        var m1 = new Machine { Name = "Station 1", Category = "Press", SerialNumber = "SN-1", FactoryHall = hallA, ProductionLine = line1, OrderInLine = 1, Status = MachineStatus.Warning, TotalProduced = 45, CycleTimeSeconds = 3.0 };
        var retired = new Machine { Name = "Retired", Category = "Press", SerialNumber = "SN-3", FactoryHall = hallA, ProductionLine = line1, OrderInLine = 3, IsActive = false };
        var otherMachine = new Machine { Name = "Welder", Category = "Welder", SerialNumber = "SN-4", FactoryHall = hallB, ProductionLine = line2, OrderInLine = 1, Status = MachineStatus.Offline };

        db.AddRange(hallA, hallB, line1, line2, m2, m1, retired, otherMachine);
        await db.SaveChangesAsync();

        var mapper = CreateMapper();
        var superAdmin = CreateUser("SuperAdmin", null);
        var hallRepo = new FactoryHallRepository(db, mapper, superAdmin);
        var linesRepo = new ProductionLinesRepository(db, mapper, hallRepo, superAdmin, null!);

        using var cts = new CancellationTokenSource();
        var scoped = await linesRepo.GetProductionLinesByHallsId(hallA.Id, cts.Token);

        Assert.NotNull(scoped);
        var line = Assert.Single(scoped);
        Assert.Equal(line1.Id, line.Id);
        Assert.Equal(new[] { m1.Id, m2.Id }, line.Machines.Select(m => m.Id).ToArray());
        Assert.DoesNotContain(line.Machines, m => m.Id == retired.Id);

        var hallDto = await hallRepo.GetFactoryHallByIdAsync(hallA.Id, cts.Token);
        Assert.NotNull(hallDto);
        Assert.Equal(hallA.Id, hallDto.Id);

        var missing = await linesRepo.GetProductionLinesByHallsId(Guid.NewGuid(), cts.Token);
        Assert.Null(missing);
    }

    private static ApplicationDbContext Memory() => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private static IMapper CreateMapper() => new Mapper(new MapperConfiguration(
        cfg => cfg.AddMaps(typeof(ProductionLinesMappingProfile).Assembly),
        NullLoggerFactory.Instance));

    private static UserContext CreateUser(string role, Guid? hallId)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        if (hallId.HasValue) claims.Add(new("FactoryHallId", hallId.Value.ToString()));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        return new UserContext(new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = principal } });
    }
}
