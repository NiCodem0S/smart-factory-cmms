using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Hubs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Services
{
    public class FactorySimulatorService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScope;
        private readonly TelemetryChannel _channel;
        private readonly IHubContext<TelemetryHub> _hubContext;
        private readonly ILogger<FactorySimulatorService> _logger;
        private readonly Random _random = new Random();
        private readonly Dictionary<Guid, double> _productionProgress = new();
        private readonly Dictionary<Guid, double> _machineTemperatures = new();
        private readonly Dictionary<Guid, bool> _isOverheating = new();

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
            int loopDelayMs = 1000;         // Task.Delay interval in ms
            int iterationsPerWindow = Math.Max(1, windowSeconds / (loopDelayMs / 1000));
            double p = 1 - Math.Pow(1 - P_window, 1.0 / iterationsPerWindow); // recalculate it when changing loopDelayMs

            DateTime windowStart = DateTime.UtcNow;
            bool anyEventThisWindow = false;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceScope.CreateScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    bool dbChangesMade = false;

                    var machines = await dbContext.Machines.Where(m => m.IsActive).ToListAsync();
                    var productionLines = await dbContext.ProductionLines.ToListAsync();

                    machines.OrderBy(m => m.OrderInLine).GroupBy(m => m.ProductionLineId);
                    var machinesRunning = machines.Where(m => m.Status == MachineStatus.Running);

                    //Production line loop
                    foreach (var line in productionLines)
                    {
                        if (line.Status == "Running") //Machines wont magically fix themselves, fixing and rerunning the line will be handled by maintance work tasks
                        {
                            foreach (var machine in line.Machines)
                            {
                                if (machine.Status != MachineStatus.Running)
                                {
                                    line.Status = "Halted";
                                    _productionProgress[machine.Id] = 0;
                                    //Scrape the product currently going through the line
                                    //Zmiana throughput na 0 units/h we frontendzie
                                    //Wysłanie do frontendu zmiany stylu tej lini na halted
                                    //Wyslanie do frontendu gdzie jest JAM
                                    //Wyslanie do frontendu info o zmianie stausu maszyny zeby wyswietlic pod nią ERROR

                                    foreach (var lineMachine in line.Machines)
                                    {
                                        if(lineMachine.Status == MachineStatus.Running)
                                        {
                                            lineMachine.Status = MachineStatus.Offline;
                                            _productionProgress[lineMachine.Id] = 0;
                                            //Zmiana statusu we frontendzie na offline
                                        }
                                    }
                                    dbChangesMade = true;
                                }
                            }
                        }
                    }

                    //Machine Telemetry loop
                    foreach(var machine in machines)
                    {
                        if (!_productionProgress.ContainsKey(machine.Id))
                        {
                            _productionProgress[machine.Id] = 0;
                        }

                        var telemetry = new TelemetryRead
                        {

                        };

                        if (machine.Status == MachineStatus.Running)
                        {
                            _productionProgress[machine.Id] += 1.0;

                            if (_random.NextDouble() < p)
                            {
                                machine.Status = MachineStatus.Error;
                                _productionProgress[machine.Id] = 0;
                                anyEventThisWindow = true;
                                dbChangesMade = true;
                            }

                            if (_productionProgress[machine.Id] >= machine.CycleTimeSeconds)
                            {
                                int partsProduced = (int)(_productionProgress[machine.Id] / machine.CycleTimeSeconds); //if server lags and produces more
                                machine.TotalProduced += partsProduced;

                                _productionProgress[machine.Id] %= machine.CycleTimeSeconds;

                                dbChangesMade = true;
                            }
                        }

                    }
                    //Fallback jezeli przez 4 minuty nic się nie zmieniło
                    if ((DateTime.UtcNow - windowStart).TotalSeconds >= windowSeconds)
                    {
                        if (!anyEventThisWindow && machines.Count > 0)
                        {
                            // fallback: wymuś jedno zdarzenie losowo
                            var chosen = machinesRunning.ToList()[_random.Next(machines.Count)];
                            chosen.Status = MachineStatus.Error;
                            dbChangesMade = true;
                        }

                        // reset okna
                        windowStart = DateTime.UtcNow;
                        anyEventThisWindow = false;
                    }

                    await Task.Delay(loopDelayMs, stoppingToken);
                }
                catch(Exception ex)
                {
                    _logger.LogError(ex, "Błąd w pętli symulatora");
                }
            }
        }
    }
}

/*
 1. Otwarcie Sceny (Dependency Injection)

Użyj _serviceScope.CreateScope(), aby stworzyć "bąbel".
Wyciągnij świeży ApplicationDbContext.
2. Inwentaryzacja Fabryki (Odczyt z EF Core)

Pobierz wszystkie linie produkcyjne do postaci Listy (.ToList()).
Pobierz wszystkie aktywne maszyny do postaci Listy (.Where(m => m.IsActive).ToList()).
Wskazówka: Zdefiniuj tu sobie zmienną pomocniczą bool dbChangesMade = false;, żeby wiedzieć, czy na koniec trzeba zapisać zmiany w bazie.
3. Grupowanie i Ocena Stanu Linii (Logika Zatoru)

Zgrupuj pobrane maszyny według ProductionLineId.
Pętla po Liniach Produkcyjnych: Sprawdź, czy któraś z maszyn przypisanych do danej linii zgłasza MachineStatus.Error. Jeśli tak, linia staje (Halted), 
jeśli nie - działa (Running). Jeśli status linii się zmienił od poprzedniego razu: ustaw flagę dbChangesMade = true i wyślij nowinę przez SignalR (_hubContext).

4. Symulacja Maszyn i Czujników (Główna fizyka)

Pętla po Maszynach:
Zagraj w kości (_random.NextDouble()): Czy działająca maszyna ma się popsuć? Albo czy zepsuta ma cudownie ożyć? Jeśli tak, zmień jej status, 
uaktualnij dbChangesMade i ogłoś to na SignalR.
Jeśli maszyna działa, a linia NIE stoi: dodaj "+1" do TotalProduced w zależności od jej CycleTimeSeconds.
Na samym końcu wygeneruj fałszywy odczyt dla maszyny (obiekt TelemetryRead z udawaną temperaturą np. bazową 65°C ± jakieś losowe odchylenia).
5. Zrzut danych (Rozesłanie i Zapis)

Wygenerowany odczyt czujnika wrzuć do rury: await _channel.AddTelemetryAsync(...) (zajmie się tym później nasz Batch Writer).
Ten sam odczyt krzyknij do przeglądarek: await _hubContext.Clients.All.SendAsync("ReceiveTelemetry", ...)
Na samym końcu (już poza pętlami): jeśli dbChangesMade == true, wykonaj await dbContext.SaveChangesAsync().
6. Sen i Reset

Odczekaj 2 sekundy (Task.Delay), zanim cała pętla ruszy od nowa.

//Dodac auto maintance scheduler jako opcja ON/OFF (send an email / create a task) - czyli chyba bedzie jeszcze potrzebne w przyszlosci cos typu
// work service gdzie symuluje prace serwisantow przy maszynach
 
 */