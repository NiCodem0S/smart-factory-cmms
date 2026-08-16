using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Data;
using AutoMapper.QueryableExtensions;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class ProductionLinesRepository : IProductionLinesRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly IFactoryHallRepository _factoryHallsRepo;

        public ProductionLinesRepository(ApplicationDbContext context, IMapper mapper, IFactoryHallRepository factoryHallsRepo)
        {
            _context = context;
            _mapper = mapper;
            _factoryHallsRepo = factoryHallsRepo;
        }

        public async Task<List<ProductionLineDto>?> GetProductionLinesByHallsId(Guid? hallsId, CancellationToken ct = default)
        {
            IQueryable<ProductionLine> query = _context.ProductionLines;

            if(hallsId.HasValue)
            {
                var hall = await _factoryHallsRepo.GetFactoryHallByIdAsync(hallsId.Value, ct);
                if(hall == null) return null;

                query = query.Where(p => p.FactoryHallId == hallsId);
            }

            var productionLines = await query
                .ProjectTo<ProductionLineDto>(_mapper.ConfigurationProvider)
                .ToListAsync(ct);

            return productionLines;
            
        }
    }
}