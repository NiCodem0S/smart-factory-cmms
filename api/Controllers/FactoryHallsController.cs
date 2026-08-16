using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FactoryHallsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IFactoryHallRepository _hallsRepository;

        public FactoryHallsController(IFactoryHallRepository hallsRepository, ApplicationDbContext context)
        {
            _context = context;
            _hallsRepository = hallsRepository;
        }

        [HttpGet]
        public async Task<ActionResult<List<FactoryHallDto>>> GetFactoryHalls(CancellationToken ct = default)
        {
            var result = await _hallsRepository.GetFactoryHallsAsync(ct);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<FactoryHallDto>> GetFactoryHallById(Guid id, CancellationToken ct = default)
        {
            var factoryHallDto = await _hallsRepository.GetFactoryHallByIdAsync(id);

            if(factoryHallDto == null)
            {
                return NotFound(new { message = $"Factory Hall: {id} not found" });
            }

            return Ok(factoryHallDto);
        }
    }
}
