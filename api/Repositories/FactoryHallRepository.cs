using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class FactoryHallRepository : IFactoryHallRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public FactoryHallRepository(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<List<FactoryHallDto>> GetFactoryHallsAsync(CancellationToken ct = default)
        {
            var factoryHalls = await _context.FactoryHalls.ToListAsync(ct);
            return _mapper.Map<List<FactoryHallDto>>(factoryHalls);
        }
        public async Task<FactoryHallDto?> GetFactoryHallByIdAsync(Guid id, CancellationToken ct = default)
        {
            var factoryHall = await _context.FactoryHalls.FindAsync(id, ct);

            if (factoryHall == null) return null;

            return _mapper.Map<FactoryHallDto>(factoryHall);
        }
    }
}