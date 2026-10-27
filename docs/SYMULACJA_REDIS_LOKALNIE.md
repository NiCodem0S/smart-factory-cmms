# Redis dla lokalnej symulacji

Konfiguracja z `compose.simulation.yaml` uruchamia jeden Redis z AOF i nazwanym wolumenem. Port jest dostępny tylko na `127.0.0.1` laptopa. API uruchomione na hoście powinno dostać `Redis__ConnectionString=127.0.0.1:6379`. Jeśli API będzie kiedyś usługą w tej samej sieci Compose, wartością będzie `redis:6379`.

Przykład uruchomienia API w PowerShell:

```powershell
$env:Redis__ConnectionString = '127.0.0.1:6379'
Set-Location api
dotnet run
```

## Uruchomienie i sprawdzenie

```powershell
docker compose -f compose.simulation.yaml up -d
docker compose -f compose.simulation.yaml ps
docker compose -f compose.simulation.yaml exec -T redis redis-cli ping
```

Oczekiwana odpowiedź: `PONG`, a status kontenera: `healthy`.

## Kontrola trwałości AOF i wolumenu

```powershell
docker compose -f compose.simulation.yaml exec -T redis redis-cli SET simulation:volume-check ok
docker compose -f compose.simulation.yaml restart redis
docker compose -f compose.simulation.yaml exec -T redis redis-cli GET simulation:volume-check
```

Oczekiwana odpowiedź po restarcie: `ok`. Klucz testowy można usunąć poleceniem `docker compose -f compose.simulation.yaml exec -T redis redis-cli DEL simulation:volume-check`.

## Stan integracji

API ma jeden współdzielony klient Redis tworzony przy pierwszym użyciu. Uwierzytelniony `SuperAdmin` lub `HallAdmin` może odpytać `GET /health/simulation-redis`: `200 Healthy` oznacza odpowiedź na `PING`, a `503 Unhealthy` oznacza brak konfiguracji lub połączenia. Pozostałe endpointy API nie wymagają Redis do uruchomienia. Symulator nie jest jeszcze włączony, więc zdrowe połączenie Redis nie oznacza działającej symulacji.
