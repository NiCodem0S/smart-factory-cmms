using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services
{
    public class FactorySimulatorService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScope;
        private readonly TelemetryChannel _channel;
        private readonly IHubContext<TelemetryHub> _hubContext;
        private readonly ILogger<FactorySimulatorService> _logger;
        private readonly Random _random = new Random();
        
        // Physics states
        private readonly Dictionary<Guid, double> _productionProgress = new();
        private readonly Dictionary<Guid, double> _machineBaseTemperatures = new();
        private readonly Dictionary<Guid, double> _machineBaseVibrations = new();
        private readonly Dictionary<Guid, double> _machineBasePowerLoads = new();
        
        private readonly Dictionary<Guid, double> _machineTemperatures = new();
        private readonly Dictionary<Guid, double> _machineVibrations = new();
        
        // Events
        private readonly Dictionary<Guid, bool> _isOverheating = new();
        private readonly Dictionary<Guid, bool> _isOvervibrating = new();

        public FactorySimulatorService(
            IServiceScopeFactory serviceScope, 
            TelemetryChannel channel, 
            IHubContext<TelemetryHub> hubContext,
            ILogger<FactorySimulatorService> logger)
        {
            _serviceScope = serviceScope;
            _channel = channel;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            double P_window = 0.01;         // 1% per 2-minute window per machine
            int windowSeconds = 240;        // 2 minutes
            int loopDelayMs = 1000;         // 1-second tick
            int iterationsPerWindow = Math.Max(1, windowSeconds / (loopDelayMs / 1000));
            double genericFailureProbability = 1 - Math.Pow(1 - P_window, 1.0 / iterationsPerWindow);

            DateTime windowStart = DateTime.UtcNow;
            bool anyEventThisWindow = false;

            while (!stoppingToken.IsCancellationRequested)
            {
                using var scope = _serviceScope.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                bool dbChangesMade = false;

                var machines = await dbContext.Machines
                    .Include(m => m.AlertThresholds)
                    .Where(m => m.IsActive)
                    .ToListAsync(stoppingToken);
                    
                var productionLines = await dbContext.ProductionLines
                    .Include(pl => pl.Machines)
                    .ToListAsync(stoppingToken);

                var machinesRunning = machines.Where(m => m.Status == MachineStatus.Running || m.Status == MachineStatus.Warning).ToList();
                var lastMachinesIds = new HashSet<Guid>();

                EvaluateProductionLines(productionLines, lastMachinesIds, ref dbChangesMade);

                foreach(var machine in machines)
                {
                    InitializeMachineState(machine);
                    var physicsResult = await SimulateMachinePhysicsAsync(machine, lastMachinesIds, genericFailureProbability, stoppingToken);
                    
                    if (physicsResult.DbChangesMade) dbChangesMade = true;
                    if (physicsResult.AnyEventThisWindow) anyEventThisWindow = true;
                }

                EvaluateFallbackEvents(machinesRunning, windowSeconds, ref windowStart, ref anyEventThisWindow, ref dbChangesMade);

                if(dbChangesMade)
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                }

                await Task.Delay(loopDelayMs, stoppingToken); 
            }
        }

        private void EvaluateProductionLines(List<ProductionLine> productionLines, HashSet<Guid> lastMachinesIds, ref bool dbChangesMade)
        {
            foreach (var line in productionLines)
            {
                // Save last production line machine
                var lastMachine = line.Machines.OrderByDescending(m => m.OrderInLine).FirstOrDefault();
                if (lastMachine != null)
                {
                    lastMachinesIds.Add(lastMachine.Id);
                }

                // Check line status based on machine states
                bool hasError = line.Machines.Any(m => m.Status == MachineStatus.Error || m.Status == MachineStatus.Maintenance);
                bool hasWarning = line.Machines.Any(m => m.Status == MachineStatus.Warning);
                bool hasRunning = line.Machines.Any(m => m.Status == MachineStatus.Running);

                if (hasError)
                {
                    if (line.Status != "Halted")
                    {
                        line.Status = "Halted";
                        line.LastStatusChangedAt = DateTime.UtcNow;
                        dbChangesMade = true;
                    }
                    
                    foreach (var lineMachine in line.Machines)
                    {
                        if (lineMachine.Status == MachineStatus.Running || lineMachine.Status == MachineStatus.Warning)
                        {
                            lineMachine.Status = MachineStatus.Offline;
                            _productionProgress[lineMachine.Id] = 0;
                            dbChangesMade = true;
                        }
                    }
                }
                else if (hasRunning || hasWarning)
                {
                    string targetStatus = hasWarning ? "Warning" : "Running";
                    if (line.Status != targetStatus)
                    {
                        line.Status = targetStatus;
                        line.LastStatusChangedAt = DateTime.UtcNow;
                        dbChangesMade = true;
                    }
                }
                else
                {
                    // All machines are offline
                    if (line.Status != "Halted")
                    {
                        line.Status = "Halted";
                        line.LastStatusChangedAt = DateTime.UtcNow;
                        dbChangesMade = true;
                    }
                }
            }
        }

        private void InitializeMachineState(Machine machine)
        {
            if (!_productionProgress.ContainsKey(machine.Id))
                _productionProgress[machine.Id] = 0;

            if (!_machineBaseTemperatures.ContainsKey(machine.Id))
            {
                double bTemp = 60.0;
                double bVib = 1.0;
                double bPower = 15.0;

                if (!string.IsNullOrEmpty(machine.StaticProperties))
                {
                    using var jsonDoc = System.Text.Json.JsonDocument.Parse(machine.StaticProperties);
                    if (jsonDoc.RootElement.TryGetProperty("NormTemp", out var tProp)) bTemp = tProp.GetDouble();
                    if (jsonDoc.RootElement.TryGetProperty("BaseVib", out var vProp)) bVib = vProp.GetDouble();
                    if (jsonDoc.RootElement.TryGetProperty("NormPower", out var pProp)) bPower = pProp.GetDouble();
                }

                _machineBaseTemperatures[machine.Id] = bTemp;
                _machineBaseVibrations[machine.Id] = bVib;
                _machineBasePowerLoads[machine.Id] = bPower;
                
                _machineTemperatures[machine.Id] = bTemp;
                _machineVibrations[machine.Id] = bVib;
                _isOverheating[machine.Id] = false;
                _isOvervibrating[machine.Id] = (machine.Status == MachineStatus.Warning);
            }
        }

        private async Task<(bool DbChangesMade, bool AnyEventThisWindow)> SimulateMachinePhysicsAsync(Machine machine, HashSet<Guid> lastMachinesIds, double failureProbability, CancellationToken stoppingToken)
        {
            bool dbChangesMade = false;
            bool anyEventThisWindow = false;

            var tempThreshold = machine.AlertThresholds?.FirstOrDefault(t => t.MetricType == "Temperature");
            var vibThreshold = machine.AlertThresholds?.FirstOrDefault(t => t.MetricType == "Vibration");

            double warningTemp = tempThreshold != null ? (double)tempThreshold.WarningValue : (_machineBaseTemperatures[machine.Id] + 15.0);
            double criticalTemp = tempThreshold != null ? (double)tempThreshold.CriticalValue : (_machineBaseTemperatures[machine.Id] + 30.0);

            double warningVib = vibThreshold != null ? (double)vibThreshold.WarningValue : (_machineBaseVibrations[machine.Id] + 2.0);
            double criticalVib = vibThreshold != null ? (double)vibThreshold.CriticalValue : (_machineBaseVibrations[machine.Id] + 3.5); 

            double currentTemp = _machineTemperatures[machine.Id];
            double currentVib = _machineVibrations[machine.Id];
            double currentPower = 0.0;

            if (machine.Status == MachineStatus.Running || machine.Status == MachineStatus.Warning)
            {
                currentPower = _machineBasePowerLoads[machine.Id] + (_random.NextDouble() * 5.0 - 2.5);
                currentVib = _machineBaseVibrations[machine.Id] + (_random.NextDouble() * 1.5 - 0.75);

                if (!_isOverheating[machine.Id] && _random.NextDouble() < 0.02)
                    _isOverheating[machine.Id] = true;

                if (_isOverheating[machine.Id])
                {
                    currentTemp += 1.0 + (_random.NextDouble() * 2.0);
                    currentVib += 3.0; 
                }
                else
                {
                    currentTemp += (_random.NextDouble() * 2.0) - 1.0;
                    if (currentTemp < _machineBaseTemperatures[machine.Id] - 2.0) currentTemp = _machineBaseTemperatures[machine.Id] - 2.0;
                }

                if (!_isOvervibrating[machine.Id] && _random.NextDouble() < 0.015)
                    _isOvervibrating[machine.Id] = true;

                if (_isOvervibrating[machine.Id])
                {
                    currentVib += 2.2 + (_random.NextDouble() * 1.0);
                }

                // Check Thresholds & Status transitions
                if (currentTemp >= criticalTemp || currentVib >= criticalVib)
                {
                    if (machine.Status != MachineStatus.Error)
                    {
                        machine.Status = MachineStatus.Error;
                        machine.LastStatusChangedAt = DateTime.UtcNow;
                        _productionProgress[machine.Id] = 0;
                        dbChangesMade = true;
                        anyEventThisWindow = true;
                    }
                }
                else if (currentTemp >= warningTemp || currentVib >= warningVib)
                {
                    if (machine.Status != MachineStatus.Warning)
                    {
                        machine.Status = MachineStatus.Warning;
                        machine.LastStatusChangedAt = DateTime.UtcNow;
                        dbChangesMade = true;
                        anyEventThisWindow = true;
                    }
                }
                else if (machine.Status == MachineStatus.Warning)
                {
                    machine.Status = MachineStatus.Running;
                    machine.LastStatusChangedAt = DateTime.UtcNow;
                    dbChangesMade = true;
                }

                if ((machine.Status == MachineStatus.Running || machine.Status == MachineStatus.Warning) && _random.NextDouble() < failureProbability)
                {
                    machine.Status = MachineStatus.Error;
                    machine.LastStatusChangedAt = DateTime.UtcNow;
                    _productionProgress[machine.Id] = 0;
                    dbChangesMade = true;
                    anyEventThisWindow = true;
                }

                if (machine.Status == MachineStatus.Running || machine.Status == MachineStatus.Warning)
                {
                    _productionProgress[machine.Id] += 1.0;

                    if (_productionProgress[machine.Id] >= machine.CycleTimeSeconds)
                    {
                        int partsProduced = (int)(_productionProgress[machine.Id] / machine.CycleTimeSeconds);
                        machine.TotalProduced += partsProduced;
                        _productionProgress[machine.Id] %= machine.CycleTimeSeconds;
                        
                        if (lastMachinesIds.Contains(machine.Id))
                        {
                            // Line Success
                        }

                        dbChangesMade = true;
                    }
                }
            }
            else if (machine.Status == MachineStatus.Error)
            {
                currentPower = 0.5;
                currentTemp -= 0.5;
                if (currentTemp < 25.0) currentTemp = 25.0;
                currentVib = 0;
            }
            else 
            {
                currentPower = 0.1;
                currentTemp -= 1.0;
                if (currentTemp < 25.0) currentTemp = 25.0;
                currentVib = 0;
                
                _isOverheating[machine.Id] = false;
                _isOvervibrating[machine.Id] = false;
            }

            _machineTemperatures[machine.Id] = currentTemp;
            _machineVibrations[machine.Id] = currentVib;

            var telemetry = new TelemetryRead
            {
                MachineId = machine.Id,
                Timestamp = DateTime.UtcNow,
                Temperature = (decimal)Math.Round(currentTemp, 2),
                Vibration = (decimal)Math.Round(currentVib, 2),
                PowerLoadKw = (decimal)Math.Round(currentPower, 2)
            };

            await _channel.AddTelemetryAsync(telemetry, stoppingToken);
            await _hubContext.Clients.All.SendAsync("ReceiveTelemetry", telemetry, stoppingToken);

            return (dbChangesMade, anyEventThisWindow);
        }

        private void EvaluateFallbackEvents(List<Machine> machinesRunning, int windowSeconds, ref DateTime windowStart, ref bool anyEventThisWindow, ref bool dbChangesMade)
        {
            if ((DateTime.UtcNow - windowStart).TotalSeconds >= windowSeconds)
            {
                if (!anyEventThisWindow && machinesRunning.Count > 0)
                {
                    var chosen = machinesRunning[_random.Next(machinesRunning.Count)];
                    chosen.Status = MachineStatus.Warning;
                    dbChangesMade = true;
                }
                windowStart = DateTime.UtcNow;
                anyEventThisWindow = false;
            }
        }
    }
}