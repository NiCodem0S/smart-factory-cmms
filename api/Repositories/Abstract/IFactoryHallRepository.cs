using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IFactoryHallRepository
    {
        Task<List<FactoryHallDto>> GetFactoryHallsAsync(CancellationToken ct = default);
        Task<FactoryHallDto?> GetFactoryHallByIdAsync(Guid id, CancellationToken ct = default);
    }
}