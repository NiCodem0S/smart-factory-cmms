using Microsoft.AspNetCore.Mvc;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductionLinesController : ControllerBase
    {
        private readonly IProductionLinesRepository _productionLinesRepo;
        private readonly IMachineRepository _machineRepository;

        public ProductionLinesController(IProductionLinesRepository productionLinesRepo, IMachineRepository machineRepository)
        {
            _productionLinesRepo = productionLinesRepo;
            _machineRepository = machineRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetProductionLines([FromQuery] Guid? factoryHallId, CancellationToken ct = default)
        {
            var productionLines = await _productionLinesRepo.GetProductionLinesByHallsId(factoryHallId, ct);

            if (productionLines == null) return NotFound(new { message = $"Factory hall {factoryHallId} not found." });

            return Ok(productionLines);
        }

        [HttpGet("{id}/machines")]
        public async Task<ActionResult<List<MachineProductionLineDto>>> GetProductionLineMachines(Guid id, CancellationToken ct = default)
        {
            var machines = await _machineRepository.GetMachinesByProductionLineId(id, ct);
            return Ok(machines);
        }

        [HttpPost("{id}/halt")]
        public async Task<IActionResult> StopProductionLine(Guid id, CancellationToken ct = default)
        {
            var stopped = await _productionLinesRepo.StopProductionLineAsync(id, ct);
            if (!stopped) return NotFound(new { message = $"Production line {id} not found." });

            return Ok(new { message = "Production line halted successfully." });
        }

        [HttpPost("{id}/start")]
        public async Task<IActionResult> StartProductionLine(Guid id, CancellationToken ct = default)
        {
            var result = await _productionLinesRepo.StartProductionLineAsync(id, ct);

            if (!result.Success)
            {
                if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { message = result.Message });
                }

                return BadRequest(new { message = result.Message });
            }

            return Ok(new { message = result.Message, line = result.Line });
        }
    }
}
