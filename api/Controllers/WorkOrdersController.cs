using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkOrdersController : ControllerBase
    {
        private readonly IWorkOrderRepository _workOrderRepository;

        public WorkOrdersController(IWorkOrderRepository workOrderRepository)
        {
            _workOrderRepository = workOrderRepository;
        }

        // GET: api/workorders
        [HttpGet]
        public async Task<ActionResult<PagedResult<WorkOrderListDto>>> GetWorkOrders(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? type = null)
        {
            var result = await _workOrderRepository.GetWorkOrdersAsync(page, pageSize, status, type);
            return Ok(result);
        }

        // GET: api/workorders/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<WorkOrderDetailDto>> GetWorkOrder(Guid id)
        {
            var workOrder = await _workOrderRepository.GetWorkOrderDetailsAsync(id);

            if (workOrder == null)
            {
                return NotFound(new { message = $"Work order with ID {id} was not found." });
            }

            return Ok(workOrder);
        }

        // POST: api/workorders
        [HttpPost]
        public async Task<ActionResult<WorkOrderDetailDto>> CreateWorkOrder([FromBody] CreateWorkOrderDto dto)
        {
            try
            {
                var createdWorkOrder = await _workOrderRepository.CreateWorkOrderAsync(dto);
                return CreatedAtAction(nameof(GetWorkOrder), new { id = createdWorkOrder.Id }, createdWorkOrder);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // PUT: api/workorders/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWorkOrder(Guid id, [FromBody] UpdateWorkOrderDto dto)
        {
            try
            {
                await _workOrderRepository.UpdateWorkOrderAsync(id, dto);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        // DELETE: api/workorders/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkOrder(Guid id)
        {
            try
            {
                await _workOrderRepository.DeleteWorkOrderAsync(id);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }
    }
}