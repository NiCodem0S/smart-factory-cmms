using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Data
{
    public static class DatabaseSeeder
    {
        public static void Seed(ApplicationDbContext context)
        {
            if (context.Machines.Any())
            {
                return;
            }

            context.SystemSettings.Add(new SystemSettings
            {
                SiteName = "Warsaw Plant - Hall 3",
                Timezone = "Europe/Warsaw",
                Currency = "PLN",
                PeakPowerLimitMw = 1.0m,
                RawTelemetryRetentionDays = 30,
                EnableEmailAlerts = true
            });

            var shiftA = new WorkShift { Name = "Shift A (Morning)", StartTime = new TimeSpan(6, 0, 0), EndTime = new TimeSpan(14, 0, 0) };
            var shiftB = new WorkShift { Name = "Shift B (Afternoon)", StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(22, 0, 0) };
            var shiftC = new WorkShift { Name = "Shift C (Night)", StartTime = new TimeSpan(22, 0, 0), EndTime = new TimeSpan(6, 0, 0) };
            context.WorkShifts.AddRange(shiftA, shiftB, shiftC);

            var adminUser = new User
            {
                FullName = "John Doe",
                Email = "admin@smartfactory.com",
                PasswordHash = "TestPassword123!", //unhashed its just for testing
                Role = "Admin",
                IsActive = true
            };
            context.Users.Add(adminUser);

            var pressB2 = new Machine
            {
                Name = "Hydraulic Press B2",
                Category = "HeavyMachinery",
                SerialNumber = "4B1X-0092",
                Status = "Error",
                InstallationDate = DateTime.UtcNow.AddYears(-2),
                IsActive = true
            };

            var conveyorC1 = new Machine
            {
                Name = "Conveyor Belt C1",
                Category = "AssemblyNode",
                SerialNumber = "1A9F-220B",
                Status = "Maintenance",
                InstallationDate = DateTime.UtcNow.AddYears(-1),
                IsActive = true
            };

            var millingCNC = new Machine
            {
                Name = "Milling CNC 2",
                Category = "PrecisionMilling",
                SerialNumber = "9X2M-551Z",
                Status = "Running",
                InstallationDate = DateTime.UtcNow.AddMonths(-6),
                IsActive = true
            };

            context.Machines.AddRange(pressB2, conveyorC1, millingCNC);

            context.SaveChanges();
        }
    }
}
