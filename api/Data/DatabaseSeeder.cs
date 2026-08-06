using Microsoft.AspNetCore.Identity;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Data
{
    public static class DatabaseSeeder
    {
        public static void Seed(ApplicationDbContext context)
        {
            var passwordHasher = new PasswordHasher<User>();
            const string seedPassword = "TestPassword123!";

            // Guard: if products exist, assume seeding is complete
            if (context.Products.Any())
            {
                return;
            }

            // Seed system settings (idempotent: check if any settings exist)
            if (!context.SystemSettings.Any())
            {
                context.SystemSettings.Add(new SystemSettings
                {
                    SiteName = "Warsaw Plant - Hall 3",
                    Timezone = "Europe/Warsaw",
                    Currency = "PLN",
                    PeakPowerLimitMw = 1.0m,
                    RawTelemetryRetentionDays = 30,
                    EnableEmailAlerts = true
                });
            }

            // Seed work shifts (idempotent: check if shifts exist)
            var shiftA = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift A (Morning)")
                ?? new WorkShift { Name = "Shift A (Morning)", StartTime = new TimeSpan(6, 0, 0), EndTime = new TimeSpan(14, 0, 0) };
            var shiftB = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift B (Afternoon)")
                ?? new WorkShift { Name = "Shift B (Afternoon)", StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(22, 0, 0) };
            var shiftC = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift C (Night)")
                ?? new WorkShift { Name = "Shift C (Night)", StartTime = new TimeSpan(22, 0, 0), EndTime = new TimeSpan(6, 0, 0) };

            if (!context.WorkShifts.Any(s => s.Name == "Shift A (Morning)"))
            {
                context.WorkShifts.Add(shiftA);
            }
            if (!context.WorkShifts.Any(s => s.Name == "Shift B (Afternoon)"))
            {
                context.WorkShifts.Add(shiftB);
            }
            if (!context.WorkShifts.Any(s => s.Name == "Shift C (Night)"))
            {
                context.WorkShifts.Add(shiftC);
            }

            // Seed users (idempotent: check by email)
            User? adminUser = context.Users.FirstOrDefault(u => u.Email == "admin@smartfactory.com");
            if (adminUser == null)
            {
                adminUser = new User
                {
                    FullName = "John Doe",
                    Email = "admin@smartfactory.com",
                    PasswordHash = passwordHasher.HashPassword(null!, seedPassword),
                    Role = "Admin",
                    IsActive = true
                };
                context.Users.Add(adminUser);
            }

            User? technicianUser = context.Users.FirstOrDefault(u => u.Email == "technician@smartfactory.com");
            if (technicianUser == null)
            {
                technicianUser = new User
                {
                    FullName = "Anna Smith",
                    Email = "technician@smartfactory.com",
                    PasswordHash = passwordHasher.HashPassword(null!, seedPassword),
                    Role = "Technician",
                    IsActive = true
                };
                context.Users.Add(technicianUser);
            }

            context.SaveChanges();

            // Refresh from DB in case they were just created
            adminUser = context.Users.First(u => u.Email == "admin@smartfactory.com");
            technicianUser = context.Users.First(u => u.Email == "technician@smartfactory.com");
            shiftA = context.WorkShifts.First(s => s.Name == "Shift A (Morning)");
            shiftB = context.WorkShifts.First(s => s.Name == "Shift B (Afternoon)");
            shiftC = context.WorkShifts.First(s => s.Name == "Shift C (Night)");

            var productA = new Product { Name = "Engine Block V8", SKUNumber = "PROD-V8-BLOCK", Description = "Heavy duty engine block" };
            var productB = new Product { Name = "Chassis Frame", SKUNumber = "PROD-CH-FR", Description = "Electric Vehicle Chassis Frame" };
            
            context.Products.AddRange(productA, productB);
            context.SaveChanges();

            var lineA = new ProductionLine { Name = "L1: Engine Block Assembly", Status = "Running", CurrentProductId = productA.Id };
            var lineB = new ProductionLine { Name = "L2: Chassis Welding", Status = "Halted", CurrentProductId = productB.Id };

            context.ProductionLines.AddRange(lineA, lineB);
            context.SaveChanges();

            var randomMachineGen = new Random(42);

            var machines = new List<Machine>
            {
                // Line A machines (Running)
                new Machine { Name = "Metal Feeder A1", Category = "HeavyMachinery", SerialNumber = "HP001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddYears(-3), IsActive = true, TotalOperatingHours = 3450.5, LastStatusChangedAt = DateTime.UtcNow.AddHours(-12), ProductionLineId = lineA.Id, Icon = "fa-pallet", OrderInLine = 1, StaticProperties = "{\"NormTemp\": 45.0, \"BaseVib\": 2.0}" },
                new Machine { Name = "CNC Milling C1", Category = "Milling", SerialNumber = "MC001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-18), IsActive = true, TotalOperatingHours = 2890.4, LastStatusChangedAt = DateTime.UtcNow.AddHours(-8), ProductionLineId = lineA.Id, Icon = "fa-cogs", OrderInLine = 2, StaticProperties = "{\"NormTemp\": 65.0, \"BaseVib\": 3.5}" },
                new Machine { Name = "Hydraulic Press P1", Category = "Pressing", SerialNumber = "PMC001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-5), IsActive = true, TotalOperatingHours = 540.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-17), ProductionLineId = lineA.Id, Icon = "fa-compress-alt", OrderInLine = 3, StaticProperties = "{\"NormTemp\": 55.0, \"BaseVib\": 5.0}" },
                new Machine { Name = "Robotic Drill D1", Category = "Drilling", SerialNumber = "DR001-2023", Status = MachineStatus.Maintenance, InstallationDate = DateTime.UtcNow.AddMonths(-13), IsActive = true, TotalOperatingHours = 1550.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-9), ProductionLineId = lineA.Id, Icon = "fa-robot", OrderInLine = 4, StaticProperties = "{\"NormTemp\": 70.0, \"BaseVib\": 4.0}" },
                new Machine { Name = "Welding Robot W1", Category = "Welding", SerialNumber = "WR001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-24), IsActive = true, TotalOperatingHours = 3100.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-16), ProductionLineId = lineA.Id, Icon = "fa-robot", OrderInLine = 5, StaticProperties = "{\"NormTemp\": 120.0, \"BaseVib\": 1.5}" },
                new Machine { Name = "Coating Station C1", Category = "Treatment", SerialNumber = "HT001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-4), IsActive = true, TotalOperatingHours = 410.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-6), ProductionLineId = lineA.Id, Icon = "fa-paint-roller", OrderInLine = 6, StaticProperties = "{\"NormTemp\": 85.0, \"BaseVib\": 1.0}" },
                new Machine { Name = "Optical QC Scanner Q1", Category = "Inspection", SerialNumber = "QC001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-11), IsActive = true, TotalOperatingHours = 1430.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-22), ProductionLineId = lineA.Id, Icon = "fa-microscope", OrderInLine = 7, StaticProperties = "{\"NormTemp\": 30.0, \"BaseVib\": 0.2}" },
                new Machine { Name = "Packager P1", Category = "Packaging", SerialNumber = "PM001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-9), IsActive = true, TotalOperatingHours = 1050.4, LastStatusChangedAt = DateTime.UtcNow.AddHours(-15), ProductionLineId = lineA.Id, Icon = "fa-box", OrderInLine = 8, StaticProperties = "{\"NormTemp\": 40.0, \"BaseVib\": 1.8}" },

                // Line B machines (Halted due to error)
                new Machine { Name = "Part Feeder B1", Category = "Conveyance", SerialNumber = "CB001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddYears(-1), IsActive = true, TotalOperatingHours = 1240.8, LastStatusChangedAt = DateTime.UtcNow.AddHours(-24), ProductionLineId = lineB.Id, Icon = "fa-box", OrderInLine = 1, StaticProperties = "{\"NormTemp\": 45.0, \"BaseVib\": 2.2}" },
                new Machine { Name = "CNC Milling C2", Category = "Milling", SerialNumber = "MC002-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-6), IsActive = true, TotalOperatingHours = 750.2, LastStatusChangedAt = DateTime.UtcNow.AddHours(-14), ProductionLineId = lineB.Id, Icon = "fa-cogs", OrderInLine = 2, StaticProperties = "{\"NormTemp\": 68.0, \"BaseVib\": 3.8}" },
                new Machine { Name = "Main Welding Robot W3", Category = "Welding", SerialNumber = "WR003-2023", Status = MachineStatus.Error, InstallationDate = DateTime.UtcNow.AddMonths(-12), IsActive = true, TotalOperatingHours = 1320.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-4), ProductionLineId = lineB.Id, Icon = "fa-fire", OrderInLine = 3, StaticProperties = "{\"NormTemp\": 130.0, \"BaseVib\": 2.0}" },
                new Machine { Name = "Coating Station C2", Category = "Treatment", SerialNumber = "HT002-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-4), IsActive = true, TotalOperatingHours = 410.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-6), ProductionLineId = lineB.Id, Icon = "fa-paint-roller", OrderInLine = 4, StaticProperties = "{\"NormTemp\": 85.0, \"BaseVib\": 1.0}" },
                new Machine { Name = "QC Scanner Q2", Category = "Inspection", SerialNumber = "QC002-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-11), IsActive = true, TotalOperatingHours = 1430.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-22), ProductionLineId = lineB.Id, Icon = "fa-search", OrderInLine = 5, StaticProperties = "{\"NormTemp\": 30.0, \"BaseVib\": 0.2}" },
                
                // Other unassigned machines
                new Machine { Name = "Air Compressor AC1", Category = "Utility", SerialNumber = "AC001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddYears(-2), IsActive = true, TotalOperatingHours = 5200.0, LastStatusChangedAt = DateTime.UtcNow.AddDays(-10), Icon = "fa-fan", StaticProperties = "{\"NormTemp\": 75.0, \"BaseVib\": 8.0}" },
                new Machine { Name = "Chiller System CH1", Category = "Utility", SerialNumber = "CS001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddYears(-3), IsActive = true, TotalOperatingHours = 6800.0, LastStatusChangedAt = DateTime.UtcNow.AddDays(-15), Icon = "fa-snowflake", StaticProperties = "{\"NormTemp\": 15.0, \"BaseVib\": 1.5}" },
                new Machine { Name = "Pump System PS1", Category = "Utility", SerialNumber = "PS001-2023", Status = MachineStatus.Running, InstallationDate = DateTime.UtcNow.AddMonths(-15), IsActive = true, TotalOperatingHours = 1890.0, LastStatusChangedAt = DateTime.UtcNow.AddHours(-11), Icon = "fa-water", StaticProperties = "{\"NormTemp\": 50.0, \"BaseVib\": 4.5}" }
            };

            context.Machines.AddRange(machines);
            context.SaveChanges();

            // Create work orders for machines
            var workOrders = new List<WorkOrder>();
            var random = new Random(42);

            foreach (var machine in machines.Take(20))
            {
                // 2-3 work orders per machine
                for (int i = 0; i < random.Next(1, 4); i++)
                {
                    var status = random.Next(0, 4) switch
                    {
                        0 => "Open",
                        1 => "InProgress",
                        2 => "Review",
                        _ => "Resolved"
                    };

                    var createdDate = DateTime.UtcNow.AddDays(-random.Next(1, 30));
                    var dueDate = createdDate.AddDays(random.Next(3, 14));
                    var resolvedDate = status == "Resolved" ? DateTime.UtcNow.AddDays(-random.Next(0, 15)) : (DateTime?)null;

                    workOrders.Add(new WorkOrder
                    {
                        TicketNumber = $"WO-{machine.SerialNumber}-{i + 1}",
                        MachineId = machine.Id,
                        Title = $"Maintenance for {machine.Name}",
                        Description = $"Scheduled maintenance and inspection for {machine.Name}",
                        Type = new[] { "Routine", "Predictive", "Critical" }[random.Next(3)],
                        Status = status,
                        CreatedAt = createdDate,
                        DueDate = dueDate,
                        ResolvedAt = resolvedDate,
                        AssignedUserId = i % 2 == 0 ? technicianUser.Id : adminUser.Id
                    });
                }
            }

            context.WorkOrders.AddRange(workOrders);
            context.SaveChanges();

            // Create telemetry readings for machines
            var telemetryReads = new List<TelemetryRead>();

            foreach (var machine in machines.Take(30))
            {
                // 5-10 telemetry readings per machine
                for (int i = 0; i < random.Next(5, 11); i++)
                {
                    telemetryReads.Add(new TelemetryRead
                    {
                        MachineId = machine.Id,
                        Temperature = random.Next(20, 85),
                        Vibration = random.Next(0, 50),
                        PowerLoadKw = random.Next(100, 800),
                        NetworkLatencyMs = random.Next(10, 100),
                        Timestamp = DateTime.UtcNow.AddMinutes(-random.Next(1, 1440))
                    });
                }
            }

            context.Set<TelemetryRead>().AddRange(telemetryReads);
            context.SaveChanges();

            // Create incidents for machines
            var incidents = new List<Incident>();

            foreach (var machine in machines.Where(m => m.Status == MachineStatus.Error || m.Status == MachineStatus.Maintenance).Take(10))
            {
                for (int i = 0; i < random.Next(1, 3); i++)
                {
                    incidents.Add(new Incident
                    {
                        MachineId = machine.Id,
                        TriggeredAt = DateTime.UtcNow.AddDays(-random.Next(1, 15)),
                        Message = $"Alert for {machine.Name}: High {new[] { "temperature", "vibration", "power consumption" }[random.Next(3)]}",
                        Severity = random.Next(0, 2) == 0 ? "Warning" : "Critical",
                        Status = random.Next(0, 2) == 0 ? "Active" : "Resolved"
                    });
                }
            }

            context.Set<Incident>().AddRange(incidents);
            context.SaveChanges();

            // Create production logs
            var productionLogs = new List<ProductionLog>();

            foreach (var machine in machines.Take(25))
            {
                for (int i = 0; i < random.Next(3, 8); i++)
                {
                    productionLogs.Add(new ProductionLog
                    {
                        MachineId = machine.Id,
                        ShiftId = new[] { shiftA.Id, shiftB.Id, shiftC.Id }[random.Next(3)],
                        Timestamp = DateTime.UtcNow.AddDays(-random.Next(0, 30)),
                        GoodParts = random.Next(100, 1500),
                        DefectiveParts = random.Next(0, 50),
                        AverageCycleTimeSeconds = random.Next(10, 120),
                        IdealCycleTimeSeconds = random.Next(5, 100),
                        ActiveOperatingSeconds = random.Next(1000, 28800)
                    });
                }
            }

            context.Set<ProductionLog>().AddRange(productionLogs);
            context.SaveChanges();

            // Create alert thresholds for high-value machines
            var alertThresholds = new List<AlertThreshold>();

            foreach (var machine in machines.Where(m => m.Category == "HeavyMachinery" || m.Category == "Welding").Take(5))
            {
                alertThresholds.Add(new AlertThreshold { MachineId = machine.Id, MetricType = "Temperature", WarningValue = 75, CriticalValue = 90 });
                alertThresholds.Add(new AlertThreshold { MachineId = machine.Id, MetricType = "Vibration", WarningValue = 40, CriticalValue = 60 });
                alertThresholds.Add(new AlertThreshold { MachineId = machine.Id, MetricType = "PowerLoadKw", WarningValue = 700, CriticalValue = 900 });
            }

            context.Set<AlertThreshold>().AddRange(alertThresholds);
            context.SaveChanges();
        }
    }
}
