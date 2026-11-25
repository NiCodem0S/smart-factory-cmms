using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Filters;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using System.Linq;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class MachinesController : ControllerBase
    {
        private readonly IMachineRepository _machineRepository;
        private readonly IMapper _mapper;
        private readonly SimulationOrchestrator _simulation;
        private readonly IUserContext _user;

        public MachinesController(IMachineRepository machineRepository, IMapper mapper, SimulationOrchestrator simulation, IUserContext user)
        {
            _machineRepository = machineRepository;
            _mapper = mapper;
            _simulation = simulation;
            _user = user;
        }

        [HttpGet]
        [PagingValidation]
        public async Task<ActionResult<PagedResult<MachineListDto>>> GetMachines(
            [FromQuery] int page = 1, 
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] MachineStatus? status = null,
            [FromQuery] Guid? selectedHallId = null,
            CancellationToken ct = default)
        {
            var result = await _machineRepository.GetMachinesAsync(page, pageSize, search, status, selectedHallId, ct);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<MachineDetailDto>> GetMachineDetails(Guid id)
        {
            var machineDetailDto = await _machineRepository.GetMachineDetailsAsync(id);

            if (machineDetailDto == null)
            {
                return NotFound(new { message = $"Machine {id} not found" });
            }

            return Ok(machineDetailDto);
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost]
        public async Task<ActionResult<MachineDetailDto>> CreateMachine([FromBody] CreateMachineDto dto)
        {
            var machine = _mapper.Map<Machine>(dto);
            string? rawDeviceKey = null;
            if (machine.TelemetrySource == TelemetrySource.RealDevice)
            {
                var (raw, hash, prefix) = DeviceKeyService.Generate();
                rawDeviceKey = raw;
                machine.DeviceKeyHash = hash;
                machine.DeviceKeyPrefix = prefix;
            }

            var createdMachine = await _machineRepository.CreateMachineAsync(machine);
            var machineDetailDto = _mapper.Map<MachineDetailDto>(createdMachine);
            machineDetailDto.DeviceKey = rawDeviceKey;

            return CreatedAtAction(nameof(GetMachineDetails), new { id = machine.Id }, machineDetailDto);
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost("{id:guid}/device-key/rotate")]
        public async Task<ActionResult<DeviceKeyResponseDto>> RotateDeviceKey(Guid id, CancellationToken ct)
        {
            var (rawKey, prefix) = await _simulation.RotateDeviceKeyAsync(id, SimulationActor.From(_user), ct);
            return Ok(new DeviceKeyResponseDto(id, rawKey, prefix, "/api/telemetry/ingest"));
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMachine([FromRoute] Guid id, [FromBody] UpdateMachineDto dto)
        {
            var machine = await _machineRepository.UpdateMachineAsync(id, dto);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} was not found." });
            }

            return NoContent();
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPut("{id}/tresholds")]
        public async Task<IActionResult> UpdateMachineTresholds(
            [FromRoute] Guid id,
            [FromBody] List<CreateAlertThresholdDto> dtos,
            CancellationToken ct = default)
        {
            var success = await _machineRepository.UpdateMachineTresholds(dtos, id, ct);
            if (!success) return NotFound(new { message = $"Machine {id} not found." });

            return NoContent();
        }
        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteMachine(Guid id)
        {
            var machine = await _machineRepository.DeleteMachineAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} not found" });
            }
            
            return NoContent();
        }
        
        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost("{id}/start")]
        public async Task<IActionResult> StartMachine(Guid id, CancellationToken ct)
        {
            await _simulation.StartAsync(id, SimulationActor.From(_user), startMachine: true, ct);
            return NoContent();
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost("{id}/stop")]
        public async Task<IActionResult> StopMachine(Guid id, CancellationToken ct)
        {
            await _simulation.StopAsync(id, SimulationActor.From(_user), stopMachine: true, ct);
            return NoContent();
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost("{id}/maintenance")]
        public async Task<IActionResult> Maintenance(Guid id, CancellationToken ct)
        {
            await _simulation.MaintenanceAsync(id, SimulationActor.From(_user), complete: false, ct);
            return NoContent();
        }

        [Authorize(Roles = "SuperAdmin,HallAdmin")]
        [HttpPost("{id}/repair")]
        public async Task<IActionResult> Repair(Guid id, CancellationToken ct)
        {
            await _simulation.MaintenanceAsync(id, SimulationActor.From(_user), complete: true, ct);
            return NoContent();
        }

        [HttpGet("{id}/telemetry/series")]
        public async Task<ActionResult<TelemetrySeriesDto>> GetMachineTelemetrySeries(Guid id,
            [FromQuery] int windowMinutes = 1, CancellationToken ct = default)
        {
            return Ok(await _machineRepository.GetMachineTelemetrySeriesAsync(id, windowMinutes, ct));
        }

        [HttpGet("{id}/telemetry")]
        [PagingValidation(LimitArgumentName = "limit", MaxLimit = 1000)]
        public async Task<ActionResult<List<TelemetryReadDto>>> GetMachineTelemetry(
            Guid id,
            [FromQuery] int limit = 10)
        {
            var machine = await _machineRepository.FindMachineByIdAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} not found" });
            }

            var telemetryReads = await _machineRepository.GetMachineTelemetryAsync(id, limit);
            return Ok(telemetryReads);
        }

    }
}
