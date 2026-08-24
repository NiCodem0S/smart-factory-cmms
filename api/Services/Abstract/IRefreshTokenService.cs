using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Services.Abstract
{
    public interface IRefreshTokenService
    {
        string GenerateRawToken();
        string HashToken(string rawToken);

        Task<RefreshToken> CreateRefreshTokenAsync(
            Guid userId, 
            string rawToken, 
            string? ipAddress, 
            string? userAgent, 
            CancellationToken ct = default);
        
        Task<(bool Success, string? NewRawToken, User? User, string? ErrorMessage)> RotateRefreshTokenAsync(
            string rawToken,
            string? ipAdress,
            string? userAgent,
            CancellationToken ct = default);

        Task<bool> RevokeRefreshTokenAsync(string rawToken, CancellationToken ct = default);
        Task<bool> RevokeAllUserTokensAsync(Guid userId, CancellationToken ct = default);
    }
}