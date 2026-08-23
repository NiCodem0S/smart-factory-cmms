using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IMachineRepository
    {
        Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search, MachineStatus? status, Guid? selectedHallId, CancellationToken ct = default);
        Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id, CancellationToken ct = default);
        Task<List<MachineProductionLineDto>> GetMachinesByProductionLineId(Guid id, CancellationToken ct = default);
        Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit, CancellationToken ct = default);
        Task<bool> UpdateMachineTresholds(List<CreateAlertThresholdDto> alertThresholds, Guid machineId ,CancellationToken ct = default);
        Task<Machine> CreateMachineAsync(Machine machine);
        Task<Machine?> FindMachineByIdAsync(Guid id, CancellationToken ct = default);
        Task<Machine?> UpdateMachineAsync(Guid id, UpdateMachineDto dto);
        Task<Machine?> DeleteMachineAsync(Guid id);
    }
}
