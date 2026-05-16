using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;

namespace SmartFactoryCMMS.Api.Repositories
{
    public class WorkOrderRepository : IWorkOrderRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public WorkOrderRepository(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<PagedResult<WorkOrderListDto>> GetWorkOrdersAsync(int page, int pageSize, string? status = null, string? type = null)
        {
            IQueryable<WorkOrder> query = _context.WorkOrders.Include(w => w.Machine);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(w => w.Status == status);
            }

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(w => w.Type == type);
            }

            int totalCount = await query.CountAsync();

            var workOrders = await query
                .OrderByDescending(w => w.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var workOrderListDtos = _mapper.Map<List<WorkOrderListDto>>(workOrders);

            var result = new PagedResult<WorkOrderListDto>
            {
                Data = workOrderListDtos,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            };

            return result;
        }

        public async Task<WorkOrderDetailDto?> GetWorkOrderDetailsAsync(Guid id)
        {
            var workOrder = await _context.WorkOrders
                .Include(w => w.Machine)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (workOrder == null) return null;

            return _mapper.Map<WorkOrderDetailDto>(workOrder);
        }

        public async Task<WorkOrderDetailDto> CreateWorkOrderAsync(CreateWorkOrderDto dto)
        {
            var machineExists = await _context.Machines.AnyAsync(m => m.Id == dto.MachineId);
            if (!machineExists)
            {
                throw new InvalidOperationException($"Machine with ID {dto.MachineId} does not exist.");
            }

            var workOrder = _mapper.Map<WorkOrder>(dto);
            workOrder.Id = Guid.NewGuid();
            workOrder.CreatedAt = DateTime.UtcNow;
            workOrder.Status = "To Do";

            _context.WorkOrders.Add(workOrder);
            await _context.SaveChangesAsync();

            var machine = await _context.Machines.FindAsync(dto.MachineId);
            workOrder.Machine = machine;

            return _mapper.Map<WorkOrderDetailDto>(workOrder);
        }

        public async Task UpdateWorkOrderAsync(Guid id, UpdateWorkOrderDto dto)
        {
            var workOrder = await _context.WorkOrders.FindAsync(id);

            if (workOrder == null)
            {
                throw new InvalidOperationException($"Work order with ID {id} was not found.");
            }

            _mapper.Map(dto, workOrder);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteWorkOrderAsync(Guid id)
        {
            var workOrder = await _context.WorkOrders.FindAsync(id);

            if (workOrder == null)
            {
                throw new InvalidOperationException($"Work order with ID {id} was not found.");
            }

            _context.WorkOrders.Remove(workOrder);
            await _context.SaveChangesAsync();
        }
    }
}
