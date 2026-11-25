using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using SmartFactoryCMMS.Api.Models;
using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        private readonly SimulationOptions _simulationOptions;

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, IOptions<SimulationOptions>? simulationOptions = null) : base(options)
        {
            _simulationOptions = simulationOptions?.Value ?? new SimulationOptions();
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
{
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        modelBuilder.Entity<Machine>().Property(m => m.SimulationEnabled).HasDefaultValue(false);
        modelBuilder.Entity<TelemetryRead>().HasIndex(t => new { t.MachineId, t.Timestamp });
        modelBuilder.Entity<TelemetryRead>().HasIndex(t => t.Timestamp);

        modelBuilder.Entity<Machine>()
        .Property(m => m.Status)
        .HasConversion<string>(); // Saves "Running" instead of 0 in SQL Server

        modelBuilder.Entity<Machine>()
            .Property(m => m.TelemetrySource)
            .HasConversion<string>()
            .HasMaxLength(32)
            .HasDefaultValue(Helpers.Enums.TelemetrySource.Simulated);

        modelBuilder.Entity<Machine>()
            .HasIndex(m => m.DeviceKeyHash)
            .IsUnique()
            .HasFilter("[DeviceKeyHash] IS NOT NULL");

        modelBuilder.Entity<ProductionLine>()
            .HasOne(pl => pl.CurrentProduct)
            .WithMany(p => p.ProductionLines)
            .HasForeignKey(pl => pl.CurrentProductId)
            .OnDelete(DeleteBehavior.SetNull);
            
        modelBuilder.Entity<ProductionLine>()
            .HasIndex(pl => pl.Name)
            .IsUnique();

        modelBuilder.Entity<ProductionLine>()
            .HasOne(pl => pl.FactoryHall)
            .WithMany(fh => fh.ProductionLines)
            .HasForeignKey(pl => pl.FactoryHallId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Machine>()
            .HasOne(m => m.FactoryHall)
            .WithMany(fh => fh.Machines)
            .HasForeignKey(m => m.FactoryHallId)
            .OnDelete(DeleteBehavior.Restrict); // Nie usuwaj maszyn jak usuniesz hale

        modelBuilder.Entity<User>()
            .Property(u => u.Role)
            .HasConversion<string>();

        modelBuilder.Entity<User>()
            .HasOne(u => u.FactoryHall)
            .WithMany(fh => fh.AssignedUsers)
            .HasForeignKey(u => u.FactoryHallId)
            .OnDelete(DeleteBehavior.SetNull); // Ustaw pole FactoryHallId uzytkownikow na Null

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.TokenHash);
        }

        public DbSet<FactoryHall> FactoryHalls { get; set; }
        public DbSet<Machine> Machines { get; set; }
        public DbSet<TelemetryRead> TelemetryRead { get; set; }
        public DbSet<Incident> Incidents { get; set; }
        public DbSet<WorkOrder> WorkOrders { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<SystemSettings> SystemSettings { get; set; }
        public DbSet<WorkShift> WorkShifts { get; set; }
        public DbSet<AlertThreshold> AlertThresholds { get; set; }
        public DbSet<ProductionLog> ProductionLogs { get; set; }
        public DbSet<MachinePrediction> MachinePredictions { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<ProductionLine> ProductionLines { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<SimulationProfile> SimulationProfiles { get; set; }
        public DbSet<SimulationCheckpoint> SimulationCheckpoints { get; set; }

        public SimulationProfile CreateDefaultSimulationProfile(Machine machine) =>
            SimulationProfileFactory.CreateStable(machine, _simulationOptions.DefaultTickIntervalMs);

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            PrepareSimulationEntities();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            PrepareSimulationEntities();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        private void PrepareSimulationEntities()
        {
            // Covers API creation and the legacy seeder in both sync and async saves.
            foreach (var entry in ChangeTracker.Entries<Machine>().Where(e => e.State == EntityState.Added).ToList())
            {
                entry.Entity.SimulationEnabled = false;
                if (entry.Entity.IsActive && entry.Entity.TelemetrySource == Helpers.Enums.TelemetrySource.Simulated && entry.Entity.SimulationProfile is null)
                {
                    entry.Entity.SimulationProfile = CreateDefaultSimulationProfile(entry.Entity);
                }
            }

            foreach (var entry in ChangeTracker.Entries<SimulationProfile>()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified).ToList())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.Version = 1;
                    entry.Entity.CreatedAtUtc = DateTimeOffset.UtcNow;
                }
                else
                {
                    entry.Entity.Version = checked(entry.Property(p => p.Version).OriginalValue + 1);
                    entry.Entity.CreatedAtUtc = entry.Property(p => p.CreatedAtUtc).OriginalValue;
                    entry.Property(p => p.CreatedAtUtc).IsModified = false;
                }

                entry.Entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
                Validator.ValidateObject(entry.Entity, new ValidationContext(entry.Entity), validateAllProperties: true);
            }

            foreach (var entry in ChangeTracker.Entries<SimulationCheckpoint>()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified))
            {
                Validator.ValidateObject(entry.Entity, new ValidationContext(entry.Entity), validateAllProperties: true);
            }
        }
    }
}
