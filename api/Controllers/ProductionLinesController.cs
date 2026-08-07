using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductionLinesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProductionLinesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetProductionLines([FromQuery] Guid? factoryHallId)
        {
            var query = _context.ProductionLines.AsQueryable();

            if (factoryHallId.HasValue)
            {
                query = query.Where(pl => pl.FactoryHallId == factoryHallId);
            }

            var lines = await query
                .Select(pl => new { pl.Id, pl.Name, pl.Status, pl.FactoryHallId })
                .ToListAsync();

            return Ok(lines);
        }
    }
}
