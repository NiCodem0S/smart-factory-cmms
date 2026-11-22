using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data.Configurations;

public class SimulationCheckpointConfiguration : IEntityTypeConfiguration<SimulationCheckpoint>
{
    public void Configure(EntityTypeBuilder<SimulationCheckpoint> builder)
    {
        builder.HasKey(c => c.MachineId);
        builder.HasOne(c => c.Machine).WithOne(m => m.SimulationCheckpoint)
            .HasForeignKey<SimulationCheckpoint>(c => c.MachineId).OnDelete(DeleteBehavior.Cascade);
        builder.Property(c => c.FaultMode).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.MachineStatus).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.RowVersion).IsRowVersion();
        builder.ToTable("SimulationCheckpoints", table =>
        {
            table.HasCheckConstraint("CK_SimulationCheckpoints_Versions", "[SchemaVersion] >= 1 AND [ProfileVersion] >= 1 AND [TickNumber] >= 0");
            table.HasCheckConstraint("CK_SimulationCheckpoints_State", "[Temperature] BETWEEN -273.15 AND 1000000 AND [Vibration] >= 0 AND [PowerLoadKw] >= 0 AND [CycleProgressSeconds] >= 0 AND [Wear] BETWEEN 0 AND 1 AND [TotalProduced] >= 0");
            table.HasCheckConstraint("CK_SimulationCheckpoints_FaultMode", "[FaultMode] IN ('None', 'Overheating', 'ExcessVibration', 'Generic')");
            table.HasCheckConstraint("CK_SimulationCheckpoints_Status", "[MachineStatus] IN ('Running', 'Warning', 'Error', 'Maintenance', 'Offline')");
        });
    }
}
