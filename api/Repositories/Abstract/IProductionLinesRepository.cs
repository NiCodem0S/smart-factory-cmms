using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IProductionLinesRepository
    {
        Task<List<ProductionLineDto>?> GetProductionLinesByHallsId(Guid? hallsId, CancellationToken ct = default);
    }
}