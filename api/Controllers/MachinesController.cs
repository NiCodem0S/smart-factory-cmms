using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MachinesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public MachinesController(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Machine>>> GetMachines()
        {
            var machines = await _context.Machines.ToListAsync();
            return Ok(machines);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Machine>> GetMachineById(Guid id)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null)
            {
                return NotFound();
            }
            return Ok(machine);
        }

        [HttpPost]
        public async Task<ActionResult<Machine>> CreateMachine([FromBody] Machine machine)
        {
            machine.Id = Guid.NewGuid();
            machine.InstallationDate = DateTime.UtcNow;

            _context.Machines.Add(machine);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMachineById), new {id = machine.Id}, machine); //using annonymous new object because CreatedAtAction method accepts a type object   and then looks for requested data as the objects properties
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
    }
}
