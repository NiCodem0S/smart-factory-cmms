# Symulacja maszyn: architektura i kontrakt stanów

Status: etap 0. Kontrakt dla nowego silnika; istniejące endpointy jeszcze go nie egzekwują.

## Punkt wyjścia (26.10.2026)

- API: ASP.NET Core 8, kontrolery, EF Core 8 i SQL Server. `Program.cs` rejestruje repozytoria i JWT, ale nie rejestruje `FactorySimulatorService`, `TelemetryChannel` ani SignalR. Nie ma konsumenta kanału telemetrii.
- UI: React, Vite i React Router. Są widoki maszyn i linii; `LiveDashboard` jest pustym szkieletem. Trasa `/simulation` nie istnieje.
- `FactorySimulatorService` czyta wszystkie aktywne maszyny i linie z SQL w każdym ticku, trzyma stan fizyki w słownikach procesu, wysyła telemetrię do kanału i do `Clients.All`. W tej chwili usługa nie działa, bo nie jest rejestrowana.
- `ProductionLinesRepository` bezpośrednio zmienia `Machine.Status`: start linii włącza maszyny `Offline`, a zatrzymanie linii je wyłącza. Symulator także automatycznie zmienia status linii i innych maszyn. To trzy konkurujące źródła decyzji.
- `MachinesController` udostępnia ogólne PUT statusu maszyny. Ta droga musi przejść przez tę samą usługę stanów co nowe polecenia. Należy też sprawdzić uprawnienia hali przy zapisie i odczycie telemetrii; sama rola w atrybucie kontrolera nie zapewnia izolacji hali.
- `Machine.Status` aktualizuje licznik godzin i czas zmiany w setterze, a setter `ProductionLine.Status` aktualizuje czas nawet przy ponownym przypisaniu tej samej wartości. Przenosząc przejścia, trzeba zachować poprawność tych liczników i nie wywoływać pozornych zmian statusu.

## Źródła prawdy i odpowiedzialność

| Informacja | Źródło prawdy | Zmieniana przez |
| --- | --- | --- |
| `Machine.IsActive`, `Machine.Status`, `ProductionLine.Status` | SQL | Usługa operacji na maszynie i linii; fizyka zgłasza do niej zdarzenia |
| Profil i `SimulationEnabled` (żądanie pracy) | SQL | API administracyjne i operacja start/stop maszyny |
| Faktycznie działający worker i ostatni błąd | Orkiestrator jednej instancji API | Orkiestrator |
| Bieżący stan fizyki | Pamięć właściciela workera, publikowana do Redis | Worker maszyny |
| Stan po restarcie i licznik produkcji | Spójny checkpoint SQL | Usługa checkpointu w transakcji |
| Próbki historyczne | SQL | Konsument kanału telemetrii |

`SimulationEnabled=true` nie dowodzi, że worker działa. Redis nie jest podstawą do ponownego naliczenia produkcji po restarcie. Nowy worker startuje z checkpointu SQL, a potem publikuje odtworzony snapshot w Redis.

## Niezmienniki

1. Maszyna `Offline` lub nieaktywna nie ma workera, nie emituje telemetrii i ma `SimulationEnabled=false`.
2. Linia `Running` albo `Warning` ma co najmniej jedną aktywną maszynę, wszystkie jej aktywne maszyny są `Running` albo `Warning`, a ich workery faktycznie działają. Start linii nie zmienia statusu maszyn.
3. Linia `Halted` nie produkuje. Jej sprawne maszyny mogą nadal działać i raportować telemetrię.
4. Maszyna przypisana do linii produkuje wyłącznie przy `Running`/`Warning` maszyny, działającym workerze i `Running`/`Warning` linii. Maszyna bez linii potrzebuje dwóch pierwszych warunków.
5. Ręczne zatrzymanie symulacji lub awaria workera maszyny w pracującej linii zatrzymuje linię. Odzyskanie workera nie wznawia produkcji samoistnie.
6. Status operacyjny, żądanie pracy, rzeczywisty worker i checkpoint są jawnie rozdzielone w API oraz UI.

## Przejścia maszyny

| Zdarzenie | Stan przed | Stan po | Worker i `SimulationEnabled` | Wpływ na linię |
| --- | --- | --- | --- | --- |
| Uruchom maszynę | `Offline` | `Running` | Start workera i zapis `true` jako jedna operacja aplikacyjna; błąd startu wycofuje zmianę | Linia pozostaje zatrzymana, dopóki operator jej nie uruchomi |
| Start symulacji | `Running`/`Warning` | Bez zmiany | Start idempotentny, zapis `true` | Bez zmiany |
| Stop symulacji | `Running`/`Warning`/`Error` | Bez zmiany | Checkpoint, stop, zapis `false` | Pracująca linia przechodzi do `Halted` |
| Zatrzymaj maszynę | Każdy poza `Offline` | `Offline` | Checkpoint, stop, zapis `false` | Pracująca linia przechodzi do `Halted` |
| Ostrzeżenie z fizyki | `Running` | `Warning` | Działa dalej | `Running` → `Warning` |
| Ustąpienie ostrzeżenia | `Warning` | `Running` | Działa dalej | `Warning` → `Running` tylko gdy linia nie była ręcznie zatrzymana |
| Awaria z fizyki | `Running`/`Warning` | `Error` | Działa dalej, ale bez produkcji; może raportować chłodzenie | Pracująca linia przechodzi do `Halted` |
| Rozpocznij konserwację | `Running`/`Warning`/`Error` | `Maintenance` | Checkpoint, stop, zapis `false` | Pracująca linia przechodzi do `Halted` |
| Zakończ konserwację | `Maintenance` | `Offline` | Pozostaje zatrzymany | Linia pozostaje `Halted` |

Decyzja projektowa do oceny podczas implementacji: `Error` pozostawia już uruchomiony worker dla telemetrii chłodzenia, ale nie pozwala uruchomić nowego workera ani automatycznie wrócić do `Running`. Operator przechodzi przez konserwację lub wyłączenie i ponowny start. `Maintenance` nie emituje telemetrii symulowanej. Te reguły unikają niejawnej naprawy przez sam spadek temperatury.

Zmiana `Running`/`Warning` → `Error` tworzy zdarzenie tylko na przejściu. Polecenia operatora mają pierwszeństwo nad fizyką: po wyłączeniu lub wejściu w konserwację spóźniony wynik ticku nie może przywrócić `Warning`, `Error` ani produkcji. Implementacja wymaga jednej usługi przejść oraz kontroli wersji lub synchronizacji dla równoległych poleceń.

## Przejścia linii

| Polecenie lub zdarzenie | Wynik |
| --- | --- |
| Start linii `Offline`/`Halted` | `Running` lub `Warning` (jeśli co najmniej jedna maszyna ostrzega), wyłącznie gdy każda aktywna przypisana maszyna ma dozwolony status i działający worker. Pusta linia nie startuje. |
| Zatrzymaj linię | `Halted`; statusy maszyn, workery i `SimulationEnabled` pozostają bez zmiany. |
| Ostrzeżenie/ustąpienie ostrzeżenia podczas produkcji | `Running` ↔ `Warning`; nie wznawia linii `Halted`. |
| Błąd maszyny, jej wyłączenie, zatrzymanie symulacji, awaria workera lub utrata Redis | `Halted`; pozostałe sprawne maszyny pozostają uruchomione, lecz nie produkują. |

`ProductionLine.Status` jest dziś tekstem (`Offline`, `Running`, `Warning`, `Halted`). Wdrożenie powinno zebrać te wartości w jednym kontrakcie kodu, zamiast rozszerzać rozproszone literały.

## Kolejność wdrażania

### Konfiguracja częstotliwości i retencji

Uzgodniony wymóg: częstotliwości są konfigurowalne, bez stałych interwałów ukrytych w pętlach workerów. Globalne ustawienia otrzymają sekcję `Simulation` w konfiguracji API (appsettings i nadpisania zmiennymi środowiskowymi), silnie typowane opcje oraz walidację dodatnich wartości:

- `DefaultTickIntervalMs`: początkowo 1000; wartość domyślna przy tworzeniu profilu. Faktyczny tick danej maszyny pozostaje w jej profilu SQL, dzięki czemu maszyny mogą mieć różne interwały. Zmiana globalnego domyślnego interwału nie nadpisuje istniejących profili.
- `LivePublishIntervalSeconds`: początkowo 1; maksymalna częstotliwość publikowania odczytów na żywo.
- `HistorySampleIntervalSeconds`: początkowo 5; częstotliwość próbek historii w SQL, niezależna od checkpointu.
- `CheckpointIntervalSeconds`: początkowo 5; częstotliwość transakcyjnego checkpointu SQL.
- `ReconcileIntervalSeconds`: częstotliwość uzgadniania orkiestratora z SQL.
- `TelemetryCleanupIntervalHours`: początkowo 24; częstotliwość usuwania historii starszej niż limit retencji, w ograniczonych partiach.

Retencja surowych próbek ma jedno źródło prawdy: istniejące `SystemSettings.RawTelemetryRetentionDays` w SQL (domyślnie 30). Nie dodajemy drugiej równorzędnej wartości retencji w appsettings. Podsumowania historyczne i ich retencja pozostają przyszłym rozszerzeniem.

Interwały globalne w pierwszej wersji są wczytywane przy starcie API; zmianę ticku profilu worker przejmuje podczas pracy. Publikacja i historia korzystają z faktycznie wygenerowanych snapshotów, bez tworzenia sztucznych próbek przy ticku rzadszym niż interwał publikacji. Zmiany statusu i zdarzenia krytyczne nie czekają na interwał próbkowania historii. Częstotliwość ticku nie zmienia prawdopodobieństwa awarii ani produkcji w jednostce czasu.

Powyższe opisuje kontrakt do wdrożenia razem z modelami i odpowiednimi usługami; bieżący kod połączenia Redis nie implementuje jeszcze tych harmonogramów.

### Etapy

Uzgodniony dalszy kierunek: po wdrożeniu Redis i działających niezależnych symulacji każdej maszyny przygotujemy pełną konteneryzację aplikacji. API, serwer plików UI i Redis otrzymają osobne kontenery oraz wspólną konfigurację Docker Compose. Sposób uruchamiania SQL Server ustalimy w tym etapie. Jest to kolejny etap projektu po domknięciu przepływu symulacji.

1. Skonfigurować Redis lokalnie i sprawdzać jego dostępność bez cichego magazynu zastępczego.
2. Dodać model SQL, migrację i profile domyślne bez nadpisywania edycji użytkownika.
3. Wydzielić czystą fizykę, potem orkiestrator, checkpoint i konsumenta telemetrii.
4. Przełączyć wszystkie zapisy statusów na wspólną usługę; dopiero wtedy udostępnić start/stop linii i maszyny zgodny z powyższą tabelą.
5. Dodać kontrolę dostępu w API i SignalR oraz panel `/simulation`.

Do czasu punktu 4 nie włączamy starego `FactorySimulatorService`: nie ma pełnej persystencji telemetrii ani ochrony przed sprzecznymi statusami.

Przy przełączeniu na nowy silnik istniejące rekordy linii ze statusem `Running`/`Warning` wymagają jednorazowego uzgodnienia. Seeder tworzy takie linie, choć obecnie żaden worker nie działa. Nie wolno przedstawiać ich jako produkujących do chwili, gdy maszyny mają rzeczywiście uruchomione symulacje; bezpieczny stan przejściowy to `Halted`.
