using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data.Configurations;

public class SimulationProfileConfiguration : IEntityTypeConfiguration<SimulationProfile>
{
    public void Configure(EntityTypeBuilder<SimulationProfile> builder)
    {
        // Shared primary key enforces at most one profile for a machine.
        builder.HasKey(p => p.MachineId);
        builder.HasOne(p => p.Machine).WithOne(m => m.SimulationProfile)
            .HasForeignKey<SimulationProfile>(p => p.MachineId).OnDelete(DeleteBehavior.Cascade);
        builder.Property(p => p.Preset).HasConversion<string>().HasMaxLength(30);
        builder.Property(p => p.Version).IsConcurrencyToken();
        builder.ToTable("SimulationProfiles", table =>
        {
            table.HasCheckConstraint("CK_SimulationProfiles_Tick", "[TickIntervalMs] BETWEEN 100 AND 60000");
            table.HasCheckConstraint("CK_SimulationProfiles_Version", "[Version] >= 1");
            table.HasCheckConstraint("CK_SimulationProfiles_Preset", "[Preset] IN ('Stable', 'WearAndTear', 'Chaos', 'Custom')");
            table.HasCheckConstraint("CK_SimulationProfiles_Probabilities",
                "[OverheatingProbabilityPerHour] BETWEEN 0 AND 1 AND [ExcessVibrationProbabilityPerHour] BETWEEN 0 AND 1 AND [FailureProbabilityPerHour] BETWEEN 0 AND 1 AND [WearPerHour] BETWEEN 0 AND 1");
            table.HasCheckConstraint("CK_SimulationProfiles_Thermal",
                "[AmbientTemperature] BETWEEN -273.15 AND 2000 AND [NormalTemperature] BETWEEN -273.15 AND 2000 AND [TemperatureNoiseAmplitude] BETWEEN 0 AND 2000 AND [TemperatureResponsePerSecond] BETWEEN 0 AND 100 AND [OverheatingDegreesPerSecond] BETWEEN 0.001 AND 2000 AND [CoolingDegreesPerSecond] BETWEEN 0.001 AND 2000");
            table.HasCheckConstraint("CK_SimulationProfiles_VibrationAndPower",
                "[BaseVibration] BETWEEN 0 AND 1000000 AND [VibrationNoiseAmplitude] BETWEEN 0 AND 1000000 AND [ExcessVibrationAmplitude] BETWEEN 0 AND 1000000 AND [NormalPowerKw] BETWEEN 0 AND 1000000 AND [PowerNoiseAmplitudeKw] BETWEEN 0 AND 1000000 AND [IdlePowerKw] BETWEEN 0 AND [NormalPowerKw]");
        });
    }
}
