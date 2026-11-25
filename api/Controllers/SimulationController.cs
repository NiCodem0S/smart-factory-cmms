using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Controllers;

[ApiController]
[Authorize(Roles = "SuperAdmin,HallAdmin,Technician")]
[Route("api/simulation")]
public class SimulationController(ApplicationDbContext db, IUserContext user, IMapper mapper,
    SimulationOrchestrator runtime, ISimulationStateStore stateStore, SimulationDiagnostics diagnostics,
    TelemetryChannel history, ITelemetryHistoryQueue? streamQueue = null) : ControllerBase
{
    private IQueryable<Machine> Accessible()
    {
        var query = db.Machines.AsNoTracking()
            .Where(m => m.IsActive && m.TelemetrySource == TelemetrySource.Simulated)
            .Include(m => m.SimulationProfile)
            .Include(m => m.ProductionLine)
            .AsQueryable();

        if (user.IsSuperAdmin)
        {
            return query;
        }

        return query.Where(m => m.FactoryHallId == user.FactoryHallId);
    }

    private async Task<SimulationMachineDto> Describe(Machine machine, bool available, CancellationToken ct)
    {
        MachineSimState? state = null;
        string? readError = null;
        if (available)
        {
            try
            {
                state = await stateStore.ReadAsync(machine.Id, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                readError = "Current snapshot is unavailable.";
            }
        }
        var info = runtime.Inspect(machine.Id, machine.SimulationEnabled);
        var status = (!available || readError is not null) && info.Status == "Running" ? "Unavailable" : info.Status;
        var error = readError ?? info.Error;
        if (user.IsTechnician && error is not null)
        {
            error = "Simulation is unavailable. Contact the hall administrator.";
        }

        return new(machine.Id, machine.Name, machine.FactoryHallId, machine.ProductionLineId, machine.Status,
                    machine.SimulationEnabled, status, error, state,
                    state is null ? null : Math.Max(0, (DateTimeOffset.UtcNow - state.LastTickAtUtc).TotalSeconds),
                    mapper.Map<SimulationProfileDto>(machine.SimulationProfile), machine.ProductionLine?.Status,
                    runtime.AutomationEnabled, machine.AutomaticRepairAtUtc);
    }

    [HttpGet]
    public async Task<ActionResult<SimulationListDto>> List([FromQuery] Guid? hallId, CancellationToken ct)
    {
        var query = Accessible();
        if (hallId.HasValue && user.IsSuperAdmin)
        {
            query = query.Where(m => m.FactoryHallId == hallId);
        }

        var machines = await query.OrderBy(m => m.Name).ToListAsync(ct);
        var available = await stateStore.IsAvailableAsync(ct);
        var result = new List<SimulationMachineDto>();
        foreach (var machine in machines)
        {
            result.Add(await Describe(machine, available, ct));
        }

        var queueLength = streamQueue is not null
            ? (int)Math.Min(int.MaxValue, await streamQueue.GetApproximateLengthAsync(ct))
            : history.Count;

        return Ok(new SimulationListDto(available,
                    user.IsTechnician ? (runtime.ServiceError is null ? null : "Simulation service is unavailable.") : runtime.ServiceError,
                    result, diagnostics.Dropped, diagnostics.Persisted, diagnostics.PersistenceErrors, queueLength,
                    diagnostics.LastHistoryWriteAtUtc, user.IsTechnician && diagnostics.LastHistoryError is not null ? "History persistence is unavailable." : diagnostics.LastHistoryError,
                    runtime.AutomationStatus(machines)));
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPut("automation")]
    public async Task<IActionResult> Automation(UpdateSimulationAutomationDto dto, CancellationToken ct)
    {
        await runtime.SetAutomationAsync(SimulationActor.From(user),
            dto.Enabled ?? throw new SimulationRequestException(400, "Enabled is required."), ct);
        return NoContent();
    }

    [HttpGet("{machineId:guid}/state")]
    public async Task<ActionResult<SimulationMachineDto>> State(Guid machineId, CancellationToken ct)
    {
        var machine = await Accessible().SingleOrDefaultAsync(m => m.Id == machineId, ct);
        if (machine is null)
        {
            return NotFound(new
            {
                message = "Machine not found."
            });
        }

        return Ok(await Describe(machine, await stateStore.IsAvailableAsync(ct), ct));
    }

    [HttpGet("{machineId:guid}/profile")]
    public async Task<ActionResult<SimulationProfileDto>> Profile(Guid machineId, CancellationToken ct)
    {
        var machine = await Accessible().SingleOrDefaultAsync(m => m.Id == machineId, ct);
        if (machine?.SimulationProfile is null)
        {
            return NotFound(new
            {
                message = "Machine profile not found."
            });
        }

        return Ok(mapper.Map<SimulationProfileDto>(machine.SimulationProfile));
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpPut("{machineId:guid}/profile")]
    public async Task<IActionResult> UpdateProfile(Guid machineId, UpdateSimulationProfileDto dto, CancellationToken ct)
    {
        await runtime.UpdateProfileAsync(machineId, SimulationActor.From(user), dto, ct);
        return NoContent();
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpPost("{machineId:guid}/preset")]
    public async Task<IActionResult> Preset(Guid machineId, ApplySimulationPresetDto dto, CancellationToken ct)
    {
        await runtime.ApplyPresetAsync(machineId, SimulationActor.From(user), dto, ct);
        return NoContent();
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpPost("{machineId:guid}/scenario")]
    public async Task<IActionResult> Scenario(Guid machineId, TriggerSimulationScenarioDto dto, CancellationToken ct)
    {
        await runtime.TriggerScenarioAsync(machineId, SimulationActor.From(user),
            dto.Scenario ?? throw new SimulationRequestException(400, "Scenario is required."), ct);
        return NoContent();
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpPost("{machineId:guid}/start")]
    public async Task<IActionResult> Start(Guid machineId, CancellationToken ct)
    {
        await runtime.StartAsync(machineId, SimulationActor.From(user), startMachine: false, ct);
        return NoContent();
    }

    [Authorize(Roles = "SuperAdmin,HallAdmin")]
    [HttpPost("{machineId:guid}/stop")]
    public async Task<IActionResult> Stop(Guid machineId, CancellationToken ct)
    {
        await runtime.StopAsync(machineId, SimulationActor.From(user), stopMachine: false, ct);
        return NoContent();
    }
}
