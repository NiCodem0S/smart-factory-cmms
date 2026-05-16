using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IWorkOrderRepository
    {
        Task<PagedResult<WorkOrderListDto>> GetWorkOrdersAsync(int page, int pageSize, string? status = null, string? type = null);
        Task<WorkOrderDetailDto?> GetWorkOrderDetailsAsync(Guid id);
        Task<WorkOrderDetailDto> CreateWorkOrderAsync(CreateWorkOrderDto dto);
        Task UpdateWorkOrderAsync(Guid id, UpdateWorkOrderDto dto);
        Task DeleteWorkOrderAsync(Guid id);
    }
}
