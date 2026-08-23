using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Repositories.Abstract
{
    public interface IUserRepository
    {
        Task<User?> GetUserByEmailAsync(string email, CancellationToken ct = default);
        Task<UserDto?> GetUserProfileAsync(Guid id, CancellationToken ct = default);
        Task<List<UserDto>> GetUsersAsync(UserRole? role = null, Guid? hallId = null, CancellationToken ct = default);
        Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
        Task<User> CreateUserAsync(User user, CancellationToken ct = default);
    }
}
