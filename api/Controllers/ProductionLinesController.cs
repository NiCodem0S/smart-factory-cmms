using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories;
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
        public async Task<IActionResult> GetProductionLines([FromQuery] Guid? factoryHallId)
        {
            var productionLines = await _productionLinesRepo.GetProductionLinesByHallsId(factoryHallId);

            if (productionLines == null) return NotFound(new { message = $"Factory hall {factoryHallId} not found."});

            return Ok(productionLines);
        }

        [HttpGet("{id}/machines")]
        public async Task<ActionResult<List<MachineProductionLineDto>>> GetProductionLineMachines(Guid id)
        {
            var machines = await _machineRepository.GetMachinesByProductionLineId(id);
            return Ok(machines);
        }
    }
}
