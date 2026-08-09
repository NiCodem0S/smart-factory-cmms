using SmartFactoryCMMS.Api.DTOs;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IFactoryHallRepository
    {
        Task<List<FactoryHallDto>> GetFactoryHallsAsync();
        Task<FactoryHallDto?> GetFactoryHallByIdAsync(Guid id);
    }
}