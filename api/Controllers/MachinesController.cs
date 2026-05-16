using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using System.Linq;

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
        public async Task<ActionResult<Machine>> CreateMachine([FromBody] Machine machine)
        {
            machine.Id = Guid.NewGuid();
            machine.InstallationDate = DateTime.UtcNow;

            _context.Machines.Add(machine);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMachineDetails), new {id = machine.Id}, machine); //using annonymous new object because CreatedAtAction method accepts a type object   and then looks for requested data as the objects properties
        }
        [HttpPut("{id}")]
        public async Task<ActionResult<Machine>> UpdateMachine([FromRoute] Guid id,[FromBody] UpdateMachineDto dto)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null)
            {
                return NotFound($"Machine {id} was not found.");
            }

            _mapper.Map(dto, machine);
            await _context.SaveChangesAsync();

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
