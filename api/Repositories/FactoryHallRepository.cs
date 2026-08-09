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

        public async Task<List<FactoryHallDto>> GetFactoryHallsAsync()
        {
            var factoryHalls = await _context.FactoryHalls.ToListAsync();
            return _mapper.Map<List<FactoryHallDto>>(factoryHalls);
        }
        public async Task<FactoryHallDto?> GetFactoryHallByIdAsync(Guid id)
        {
            var factoryHall = await _context.FactoryHalls.FirstOrDefaultAsync(f => f.Id == id);

            if (factoryHall == null) return null;

            return _mapper.Map<FactoryHallDto>(factoryHall);
        }
    }
}