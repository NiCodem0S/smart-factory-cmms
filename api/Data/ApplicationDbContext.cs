using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {

        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
{
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Machine>()
        .Property(m => m.Status)
        .HasConversion<string>(); // Saves "Running" instead of 0 in SQL Server

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
    }
}
