using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class FactoryHallRepository : IFactoryHallRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly IUserContext _userContext;

        public FactoryHallRepository(ApplicationDbContext context, IMapper mapper, IUserContext userContext)
        {
            _context = context;
            _mapper = mapper;
            _userContext = userContext;
        }

        public async Task<List<FactoryHallDto>> GetFactoryHallsAsync(CancellationToken ct = default)
        {
            IQueryable<FactoryHall> query = _context.FactoryHalls;

            if (!_userContext.IsSuperAdmin)
            {
                if (_userContext.FactoryHallId.HasValue)
                {
                    query = query.Where(h => h.Id == _userContext.FactoryHallId.Value);
                }
                else
                {
                    return new List<FactoryHallDto>();
                }
            }
            var factoryHalls = await query.ToListAsync(ct);
            return _mapper.Map<List<FactoryHallDto>>(factoryHalls);
        }
        public async Task<FactoryHallDto?> GetFactoryHallByIdAsync(Guid id, CancellationToken ct = default)
        {
            if (!_userContext.HasAccessToHall(id))
            {
                return null;
            }

            var factoryHall = await _context.FactoryHalls.FindAsync(id, ct);

            if (factoryHall == null) return null;

            return _mapper.Map<FactoryHallDto>(factoryHall);
        }
    }
}