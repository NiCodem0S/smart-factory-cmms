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

namespace SmartFactoryCMMS.Api.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class MachinesController : ControllerBase
    {
        private readonly IMachineRepository _machineRepository;
        private readonly IMapper _mapper;

        public MachinesController(IMachineRepository machineRepository, IMapper mapper)
        {
            _machineRepository = machineRepository;
            _mapper = mapper;
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

        [HttpPost]
        public async Task<ActionResult<MachineDetailDto>> CreateMachine([FromBody] CreateMachineDto dto)
        {
            var machine = _mapper.Map<Machine>(dto);     
            var createdMachine = await _machineRepository.CreateMachineAsync(machine);       
            var machineDetailDto = _mapper.Map<MachineDetailDto>(createdMachine);
            
            return CreatedAtAction(nameof(GetMachineDetails), new { id = machine.Id }, machineDetailDto);
        }

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
