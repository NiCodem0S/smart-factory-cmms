using System.Security.Claims;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Mappers;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Simulation;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;
public sealed class TelemetryHistoryTests
{
    private static MachineRepository Repository(ApplicationDbContext db, string role = "SuperAdmin", Guid? hall = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        if (hall.HasValue) claims.Add(new("hallId", hall.Value.ToString()));
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) };
        var user = new UserContext(new HttpContextAccessor { HttpContext = context });
        var mapper = new Mapper(new MapperConfiguration(c => c.AddProfile<MachineMappingProfile>(), NullLoggerFactory.Instance));
        return new(db, mapper, user, null!, Options.Create(new SimulationOptions()));
    }
    private static ApplicationDbContext Memory() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task LiveSelectsOnlyActualWindowAndDoesNotRequirePowerOrBothMetrics()
    {
        using var db = Memory();
        var machine = new Machine { Name = "Live chart" };
        db.Machines.Add(machine); await db.SaveChangesAsync();
        var now = DateTime.UtcNow;
        db.TelemetryRead.AddRange(
            new TelemetryRead { MachineId = machine.Id, Timestamp = now.AddDays(-2), Temperature = 60, Vibration = 1 },
            new TelemetryRead { MachineId = machine.Id, Timestamp = now.AddSeconds(-30), Temperature = 72 },
            new TelemetryRead { MachineId = machine.Id, Timestamp = now.AddSeconds(-20), Vibration = 2 },
            new TelemetryRead { MachineId = machine.Id, Timestamp = now.AddSeconds(-10), PowerLoadKw = 15 },
            new TelemetryRead { MachineId = machine.Id, Timestamp = now.AddMinutes(1), Temperature = 100 });
        await db.SaveChangesAsync();
        var series = await Repository(db).GetMachineTelemetrySeriesAsync(machine.Id, 1);
        Assert.Equal(2, series.Samples.Count);
        Assert.Equal(72, series.Samples[0].Temperature); Assert.Null(series.Samples[0].Vibration);
        Assert.Null(series.Samples[1].Temperature); Assert.Equal(2, series.Samples[1].Vibration);
        Assert.All(series.Samples, s => Assert.Equal(DateTimeKind.Utc, s.Timestamp.Kind));
        Assert.Equal(60, (series.ToUtc - series.FromUtc).TotalSeconds);
    }

    [Theory]
    [InlineData("Technician", true)]
    [InlineData("HallAdmin", true)]
    [InlineData("Technician", false)]
    public async Task HistoryWindowsCannotExposeAnotherHall(string role, bool assigned)
    {
        using var db = Memory();
        var machine = new Machine { Name = "Other hall", FactoryHallId = Guid.NewGuid() };
        db.Machines.Add(machine); await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<SimulationRequestException>(() => Repository(db, role, assigned ? Guid.NewGuid() : null).GetMachineTelemetrySeriesAsync(machine.Id, 1440));
        Assert.Equal(404, error.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(1441)]
    public async Task RejectsUnsupportedTimeWindow(int minutes)
    {
        using var db = Memory();
        var error = await Assert.ThrowsAsync<SimulationRequestException>(() => Repository(db).GetMachineTelemetrySeriesAsync(Guid.NewGuid(), minutes));
        Assert.Equal(400, error.StatusCode);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(120)]
    public void LongWindowsAreBucketedInsideSqlRatherThanLimitedToLastRows(int seconds)
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=localhost;Database=QueryTranslationOnly;Integrated Security=True;TrustServerCertificate=True").Options);
        var end = DateTime.UtcNow;
        var sql = TelemetryHistoryQuery.Build(db, Guid.NewGuid(), end.AddHours(-24), end, seconds).ToQueryString();
        Assert.Contains("GROUP BY", sql); Assert.Contains("DATEDIFF(second", sql); Assert.Contains("MAX(", sql);
        Assert.DoesNotContain("TOP(", sql);
    }
}
