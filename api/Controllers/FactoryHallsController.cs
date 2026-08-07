using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FactoryHallsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FactoryHallsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetFactoryHalls()
        {
            var halls = await _context.FactoryHalls
                .Select(h => new { h.Id, h.Name })
                .ToListAsync();

            return Ok(halls);
        }
    }
}
