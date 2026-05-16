using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class MachineRepository : IMachineRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        public MachineRepository(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search, string? status)
        {
            IQueryable<Machine> query = _context.Machines;

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(m => m.Name.Contains(search));
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(m => m.Status == status);
            }

            int totalCount = await query.CountAsync();

            var machines = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var machineListDtos = _mapper.Map<List<MachineListDto>>(machines);

            var result = new PagedResult<MachineListDto>
            {
                Data = machineListDtos,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            };

            return result;
        }

        public async Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id)
        {
            var machine = await _context.Machines
                .Include(m => m.WorkOrders)
                .Include(m => m.TelemetryReads)
                .Include(m => m.Incidents)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (machine == null) return null;

            return _mapper.Map<MachineDetailDto>(machine);
        }

        public async Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine == null) return new List<TelemetryReadDto>();

            var telemetryReads = await _context.Set<TelemetryRead>()
                .Where(t => t.MachineId == id)
                .OrderByDescending(t => t.Timestamp)
                .Take(limit)
                .ToListAsync();

            return _mapper.Map<List<TelemetryReadDto>>(telemetryReads);
        }

        public async Task DeleteMachineAsync(Guid id)
        {
            var machine = await _context.Machines.FindAsync(id);

            if (machine != null)
            {
                machine.IsActive = false;
                await _context.SaveChangesAsync();
            }
        }
    }
}
