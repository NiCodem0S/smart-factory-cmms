using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using System.Linq;
using SmartFactoryCMMS.Api.Filters;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MachinesController : ControllerBase
    {
        private readonly IMachineRepository _machineRepository;
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public MachinesController(IMachineRepository machineRepository, ApplicationDbContext context, IMapper mapper)
        {
            _machineRepository = machineRepository;
            _context = context;
            _mapper = mapper;
        }

        [HttpGet]
        [PagingValidation]
        public async Task<ActionResult<PagedResult<MachineListDto>>> GetMachines(
            [FromQuery] int page = 1, 
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null)
        {
            var result = await _machineRepository.GetMachinesAsync(page, pageSize, search, status);
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
            var normalizedStatus = string.IsNullOrWhiteSpace(dto.Status)
                ? "Offline"
                : dto.Status.Trim();

            var machine = _mapper.Map<Machine>(dto);

            machine.Id = Guid.NewGuid();
            machine.InstallationDate = DateTime.UtcNow;

            machine.Status = normalizedStatus;
            machine.IsActive = true;

            _context.Machines.Add(machine);
            await _context.SaveChangesAsync();

            var machineDetailDto = _mapper.Map<MachineDetailDto>(machine);
            return CreatedAtAction(nameof(GetMachineDetails), new { id = machine.Id }, machineDetailDto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMachine([FromRoute] Guid id, [FromBody] UpdateMachineDto dto)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} was not found." });
            }

            _mapper.Map(dto, machine);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                var machineExists = await _context.Machines.AnyAsync(m => m.Id == id);

                if (!machineExists)
                {
                    return NotFound(new { message = $"Machine {id} was not found." });
                }

                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteMachine(Guid id)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} not found" });
            }

            await _machineRepository.DeleteMachineAsync(id);
            return NoContent();
        }

        [HttpGet("{id}/telemetry")]
        [PagingValidation(LimitArgumentName = "limit", MaxLimit = 1000)]
        public async Task<ActionResult<List<TelemetryReadDto>>> GetMachineTelemetry(
            Guid id,
            [FromQuery] int limit = 10)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = $"Machine {id} not found" });
            }

            var telemetryReads = await _machineRepository.GetMachineTelemetryAsync(id, limit);
            return Ok(telemetryReads);
        }
    }
}
