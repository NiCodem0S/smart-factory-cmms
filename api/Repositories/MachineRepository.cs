using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class MachineRepository : IMachineRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly IUserContext _userContext;

        private IQueryable<Machine> ActiveMachines => _context.Machines.Where(m => m.IsActive);

        public MachineRepository(ApplicationDbContext context, IMapper mapper, IUserContext userContext)
        {
            _context = context;
            _mapper = mapper;
            _userContext = userContext;
        }

        public async Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search, MachineStatus? status, Guid? selectedHallId, CancellationToken ct = default)
        {
            if (!_userContext.IsSuperAdmin)
            {
                selectedHallId = _userContext.FactoryHallId;
            }

            IQueryable<Machine> query = ActiveMachines;

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(m => m.Name.Contains(search));
            }

            if (selectedHallId.HasValue)
            {
                query = query.Where(m => m.FactoryHallId == selectedHallId);
            }

            if (status.HasValue)
            {
                query = query.Where(m => m.Status == status.Value);
            }

            int totalCount = await query.CountAsync(ct);
            
            var machineListDtos = await query
                .OrderBy(m => m.Id)
                .Skip((page -1) * pageSize)
                .Take(pageSize)
                .ProjectTo<MachineListDto>(_mapper.ConfigurationProvider)
                .ToListAsync(ct);

            var result = new PagedResult<MachineListDto>
            {
                Data = machineListDtos,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            };

            return result;
        }

        public async Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id, CancellationToken ct = default)
        {
            var machine = await ActiveMachines
                .ProjectTo<MachineDetailDto>(_mapper.ConfigurationProvider)
                .FirstOrDefaultAsync(m => m.Id == id, ct);

            if (machine != null && !_userContext.HasAccessToHall(machine.FactoryHallId))
            {
                return null;
            }

            if (machine == null) return null;

            return machine;
        }

        public async Task<List<MachineProductionLineDto>> GetMachinesByProductionLineId(Guid id, CancellationToken ct = default)
        {
            var machines = await ActiveMachines
                .Where(m => m.ProductionLineId == id)
                .OrderBy(m => m.OrderInLine)
                .ProjectTo<MachineProductionLineDto>(_mapper.ConfigurationProvider)
                .ToListAsync(ct);
            
            return machines;
        }

        public async Task<bool> UpdateMachineTresholds(List<CreateAlertThresholdDto> alertThresholdDtos, Guid machineId, CancellationToken ct = default)
        {
            var machineExists = await _context.Machines.AnyAsync(m => m.Id == machineId && m.IsActive, ct);
            if (!machineExists) return false;

            var existingTresholds = await _context.AlertThresholds.Where(a => a.MachineId == machineId).ToListAsync(ct);
            
            foreach(var dto in alertThresholdDtos)
            {
                var existing = existingTresholds.FirstOrDefault(t => t.MetricType == dto.MetricType);
                if(existing != null)
                {
                    existing.WarningValue = dto.WarningValue;
                    existing.CriticalValue = dto.CriticalValue;
                }
                else
                {
                    _context.AlertThresholds.Add(new AlertThreshold
                    {
                        MachineId = machineId,
                        MetricType = dto.MetricType,
                        WarningValue = dto.WarningValue,
                        CriticalValue = dto.CriticalValue
                    });
                }
            }

            await _context.SaveChangesAsync(ct);
            return true;

        }

        public async Task<Machine?> FindMachineByIdAsync(Guid id, CancellationToken ct = default)
        {
            var machine = await _context.Machines.FindAsync(id, ct);

            if (machine == null) return null;

            return machine;
        }

        public async Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit, CancellationToken ct = default)
        {
            var machine = await ActiveMachines.FirstOrDefaultAsync(m => m.Id == id, ct);

            if (machine == null) return new List<TelemetryReadDto>();

            var telemetryReads = _context.Set<TelemetryRead>()
                .Where(t => t.MachineId == id)
                .OrderByDescending(t => t.Timestamp)
                .Take(limit);

            //    return _mapper.Map<List<TelemetryReadDto>>(telemetryReads);
            return await telemetryReads.ProjectTo<TelemetryReadDto>(_mapper.ConfigurationProvider).ToListAsync(ct);
        }

        public async Task<Machine> CreateMachineAsync(Machine machine)
        {
            _context.Machines.Add(machine);
            await _context.SaveChangesAsync();

            return machine;
        }

        public async Task<Machine?> UpdateMachineAsync(Guid id, UpdateMachineDto dto)
        {
            var machine = await _context.Machines
                .Include(m => m.AlertThresholds)
                .FirstOrDefaultAsync(m => m.IsActive && m.Id == id);

            if (machine == null) return null;

            _mapper.Map(dto, machine);

            foreach (var thresholdDto in dto.AlertThresholds)
            {
                var existing = machine.AlertThresholds.FirstOrDefault(t => t.MetricType == thresholdDto.MetricType);
                if (existing != null)
                {
                    existing.WarningValue = thresholdDto.WarningValue;
                    existing.CriticalValue = thresholdDto.CriticalValue;
                }
                else
                {
                    machine.AlertThresholds.Add(new AlertThreshold
                    {
                        MetricType = thresholdDto.MetricType,
                        WarningValue = thresholdDto.WarningValue,
                        CriticalValue = thresholdDto.CriticalValue,
                        MachineId = machine.Id
                    });
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return null;
            }

            return machine;

        }

        public async Task<Machine?> DeleteMachineAsync(Guid id)
        {
            var machine = await _context.Machines.FirstOrDefaultAsync(m => m.IsActive && m.Id == id);

            if (machine == null) return null;

            machine.IsActive = false;
            await _context.SaveChangesAsync();

            return machine;
            
        }
    }
}
