using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IProductionLinesRepository
    {
        Task<List<ProductionLineDto>?> GetProductionLinesByHallsId(Guid? hallsId, CancellationToken ct = default);
        Task<bool> StopProductionLineAsync(Guid id, CancellationToken ct = default);
        Task<(bool Success, string Message, ProductionLineDto? Line)> StartProductionLineAsync(Guid id, CancellationToken ct = default);
    }
}