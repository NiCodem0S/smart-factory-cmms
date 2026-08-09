using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IMachineRepository
    {
        Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search, MachineStatus? status);
        Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id);
        Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit);
        Task DeleteMachineAsync(Guid id);
        Task<Machine> CreateMachineAsync(Machine machine);
    }
}
