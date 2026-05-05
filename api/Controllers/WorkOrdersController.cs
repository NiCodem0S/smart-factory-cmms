using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactory.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkOrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public WorkOrdersController(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        // GET: api/workorders
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkOrder>>> GetWorkOrders()
        {
            var workOrders = await _context.WorkOrders
                .Include(w => w.Machine)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();

            return Ok(workOrders);
        }

        // GET: api/workorders/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<WorkOrder>> GetWorkOrder(Guid id)
        {
            var workOrder = await _context.WorkOrders
                .Include(w => w.Machine)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (workOrder == null)
            {
                return NotFound(new { message = $"Work order with ID {id} was not found." });
            }

            return Ok(workOrder);
        }

        // POST: api/workorders
        [HttpPost]
        public async Task<ActionResult<WorkOrder>> CreateWorkOrder([FromBody] CreateWorkOrderDto dto)
        {
            var machineExists = await _context.Machines.AnyAsync(m => m.Id == dto.MachineId);
            if (!machineExists)
            {
                return BadRequest(new { message = $"Machine with ID {dto.MachineId} does not exist." });
            }

            var workOrder = _mapper.Map<WorkOrder>(dto);
            workOrder.Id = Guid.NewGuid();
            workOrder.CreatedAt = DateTime.UtcNow;
            workOrder.Status = "To Do";

            _context.WorkOrders.Add(workOrder);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, workOrder);
        }

        // PUT: api/workorders/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWorkOrder(Guid id, [FromBody] UpdateWorkOrderDto dto)
        {
            var workOrder = await _context.WorkOrders.FindAsync(id);

            if (workOrder == null)
            {
                return NotFound(new { message = $"Work order with ID {id} was not found." });
            }
            _mapper.Map(dto, workOrder);

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/workorders/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkOrder(Guid id)
        {
            var workOrder = await _context.WorkOrders.FindAsync(id);
            if (workOrder == null)
            {
                return NotFound(new { message = $"Work order with ID {id} was not found." });
            }

            _context.WorkOrders.Remove(workOrder);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}