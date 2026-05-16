using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IMachineRepository
    {
        Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search, string? status);
        Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id);
        Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit);
        Task DeleteMachineAsync(Guid id);
    }
}
