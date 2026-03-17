using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using SmartFactoryCMMS.Models;

namespace SmartFactoryCMMS.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {

        }

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
    }
}
