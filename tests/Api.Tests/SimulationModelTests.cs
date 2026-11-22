using System.ComponentModel.DataAnnotations;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Mappers;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Simulation;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;

public class SimulationModelTests
{
    private static DbContextOptions<ApplicationDbContext> MemoryOptions() =>
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

    private static bool IsValid(object value) => Validator.TryValidateObject(
        value, new ValidationContext(value), new List<ValidationResult>(), validateAllProperties: true);

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CreatingMachineAddsOneStableProfileAndDisablesSimulation(bool asyncSave)
    {
        using var context = new ApplicationDbContext(MemoryOptions(),
            Options.Create(new SimulationOptions { DefaultTickIntervalMs = 2000 }));
        var machine = new Machine
        {
            Name = "Machine", SimulationEnabled = true,
            StaticProperties = "{\"NormTemp\":85,\"BaseVib\":2.1,\"NormPower\":42}"
        };
        context.Machines.Add(machine);
        if (asyncSave) await context.SaveChangesAsync();
        else context.SaveChanges();

        var profile = Assert.Single(context.SimulationProfiles);
        Assert.Equal(machine.Id, profile.MachineId);
        Assert.Equal(SimulationPreset.Stable, profile.Preset);
        Assert.Equal(2000, profile.TickIntervalMs);
        Assert.Equal(85, profile.NormalTemperature);
        Assert.Equal(2.1, profile.BaseVibration);
        Assert.Equal(42, profile.NormalPowerKw);
        Assert.False(machine.SimulationEnabled);
        Assert.Empty(context.SimulationCheckpoints);

        // An unrelated save must not duplicate or reset the profile.
        machine.Name = "Renamed";
        await context.SaveChangesAsync();
        Assert.Single(context.SimulationProfiles);
        Assert.Equal(1, profile.Version);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("broken JSON")]
    [InlineData("[]")]
    [InlineData("{\"NormTemp\":\"85\",\"BaseVib\":-1,\"NormPower\":null}")]
    [InlineData("{\"NormTemp\":1e999,\"BaseVib\":1e999,\"NormPower\":1e999}")]
    public void LegacyInvalidBaselinesUseValidDefaultsWithoutChangingSource(string? legacy)
    {
        var machine = new Machine { StaticProperties = legacy };
        var profile = SimulationProfileFactory.CreateStable(machine, 1000);
        Assert.Equal(60, profile.NormalTemperature);
        Assert.Equal(1, profile.BaseVibration);
        Assert.Equal(15, profile.NormalPowerKw);
        Assert.Equal(legacy, machine.StaticProperties);
        Assert.True(IsValid(profile));
    }

    [Fact]
    public void ZeroPowerLegacyBaselineProducesValidIdlePower()
    {
        var profile = SimulationProfileFactory.CreateStable(new Machine { StaticProperties = "{\"NormPower\":0}" }, 1000);
        Assert.Equal(0, profile.NormalPowerKw);
        Assert.Equal(0, profile.IdlePowerKw);
        Assert.True(IsValid(profile));
    }

    [Fact]
    public void SeederOnlyBackfillsMissingProfilesAndPreservesEditedProfiles()
    {
        using var context = new ApplicationDbContext(MemoryOptions());
        var legacy = new Machine { IsActive = false };
        var edited = new Machine();
        context.AddRange(legacy, edited);
        context.SaveChanges();
        edited.SimulationProfile!.Preset = SimulationPreset.Custom;
        edited.SimulationProfile.TickIntervalMs = 2500;
        edited.SimulationProfile.NormalTemperature = 99;
        legacy.IsActive = true;
        legacy.SimulationEnabled = true;
        context.SaveChanges();
        var version = edited.SimulationProfile.Version;

        Assert.Equal(1, SimulationProfileSeeder.Seed(context));
        Assert.Equal(0, SimulationProfileSeeder.Seed(context));
        Assert.Equal(2, context.SimulationProfiles.Count());
        Assert.Equal(SimulationPreset.Custom, edited.SimulationProfile.Preset);
        Assert.Equal(2500, edited.SimulationProfile.TickIntervalMs);
        Assert.Equal(99, edited.SimulationProfile.NormalTemperature);
        Assert.Equal(version, edited.SimulationProfile.Version);
        Assert.True(legacy.SimulationEnabled);
    }

    [Fact]
    public async Task ProfileVersionRejectsConcurrentStaleWrite()
    {
        var options = MemoryOptions();
        using (var setup = new ApplicationDbContext(options))
        {
            setup.Add(new Machine());
            setup.SaveChanges();
        }

        using var first = new ApplicationDbContext(options);
        using var stale = new ApplicationDbContext(options);
        var profile = first.SimulationProfiles.Single();
        var staleProfile = stale.SimulationProfiles.Single();
        var created = profile.CreatedAtUtc;
        profile.CreatedAtUtc = created.AddDays(1);
        profile.NormalTemperature = 70;
        profile.Preset = SimulationPreset.Custom;
        await first.SaveChangesAsync();
        Assert.Equal(2, profile.Version);
        Assert.Equal(created, profile.CreatedAtUtc);
        staleProfile.NormalTemperature = 80;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => stale.SaveChangesAsync());
    }

    [Fact]
    public void InvalidProfileCannotBePersisted()
    {
        using var context = new ApplicationDbContext(MemoryOptions());
        var machine = new Machine();
        context.Add(machine);
        context.SaveChanges();
        machine.SimulationProfile!.FailureProbabilityPerHour = double.NaN;
        Assert.Throws<ValidationException>(() => context.SaveChanges());
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void ProfileDtoRejectsInvalidProbability(double probability) =>
        Assert.False(IsValid(new UpdateSimulationProfileDto { Version = 1, FailureProbabilityPerHour = probability }));

    [Fact]
    public void ProfileDtoRejectsInvalidTickRatesAndPhysicalValues()
    {
        Assert.True(IsValid(new UpdateSimulationProfileDto { Version = 1 }));
        Assert.False(IsValid(new UpdateSimulationProfileDto { Version = 1, TickIntervalMs = 0 }));
        Assert.False(IsValid(new UpdateSimulationProfileDto { Version = 1, NormalTemperature = double.NaN }));
        Assert.False(IsValid(new UpdateSimulationProfileDto { Version = 1, WearPerHour = 2 }));
        Assert.False(IsValid(new UpdateSimulationProfileDto { Version = 1, NormalPowerKw = 1, IdlePowerKw = 2 }));
        Assert.False(IsValid(new ApplySimulationPresetDto { Version = 1, Preset = SimulationPreset.Custom }));
        Assert.False(IsValid(new ApplySimulationPresetDto { Version = 1 }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void MachineDtosRejectInvalidCycleTime(double seconds)
    {
        Assert.False(IsValid(new CreateMachineDto { Name = "Machine", Category = "CNC", CycleTimeSeconds = seconds }));
        Assert.False(IsValid(new UpdateMachineDto { Name = "Machine", Category = "CNC", CycleTimeSeconds = seconds }));
    }

    [Fact]
    public void ThresholdDtoRequiresWarningBeforeCritical()
    {
        Assert.True(IsValid(new CreateAlertThresholdDto { MetricType = "Temperature", WarningValue = 80, CriticalValue = 100 }));
        Assert.False(IsValid(new CreateAlertThresholdDto { MetricType = "Temperature", WarningValue = 100, CriticalValue = 80 }));
        Assert.False(IsValid(new CreateAlertThresholdDto { MetricType = "Temperature", WarningValue = 80, CriticalValue = 80 }));
    }

    [Fact]
    public void GlobalIntervalsMustBePositiveAndDefaultTickMustBeSupported()
    {
        Assert.True(IsValid(new SimulationOptions()));
        Assert.False(IsValid(new SimulationOptions { DefaultTickIntervalMs = 0 }));
        Assert.False(IsValid(new SimulationOptions { CheckpointIntervalSeconds = 0 }));
        Assert.False(IsValid(new SimulationOptions { HistorySampleIntervalSeconds = -1 }));
        Assert.False(IsValid(new SimulationOptions { TelemetryCleanupBatchSize = 0 }));
    }

    [Fact]
    public void CheckpointRequiresFiniteStateAndConsistentTimestamps()
    {
        var checkpoint = new SimulationCheckpoint { Temperature = 25 };
        Assert.False(IsValid(checkpoint));
        checkpoint.LastTickAtUtc = DateTimeOffset.UtcNow;
        checkpoint.SavedAtUtc = checkpoint.LastTickAtUtc;
        Assert.True(IsValid(checkpoint));
        checkpoint.Temperature = double.NaN;
        Assert.False(IsValid(checkpoint));
    }

    [Fact]
    public void SqlServerModelUsesSharedKeysAndTranslatesMachineProfileProjection()
    {
        using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=ModelOnly;Integrated Security=true").Options);
        Assert.Null(context.Model.FindEntityType(typeof(SimulationParameters)));
        foreach (var type in new[] { typeof(SimulationProfile), typeof(SimulationCheckpoint) })
        {
            var entity = context.Model.FindEntityType(type)!;
            Assert.Equal("MachineId", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
            Assert.True(Assert.Single(entity.GetForeignKeys()).IsUnique);
        }
        Assert.True(context.Model.FindEntityType(typeof(SimulationProfile))!.FindProperty("Version")!.IsConcurrencyToken);
        Assert.True(context.Model.FindEntityType(typeof(SimulationCheckpoint))!.FindProperty("RowVersion")!.IsConcurrencyToken);

        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MachineMappingProfile>(), NullLoggerFactory.Instance);
        var sql = context.Machines.ProjectTo<MachineDetailDto>(mapper).ToQueryString();
        Assert.Contains("SimulationProfiles", sql);
        Assert.Contains("SimulationEnabled", sql);
    }
}
