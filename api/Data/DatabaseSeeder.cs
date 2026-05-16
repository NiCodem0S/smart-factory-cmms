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
                PasswordHash = "TestPassword123!",
                Role = "Admin",
                IsActive = true
            };

            var technicianUser = new User
            {
                FullName = "Anna Smith",
                Email = "technician@smartfactory.com",
                PasswordHash = "TestPassword123!",
                Role = "Technician",
                IsActive = true
            };

            context.Users.AddRange(adminUser, technicianUser);

            // Create 35 machines with realistic data
            var machines = new List<Machine>
            {
                new Machine { Name = "Hydraulic Press B1", Category = "HeavyMachinery", SerialNumber = "HP001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddYears(-3), IsActive = true },
                new Machine { Name = "Hydraulic Press B2", Category = "HeavyMachinery", SerialNumber = "HP002-2023", Status = "Error", InstallationDate = DateTime.UtcNow.AddYears(-2), IsActive = true },
                new Machine { Name = "Hydraulic Press B3", Category = "HeavyMachinery", SerialNumber = "HP003-2023", Status = "Maintenance", InstallationDate = DateTime.UtcNow.AddYears(-2), IsActive = true },
                new Machine { Name = "Conveyor Belt C1", Category = "Conveyance", SerialNumber = "CB001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddYears(-1), IsActive = true },
                new Machine { Name = "Conveyor Belt C2", Category = "Conveyance", SerialNumber = "CB002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-8), IsActive = true },
                new Machine { Name = "Conveyor Belt C3", Category = "Conveyance", SerialNumber = "CB003-2023", Status = "Idle", InstallationDate = DateTime.UtcNow.AddMonths(-6), IsActive = true },
                new Machine { Name = "Milling CNC 1", Category = "Milling", SerialNumber = "MC001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-18), IsActive = true },
                new Machine { Name = "Milling CNC 2", Category = "Milling", SerialNumber = "MC002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-6), IsActive = true },
                new Machine { Name = "Milling CNC 3", Category = "Milling", SerialNumber = "MC003-2023", Status = "Maintenance", InstallationDate = DateTime.UtcNow.AddMonths(-12), IsActive = true },
                new Machine { Name = "Lathe Machine L1", Category = "Turning", SerialNumber = "LM001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddYears(-1), IsActive = true },
                new Machine { Name = "Lathe Machine L2", Category = "Turning", SerialNumber = "LM002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-10), IsActive = true },
                new Machine { Name = "Welding Robot W1", Category = "Welding", SerialNumber = "WR001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-24), IsActive = true },
                new Machine { Name = "Welding Robot W2", Category = "Welding", SerialNumber = "WR002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-18), IsActive = true },
                new Machine { Name = "Welding Robot W3", Category = "Welding", SerialNumber = "WR003-2023", Status = "Error", InstallationDate = DateTime.UtcNow.AddMonths(-12), IsActive = true },
                new Machine { Name = "Assembly Robot A1", Category = "Assembly", SerialNumber = "AR001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-14), IsActive = true },
                new Machine { Name = "Assembly Robot A2", Category = "Assembly", SerialNumber = "AR002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-10), IsActive = true },
                new Machine { Name = "Assembly Robot A3", Category = "Assembly", SerialNumber = "AR003-2023", Status = "Maintenance", InstallationDate = DateTime.UtcNow.AddMonths(-8), IsActive = true },
                new Machine { Name = "Injection Molder IM1", Category = "Molding", SerialNumber = "IM001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-20), IsActive = true },
                new Machine { Name = "Injection Molder IM2", Category = "Molding", SerialNumber = "IM002-2023", Status = "Idle", InstallationDate = DateTime.UtcNow.AddMonths(-16), IsActive = true },
                new Machine { Name = "Packaging Machine P1", Category = "Packaging", SerialNumber = "PM001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-9), IsActive = true },
                new Machine { Name = "Packaging Machine P2", Category = "Packaging", SerialNumber = "PM002-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-7), IsActive = true },
                new Machine { Name = "Quality Control Scanner Q1", Category = "Inspection", SerialNumber = "QC001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-11), IsActive = true },
                new Machine { Name = "Air Compressor AC1", Category = "Utility", SerialNumber = "AC001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddYears(-2), IsActive = true },
                new Machine { Name = "Air Compressor AC2", Category = "Utility", SerialNumber = "AC002-2023", Status = "Idle", InstallationDate = DateTime.UtcNow.AddYears(-1), IsActive = true },
                new Machine { Name = "Chiller System CH1", Category = "Utility", SerialNumber = "CS001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddYears(-3), IsActive = true },
                new Machine { Name = "Pump System PS1", Category = "Utility", SerialNumber = "PS001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-15), IsActive = true },
                new Machine { Name = "Pump System PS2", Category = "Utility", SerialNumber = "PS002-2023", Status = "Maintenance", InstallationDate = DateTime.UtcNow.AddMonths(-12), IsActive = true },
                new Machine { Name = "Drill Machine D1", Category = "Drilling", SerialNumber = "DR001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-13), IsActive = true },
                new Machine { Name = "Drill Machine D2", Category = "Drilling", SerialNumber = "DR002-2023", Status = "Error", InstallationDate = DateTime.UtcNow.AddMonths(-11), IsActive = true },
                new Machine { Name = "Saw Machine S1", Category = "Cutting", SerialNumber = "SAW001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-9), IsActive = true },
                new Machine { Name = "Saw Machine S2", Category = "Cutting", SerialNumber = "SAW002-2023", Status = "Idle", InstallationDate = DateTime.UtcNow.AddMonths(-8), IsActive = true },
                new Machine { Name = "CNC Router CR1", Category = "Cutting", SerialNumber = "CR001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-6), IsActive = true },
                new Machine { Name = "Press Machine PM1", Category = "Pressing", SerialNumber = "PMC001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-5), IsActive = true },
                new Machine { Name = "Heat Treatment HT1", Category = "Treatment", SerialNumber = "HT001-2023", Status = "Maintenance", InstallationDate = DateTime.UtcNow.AddMonths(-4), IsActive = true },
                new Machine { Name = "Grinding Machine GM1", Category = "Finishing", SerialNumber = "GM001-2023", Status = "Running", InstallationDate = DateTime.UtcNow.AddMonths(-3), IsActive = true },
                new Machine { Name = "Polishing Unit PU1", Category = "Finishing", SerialNumber = "PU001-2023", Status = "Idle", InstallationDate = DateTime.UtcNow.AddMonths(-2), IsActive = true },
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

            foreach (var machine in machines.Where(m => m.Status == "Error" || m.Status == "Maintenance").Take(10))
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
