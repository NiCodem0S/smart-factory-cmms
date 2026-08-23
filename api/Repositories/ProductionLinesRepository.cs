using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Repositories;
using SmartFactoryCMMS.Api.Helpers;
using SmartFactoryCMMS.Api.Helpers.Enums;
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

            if (hallsId.HasValue)
            {
                var hall = await _factoryHallsRepo.GetFactoryHallByIdAsync(hallsId.Value, ct);
                if (hall == null) return null;

                query = query.Where(p => p.FactoryHallId == hallsId);
            }

            var productionLines = await query
                .OrderBy(p => p.OrderInHall.HasValue ? p.OrderInHall.Value : int.MaxValue)
                .ThenBy(p => p.Name)
                .ProjectTo<ProductionLineDto>(_mapper.ConfigurationProvider)
                .ToListAsync(ct);

            return productionLines;
        }

        public async Task<ProductionLineDto> CreateProductionLineAsync(CreateProductionLineDto dto, CancellationToken ct = default)
        {
            var hall = await _factoryHallsRepo.GetFactoryHallByIdAsync(dto.FactoryHallId, ct);
            if (hall == null)
            {
                throw new KeyNotFoundException($"Factory hall with ID {dto.FactoryHallId} does not exist.");
            }

            var line = _mapper.Map<ProductionLine>(dto);
            line.Id = Guid.NewGuid();

            _context.ProductionLines.Add(line);
            await _context.SaveChangesAsync(ct);

            return _mapper.Map<ProductionLineDto>(line);
        }

        public async Task<bool> StopProductionLineAsync(Guid id, CancellationToken ct = default)
        {
            var line = await _context.ProductionLines
                .Include(p => p.Machines)
                .FirstOrDefaultAsync(p => p.Id == id, ct);

            if (line == null) return false;

            var now = DateTime.UtcNow;
            line.Status = "Halted";

            foreach (var machine in line.Machines)
            {
                if (machine.Status == MachineStatus.Running || machine.Status == MachineStatus.Warning)
                {
                    machine.Status = MachineStatus.Offline;
                }
            }

            await _context.SaveChangesAsync(ct);
            return true;
        }

        public async Task<(bool Success, string Message, ProductionLineDto? Line)> StartProductionLineAsync(Guid id, CancellationToken ct = default)
        {
            var line = await _context.ProductionLines
                .Include(p => p.Machines)
                .FirstOrDefaultAsync(p => p.Id == id, ct);

            if (line == null)
            {
                return (false, $"Production line {id} not found.", null);
            }

            if (!line.Machines.Any())
            {
                return (false, $"No machines assigned to production line '{line.Name}'.", null);
            }

            var faultedMachine = line.Machines.FirstOrDefault(m => m.Status == MachineStatus.Error || m.Status == MachineStatus.Maintenance);
            if (faultedMachine != null)
            {
                return (false, $"Cannot start production line: Machine '{faultedMachine.Name}' is in {faultedMachine.Status} state. Resolve the machine issue first.", null);
            }

            var now = DateTime.UtcNow;
            line.Status = "Running";

            foreach (var machine in line.Machines)
            {
                if (machine.Status == MachineStatus.Offline)
                {
                    machine.Status = MachineStatus.Running;
                }
            }

            await _context.SaveChangesAsync(ct);

            var dto = _mapper.Map<ProductionLineDto>(line);
            return (true, $"Production line '{line.Name}' started successfully.", dto);
        }
    }
}