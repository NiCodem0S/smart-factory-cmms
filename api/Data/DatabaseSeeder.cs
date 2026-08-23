using Microsoft.AspNetCore.Identity;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Helpers.Enums;
using Microsoft.EntityFrameworkCore;

namespace SmartFactoryCMMS.Api.Data
{
    public static class DatabaseSeeder
    {
        public static void Seed(ApplicationDbContext context)
        {
            var passwordHasher = new PasswordHasher<User>();
            const string seedPassword = "TestPassword123!";

            // 1. Seed system settings
            if (!context.SystemSettings.Any())
            {
                context.SystemSettings.Add(new SystemSettings
                {
                    SiteName = "Smart Factory Warsaw - Plant 1",
                    Timezone = "Europe/Warsaw",
                    Currency = "PLN",
                    PeakPowerLimitMw = 2.5m,
                    RawTelemetryRetentionDays = 30,
                    EnableEmailAlerts = true
                });
            }

            // 2. Seed work shifts
            var shiftA = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift A (Morning)")
                ?? new WorkShift { Name = "Shift A (Morning)", StartTime = new TimeSpan(6, 0, 0), EndTime = new TimeSpan(14, 0, 0) };
            var shiftB = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift B (Afternoon)")
                ?? new WorkShift { Name = "Shift B (Afternoon)", StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(22, 0, 0) };
            var shiftC = context.WorkShifts.FirstOrDefault(s => s.Name == "Shift C (Night)")
                ?? new WorkShift { Name = "Shift C (Night)", StartTime = new TimeSpan(22, 0, 0), EndTime = new TimeSpan(6, 0, 0) };

            if (!context.WorkShifts.Any(s => s.Name == "Shift A (Morning)")) context.WorkShifts.Add(shiftA);
            if (!context.WorkShifts.Any(s => s.Name == "Shift B (Afternoon)")) context.WorkShifts.Add(shiftB);
            if (!context.WorkShifts.Any(s => s.Name == "Shift C (Night)")) context.WorkShifts.Add(shiftC);

            // 3. Seed users
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

            // Refresh references
            adminUser = context.Users.First(u => u.Email == "admin@smartfactory.com");
            technicianUser = context.Users.First(u => u.Email == "technician@smartfactory.com");
            shiftA = context.WorkShifts.First(s => s.Name == "Shift A (Morning)");
            shiftB = context.WorkShifts.First(s => s.Name == "Shift B (Afternoon)");
            shiftC = context.WorkShifts.First(s => s.Name == "Shift C (Night)");

            // 4. Seed factory infrastructure if not already seeded
            if (!context.FactoryHalls.Any())
            {
            var productBattery = new Product
            {
                Name = "EV Battery Module 75kWh",
                SKUNumber = "PROD-EV-BAT75",
                Description = "High-density modular lithium-ion battery pack with integrated BMS"
            };

            var productEngine = new Product
            {
                Name = "Aluminum Engine Block V6",
                SKUNumber = "PROD-ENG-V6ALU",
                Description = "Precision machined lightweight aluminum automotive engine block"
            };

            var productChassis = new Product
            {
                Name = "Heavy Duty Chassis Frame",
                SKUNumber = "PROD-CHS-FR400",
                Description = "High-tensile robotic welded and e-coated commercial vehicle chassis"
            };

            context.Products.AddRange(productBattery, productEngine, productChassis);
            context.SaveChanges();

            // 6. Factory Halls
            var hall1 = new FactoryHall { Name = "Hala Główna A (Automotive & Battery Assembly)" };
            var hall2 = new FactoryHall { Name = "Hala B (Obróbka Skrawaniem & Spawalnia)" };
            context.FactoryHalls.AddRange(hall1, hall2);
            context.SaveChanges();

            // 7. Production Lines
            var line1 = new ProductionLine
            {
                Name = "EV Battery Pack Assembly",
                OrderInHall = 1,
                Status = "Running",
                CurrentProductId = productBattery.Id,
                FactoryHallId = hall1.Id,
                LastStatusChangedAt = DateTime.UtcNow.AddDays(-4).AddHours(-12)
            };

            var line2 = new ProductionLine
            {
                Name = "Engine Block CNC Machining",
                OrderInHall = 2,
                Status = "Warning",
                CurrentProductId = productEngine.Id,
                FactoryHallId = hall2.Id,
                LastStatusChangedAt = DateTime.UtcNow.AddHours(-18).AddMinutes(-30)
            };

            var line3 = new ProductionLine
            {
                Name = "Chassis Frame Welding & Coating",
                OrderInHall = 3,
                Status = "Halted",
                CurrentProductId = productChassis.Id,
                FactoryHallId = hall2.Id,
                LastStatusChangedAt = DateTime.UtcNow.AddHours(-2).AddMinutes(-15)
            };

            context.ProductionLines.AddRange(line1, line2, line3);
            context.SaveChanges();

            // 8. Machines Setup
            var machines = new List<Machine>
            {
                // ==================== LINE 1: EV Battery Pack Assembly (Running) ====================
                new Machine
                {
                    Name = "Cell Infeed Feeder CF-01",
                    Category = "Conveyance",
                    SerialNumber = "CF01-2024",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-18),
                    IsActive = true,
                    TotalOperatingHours = 2480.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-12),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "Unarchive",
                    OrderInLine = 1,
                    CycleTimeSeconds = 4.0,
                    TotalProduced = 3420,
                    StaticProperties = "{\"NormTemp\": 35.0, \"BaseVib\": 1.2, \"NormPower\": 8.5}"
                },
                new Machine
                {
                    Name = "Laser Cell Welder LW-02",
                    Category = "Welding",
                    SerialNumber = "LW02-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-24),
                    IsActive = true,
                    TotalOperatingHours = 3850.5,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-10),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "Fireplace",
                    OrderInLine = 2,
                    CycleTimeSeconds = 6.0,
                    TotalProduced = 3415,
                    StaticProperties = "{\"NormTemp\": 85.0, \"BaseVib\": 2.1, \"NormPower\": 42.0}"
                },
                new Machine
                {
                    Name = "BMS Wire Bonder WB-03",
                    Category = "Electronics",
                    SerialNumber = "WB03-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-14),
                    IsActive = true,
                    TotalOperatingHours = 1920.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-14),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "Cable",
                    OrderInLine = 3,
                    CycleTimeSeconds = 5.0,
                    TotalProduced = 3412,
                    StaticProperties = "{\"NormTemp\": 48.0, \"BaseVib\": 1.0, \"NormPower\": 14.0}"
                },
                new Machine
                {
                    Name = "Thermal Dispenser TD-04",
                    Category = "Treatment",
                    SerialNumber = "TD04-2024",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-8),
                    IsActive = true,
                    TotalOperatingHours = 890.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-7),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "Shower",
                    OrderInLine = 4,
                    CycleTimeSeconds = 5.5,
                    TotalProduced = 3410,
                    StaticProperties = "{\"NormTemp\": 38.0, \"BaseVib\": 1.6, \"NormPower\": 12.0}"
                },
                new Machine
                {
                    Name = "Optical & Voltage Scanner QC-05",
                    Category = "Inspection",
                    SerialNumber = "QC05-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-11),
                    IsActive = true,
                    TotalOperatingHours = 1430.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-22),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "BarcodeReader",
                    OrderInLine = 5,
                    CycleTimeSeconds = 4.5,
                    TotalProduced = 3408,
                    StaticProperties = "{\"NormTemp\": 28.0, \"BaseVib\": 0.3, \"NormPower\": 3.0}"
                },
                new Machine
                {
                    Name = "Tightening Robot TR-06",
                    Category = "Robotics",
                    SerialNumber = "TR06-2024",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-6),
                    IsActive = true,
                    TotalOperatingHours = 720.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-15),
                    ProductionLineId = line1.Id,
                    FactoryHallId = hall1.Id,
                    Icon = "PrecisionManufacturing",
                    OrderInLine = 6,
                    CycleTimeSeconds = 6.0,
                    TotalProduced = 3405,
                    StaticProperties = "{\"NormTemp\": 52.0, \"BaseVib\": 2.4, \"NormPower\": 24.0}"
                },

                // ==================== LINE 2: Engine Block CNC Machining (Warning) ====================
                new Machine
                {
                    Name = "Raw Casting Loader RL-11",
                    Category = "Conveyance",
                    SerialNumber = "RL11-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddYears(-2),
                    IsActive = true,
                    TotalOperatingHours = 3200.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-20),
                    ProductionLineId = line2.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "Repartition",
                    OrderInLine = 1,
                    CycleTimeSeconds = 5.0,
                    TotalProduced = 1860,
                    StaticProperties = "{\"NormTemp\": 40.0, \"BaseVib\": 1.8, \"NormPower\": 9.5}"
                },
                new Machine
                {
                    Name = "5-Axis CNC Milling Center MC-12",
                    Category = "Milling",
                    SerialNumber = "MC12-2022",
                    Status = MachineStatus.Warning,
                    InstallationDate = DateTime.UtcNow.AddYears(-3),
                    IsActive = true,
                    TotalOperatingHours = 5120.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-2),
                    ProductionLineId = line2.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "fa-cogs",
                    OrderInLine = 2,
                    CycleTimeSeconds = 8.0,
                    TotalProduced = 1852,
                    StaticProperties = "{\"NormTemp\": 74.0, \"BaseVib\": 4.5, \"NormPower\": 40.0}"
                },
                new Machine
                {
                    Name = "Robotic Drilling Unit RD-13",
                    Category = "Drilling",
                    SerialNumber = "RD13-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-16),
                    IsActive = true,
                    TotalOperatingHours = 2100.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-8),
                    ProductionLineId = line2.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "Tune",
                    OrderInLine = 3,
                    CycleTimeSeconds = 6.5,
                    TotalProduced = 1845,
                    StaticProperties = "{\"NormTemp\": 62.0, \"BaseVib\": 2.8, \"NormPower\": 26.0}"
                },
                new Machine
                {
                    Name = "Hydraulic Core Press HP-14",
                    Category = "Pressing",
                    SerialNumber = "HP14-2024",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-5),
                    IsActive = true,
                    TotalOperatingHours = 640.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-16),
                    ProductionLineId = line2.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "Compress",
                    OrderInLine = 4,
                    CycleTimeSeconds = 7.0,
                    TotalProduced = 1840,
                    StaticProperties = "{\"NormTemp\": 56.0, \"BaseVib\": 4.2, \"NormPower\": 48.0}"
                },
                new Machine
                {
                    Name = "CMM Inspection Scanner CMM-15",
                    Category = "Inspection",
                    SerialNumber = "CMM15-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-12),
                    IsActive = true,
                    TotalOperatingHours = 1680.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-18),
                    ProductionLineId = line2.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "SmartScreen",
                    OrderInLine = 5,
                    CycleTimeSeconds = 5.0,
                    TotalProduced = 1834,
                    StaticProperties = "{\"NormTemp\": 25.0, \"BaseVib\": 0.2, \"NormPower\": 2.5}"
                },

                // ==================== LINE 3: Chassis Frame Welding & Coating (Halted) ====================
                new Machine
                {
                    Name = "Frame Staging Carrier SC-21",
                    Category = "Conveyance",
                    SerialNumber = "SC21-2023",
                    Status = MachineStatus.Offline,
                    InstallationDate = DateTime.UtcNow.AddYears(-1),
                    IsActive = true,
                    TotalOperatingHours = 1240.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-4),
                    ProductionLineId = line3.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "RvHookup",
                    OrderInLine = 1,
                    CycleTimeSeconds = 5.0,
                    TotalProduced = 960,
                    StaticProperties = "{\"NormTemp\": 36.0, \"BaseVib\": 1.5, \"NormPower\": 8.0}"
                },
                new Machine
                {
                    Name = "Robotic Spot Welder SW-22",
                    Category = "Welding",
                    SerialNumber = "SW22-2022",
                    Status = MachineStatus.Error,
                    InstallationDate = DateTime.UtcNow.AddYears(-2),
                    IsActive = true,
                    TotalOperatingHours = 3450.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-4),
                    ProductionLineId = line3.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "ElectricCar",
                    OrderInLine = 2,
                    CycleTimeSeconds = 7.5,
                    TotalProduced = 955,
                    StaticProperties = "{\"NormTemp\": 138.0, \"BaseVib\": 3.0, \"NormPower\": 58.0}"
                },
                new Machine
                {
                    Name = "Dip Coating Station DC-23",
                    Category = "Treatment",
                    SerialNumber = "DC23-2023",
                    Status = MachineStatus.Offline,
                    InstallationDate = DateTime.UtcNow.AddMonths(-10),
                    IsActive = true,
                    TotalOperatingHours = 1100.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-4),
                    ProductionLineId = line3.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "ViewQuilt",
                    OrderInLine = 3,
                    CycleTimeSeconds = 9.0,
                    TotalProduced = 950,
                    StaticProperties = "{\"NormTemp\": 62.0, \"BaseVib\": 0.9, \"NormPower\": 19.0}"
                },
                new Machine
                {
                    Name = "Thermal Curing Oven TO-24",
                    Category = "Thermal",
                    SerialNumber = "TO24-2021",
                    Status = MachineStatus.Offline,
                    InstallationDate = DateTime.UtcNow.AddYears(-3),
                    IsActive = true,
                    TotalOperatingHours = 4900.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-4),
                    ProductionLineId = line3.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "Microwave",
                    OrderInLine = 4,
                    CycleTimeSeconds = 10.0,
                    TotalProduced = 948,
                    StaticProperties = "{\"NormTemp\": 175.0, \"BaseVib\": 1.1, \"NormPower\": 72.0}"
                },
                new Machine
                {
                    Name = "Ultrasonic Weld Scanner US-25",
                    Category = "Inspection",
                    SerialNumber = "US25-2023",
                    Status = MachineStatus.Offline,
                    InstallationDate = DateTime.UtcNow.AddMonths(-14),
                    IsActive = true,
                    TotalOperatingHours = 1890.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-4),
                    ProductionLineId = line3.Id,
                    FactoryHallId = hall2.Id,
                    Icon = "Scale",
                    OrderInLine = 5,
                    CycleTimeSeconds = 6.0,
                    TotalProduced = 942,
                    StaticProperties = "{\"NormTemp\": 30.0, \"BaseVib\": 0.4, \"NormPower\": 3.8}"
                },

                // ==================== Standalone Utility Machines ====================
                new Machine
                {
                    Name = "Central Screw Compressor AC-01",
                    Category = "Utility",
                    SerialNumber = "AC01-2022",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddYears(-2),
                    IsActive = true,
                    TotalOperatingHours = 6200.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddDays(-10),
                    FactoryHallId = hall1.Id,
                    Icon = "Air",
                    TotalProduced = 0,
                    StaticProperties = "{\"NormTemp\": 76.0, \"BaseVib\": 6.8, \"NormPower\": 75.0}"
                },
                new Machine
                {
                    Name = "Process Chiller System CH-01",
                    Category = "Utility",
                    SerialNumber = "CH01-2022",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddYears(-3),
                    IsActive = true,
                    TotalOperatingHours = 7400.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddDays(-15),
                    FactoryHallId = hall1.Id,
                    Icon = "WindPower",
                    TotalProduced = 0,
                    StaticProperties = "{\"NormTemp\": 14.0, \"BaseVib\": 1.6, \"NormPower\": 90.0}"
                },
                new Machine
                {
                    Name = "Dust Extraction Unit DE-02",
                    Category = "Utility",
                    SerialNumber = "DE02-2023",
                    Status = MachineStatus.Maintenance,
                    InstallationDate = DateTime.UtcNow.AddMonths(-15),
                    IsActive = true,
                    TotalOperatingHours = 2300.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-11),
                    FactoryHallId = hall2.Id,
                    Icon = "FilterAlt",
                    TotalProduced = 0,
                    StaticProperties = "{\"NormTemp\": 44.0, \"BaseVib\": 3.2, \"NormPower\": 28.0}"
                },
                new Machine
                {
                    Name = "Central Hydraulic Power Unit HPU-02",
                    Category = "Utility",
                    SerialNumber = "HPU02-2023",
                    Status = MachineStatus.Running,
                    InstallationDate = DateTime.UtcNow.AddMonths(-18),
                    IsActive = true,
                    TotalOperatingHours = 2800.0,
                    LastStatusChangedAt = DateTime.UtcNow.AddHours(-8),
                    FactoryHallId = hall2.Id,
                    Icon = "PowerInput",
                    TotalProduced = 0,
                    StaticProperties = "{\"NormTemp\": 50.0, \"BaseVib\": 3.8, \"NormPower\": 38.0}"
                }
            };

            context.Machines.AddRange(machines);
            context.SaveChanges();

            // 9. Alert Thresholds
            var alertThresholds = new List<AlertThreshold>();
            foreach (var m in machines)
            {
                double bTemp = 50.0;
                double bVib = 2.0;
                double bPower = 20.0;

                if (!string.IsNullOrEmpty(m.StaticProperties))
                {
                    try
                    {
                        using var jsonDoc = System.Text.Json.JsonDocument.Parse(m.StaticProperties);
                        if (jsonDoc.RootElement.TryGetProperty("NormTemp", out var tProp)) bTemp = tProp.GetDouble();
                        if (jsonDoc.RootElement.TryGetProperty("BaseVib", out var vProp)) bVib = vProp.GetDouble();
                        if (jsonDoc.RootElement.TryGetProperty("NormPower", out var pProp)) bPower = pProp.GetDouble();
                    }
                    catch { }
                }

                alertThresholds.Add(new AlertThreshold
                {
                    MachineId = m.Id,
                    MetricType = "Temperature",
                    WarningValue = (decimal)Math.Round(bTemp + 15.0, 1),
                    CriticalValue = (decimal)Math.Round(bTemp + 30.0, 1)
                });

                alertThresholds.Add(new AlertThreshold
                {
                    MachineId = m.Id,
                    MetricType = "Vibration",
                    WarningValue = (decimal)Math.Round(bVib + 2.0, 1),
                    CriticalValue = (decimal)Math.Round(bVib + 4.0, 1)
                });

                alertThresholds.Add(new AlertThreshold
                {
                    MachineId = m.Id,
                    MetricType = "PowerLoadKw",
                    WarningValue = (decimal)Math.Round(bPower * 1.35, 1),
                    CriticalValue = (decimal)Math.Round(bPower * 1.7, 1)
                });
            }

            context.AlertThresholds.AddRange(alertThresholds);
            context.SaveChanges();

            // 10. Work Orders
            var workOrders = new List<WorkOrder>();
            var random = new Random(42);

            foreach (var machine in machines)
            {
                int woCount = machine.Status == MachineStatus.Error ? 3 : (machine.Status == MachineStatus.Warning || machine.Status == MachineStatus.Maintenance ? 2 : 1);

                for (int i = 0; i < woCount; i++)
                {
                    string status = machine.Status == MachineStatus.Error && i == 0 ? "InProgress"
                        : (machine.Status == MachineStatus.Maintenance && i == 0 ? "Open"
                        : (random.Next(0, 3) switch { 0 => "Open", 1 => "InProgress", _ => "Resolved" }));

                    var createdDate = DateTime.UtcNow.AddDays(-random.Next(1, 20));
                    var dueDate = createdDate.AddDays(random.Next(3, 10));
                    var resolvedDate = status == "Resolved" ? DateTime.UtcNow.AddDays(-random.Next(0, 10)) : (DateTime?)null;

                    string title = machine.Status == MachineStatus.Error && i == 0
                        ? $"Emergency Repair: {machine.Name} Failure Inspection"
                        : (machine.Status == MachineStatus.Warning && i == 0
                            ? $"Predictive Maintenance: Check Vibration on {machine.Name}"
                            : $"Scheduled Service: {machine.Name}");

                    workOrders.Add(new WorkOrder
                    {
                        TicketNumber = $"WO-{machine.SerialNumber}-{i + 1}",
                        MachineId = machine.Id,
                        Title = title,
                        Description = $"Comprehensive inspection, diagnostics, and calibration for {machine.Name}.",
                        Type = machine.Status == MachineStatus.Error ? "Critical" : (machine.Status == MachineStatus.Warning ? "Predictive" : "Routine"),
                        Status = status,
                        CreatedAt = createdDate,
                        DueDate = dueDate,
                        ResolvedAt = resolvedDate,
                        AssignedUserId = (i % 2 == 0) ? technicianUser.Id : adminUser.Id
                    });
                }
            }

            context.WorkOrders.AddRange(workOrders);
            context.SaveChanges();

            // 11. Incidents (at least 8 incidents per machine)
            var incidents = new List<Incident>();
            var incidentTemplates = new (string Message, string Severity)[]
            {
                ("Operating temperature exceeded warning threshold", "Warning"),
                ("Vibration spike detected on primary spindle bearing", "Warning"),
                ("Network latency timeout / telemetry packet drop detected", "Warning"),
                ("Coolant circulation pressure below nominal level", "Warning"),
                ("Feed rate deviation / minor material jam detected", "Warning"),
                ("Servo motor overload protection trip", "Critical"),
                ("Emergency stop (E-Stop) triggered on station", "Critical"),
                ("Safety barrier light curtain interrupted", "Warning"),
                ("Hydraulic pressure fluctuation during cycle", "Warning"),
                ("Optical inspection sensor calibration drift", "Warning")
            };

            foreach (var machine in machines)
            {
                int incidentCount = 8 + (Math.Abs(machine.Name.GetHashCode()) % 3); // 8, 9 or 10 incidents

                for (int i = 0; i < incidentCount; i++)
                {
                    var template = incidentTemplates[(i + Math.Abs(machine.Name.GetHashCode())) % incidentTemplates.Length];
                    string severity;
                    string incidentStatus;
                    DateTime triggeredAt;
                    string msg;

                    if (i == 0)
                    {
                        if (machine.Status == MachineStatus.Error)
                        {
                            severity = "Critical";
                            incidentStatus = "Active";
                            triggeredAt = DateTime.UtcNow.AddMinutes(-35);
                            msg = $"Critical Fault on {machine.Name}: Overload protection trip detected.";
                        }
                        else if (machine.Status == MachineStatus.Warning)
                        {
                            severity = "Warning";
                            incidentStatus = "Active";
                            triggeredAt = DateTime.UtcNow.AddHours(-2);
                            msg = $"Warning on {machine.Name}: Vibration exceeded warning threshold.";
                        }
                        else if (machine.Status == MachineStatus.Maintenance)
                        {
                            severity = "Warning";
                            incidentStatus = "Resolved";
                            triggeredAt = DateTime.UtcNow.AddHours(-11);
                            msg = $"Maintenance Notice: Filter replacement scheduled for {machine.Name}.";
                        }
                        else
                        {
                            severity = template.Severity;
                            incidentStatus = "Resolved";
                            triggeredAt = DateTime.UtcNow.AddDays(-1).AddHours(-random.Next(1, 10));
                            msg = $"{template.Message} on {machine.Name}.";
                        }
                    }
                    else
                    {
                        severity = template.Severity;
                        incidentStatus = i < 4 ? "Resolved" : "Archived";
                        triggeredAt = DateTime.UtcNow.AddDays(-(i * 3 + random.Next(0, 3))).AddHours(-random.Next(1, 20));
                        msg = $"{template.Message} on {machine.Name}.";
                    }

                    incidents.Add(new Incident
                    {
                        MachineId = machine.Id,
                        TriggeredAt = triggeredAt,
                        Message = msg,
                        Severity = severity,
                        Status = incidentStatus
                    });
                }
            }

            context.Incidents.AddRange(incidents);
            context.SaveChanges();

            // 12. Telemetry Readings
            var telemetryReads = new List<TelemetryRead>();

            foreach (var machine in machines)
            {
                double bTemp = 45.0;
                double bVib = 2.0;
                double bPower = 15.0;

                if (!string.IsNullOrEmpty(machine.StaticProperties))
                {
                    try
                    {
                        using var jsonDoc = System.Text.Json.JsonDocument.Parse(machine.StaticProperties);
                        if (jsonDoc.RootElement.TryGetProperty("NormTemp", out var tProp)) bTemp = tProp.GetDouble();
                        if (jsonDoc.RootElement.TryGetProperty("BaseVib", out var vProp)) bVib = vProp.GetDouble();
                        if (jsonDoc.RootElement.TryGetProperty("NormPower", out var pProp)) bPower = pProp.GetDouble();
                    }
                    catch { }
                }

                for (int i = 0; i < 10; i++)
                {
                    telemetryReads.Add(new TelemetryRead
                    {
                        MachineId = machine.Id,
                        Temperature = (decimal)Math.Round(bTemp + (random.NextDouble() * 4.0 - 2.0), 2),
                        Vibration = (decimal)Math.Round(bVib + (random.NextDouble() * 0.8 - 0.4), 2),
                        PowerLoadKw = (decimal)Math.Round(bPower + (random.NextDouble() * 3.0 - 1.5), 2),
                        NetworkLatencyMs = random.Next(12, 35),
                        Timestamp = DateTime.UtcNow.AddMinutes(-i * 5)
                    });
                }
            }

            context.TelemetryRead.AddRange(telemetryReads);
            context.SaveChanges();

            // 13. Production Logs
            var productionLogs = new List<ProductionLog>();

            foreach (var machine in machines.Where(m => m.ProductionLineId.HasValue))
            {
                for (int i = 0; i < 5; i++)
                {
                    productionLogs.Add(new ProductionLog
                    {
                        MachineId = machine.Id,
                        ShiftId = new[] { shiftA.Id, shiftB.Id, shiftC.Id }[random.Next(3)],
                        Timestamp = DateTime.UtcNow.AddDays(-i),
                        GoodParts = random.Next(400, 1200),
                        DefectiveParts = random.Next(0, 15),
                        AverageCycleTimeSeconds = (int)machine.CycleTimeSeconds,
                        IdealCycleTimeSeconds = (int)machine.CycleTimeSeconds,
                        ActiveOperatingSeconds = random.Next(18000, 28000)
                    });
                }
            }

            context.ProductionLogs.AddRange(productionLogs);
            context.SaveChanges();
            }

            // Ensure any existing database with fewer than 8 incidents per machine is backfilled
            var existingMachines = context.Machines.ToList();
            if (existingMachines.Any())
            {
                var newIncidents = new List<Incident>();
                var rand = new Random(100);
                var incidentTemplates = new (string Message, string Severity)[]
                {
                    ("Operating temperature exceeded warning threshold", "Warning"),
                    ("Vibration spike detected on primary spindle bearing", "Warning"),
                    ("Network latency timeout / telemetry packet drop detected", "Warning"),
                    ("Coolant circulation pressure below nominal level", "Warning"),
                    ("Feed rate deviation / minor material jam detected", "Warning"),
                    ("Servo motor overload protection trip", "Critical"),
                    ("Emergency stop (E-Stop) triggered on station", "Critical"),
                    ("Safety barrier light curtain interrupted", "Warning"),
                    ("Hydraulic pressure fluctuation during cycle", "Warning"),
                    ("Optical inspection sensor calibration drift", "Warning")
                };

                foreach (var m in existingMachines)
                {
                    int existingCount = context.Incidents.Count(inc => inc.MachineId == m.Id);
                    if (existingCount < 8)
                    {
                        int toAdd = 8 - existingCount;
                        for (int i = 0; i < toAdd; i++)
                        {
                            int idx = existingCount + i;
                            var template = incidentTemplates[(idx + Math.Abs(m.Name.GetHashCode())) % incidentTemplates.Length];
                            newIncidents.Add(new Incident
                            {
                                MachineId = m.Id,
                                TriggeredAt = DateTime.UtcNow.AddDays(-(idx * 3 + rand.Next(1, 4))).AddHours(-rand.Next(1, 20)),
                                Message = $"{template.Message} on {m.Name}.",
                                Severity = template.Severity,
                                Status = idx < 4 ? "Resolved" : "Archived"
                            });
                        }
                    }
                }

                if (newIncidents.Any())
                {
                    context.Incidents.AddRange(newIncidents);
                    context.SaveChanges();
                }
            }
        }
    }
}
