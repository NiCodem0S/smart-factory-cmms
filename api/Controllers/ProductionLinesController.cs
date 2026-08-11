using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductionLinesController : ControllerBase
    {
        private readonly IProductionLinesRepository _productionLinesRepo;

        public ProductionLinesController(IProductionLinesRepository productionLinesRepo)
        {
            _productionLinesRepo = productionLinesRepo;
        }

        [HttpGet]
        public async Task<IActionResult> GetProductionLines([FromQuery] Guid? factoryHallId)
        {
            var productionLines = await _productionLinesRepo.GetProductionLinesByHallsId(factoryHallId);

            if (productionLines == null) return NotFound(new { message = $"Factory hall {factoryHallId} not found."});

            return Ok(productionLines);
        }
    }
}
