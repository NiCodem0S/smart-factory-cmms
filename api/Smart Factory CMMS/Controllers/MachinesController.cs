using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Smart_Factory_CMMS.Data;
using Smart_Factory_CMMS.Models;

namespace Smart_Factory_CMMS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MachinesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public MachinesController(ApplicationDbContext context)
        {
            _context = context;
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
      /*  [HttpPut("{id}")]
        public async Task<ActionResult<Machine>> UpdateMachine([FromRoute] Guid id,[FromBody] Machine machine)
        {
            if (id != machine.Id)
            {
                return BadRequest("Error: Body/Route ID mismatch");
            }

       } */ 
    }
}
