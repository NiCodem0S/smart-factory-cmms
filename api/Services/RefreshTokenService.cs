using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services.Abstract;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;


namespace SmartFactoryCMMS.Api.Services
{
    public class RefreshTokenService : IRefreshTokenService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<RefreshTokenService> _logger;
        private readonly IConfiguration _config;
        public RefreshTokenService(ApplicationDbContext context, ILogger<RefreshTokenService> logger, IConfiguration config)
        {
            _context = context;
            _logger = logger;
            _config = config;
        }
        public string GenerateRawToken()
        {
            var randomBytes = RandomNumberGenerator.GetBytes(64);
            return Convert.ToBase64String(randomBytes)
                .Replace("+", "-").Replace("/", "_").Replace("=", "");
        }
        public string HashToken(string rawToken)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }
        public async Task<RefreshToken> CreateRefreshTokenAsync(
            Guid userId,
            string rawToken,
            string? ipAddress,
            string? userAgent,
            CancellationToken ct = default)
        {
            if (!int.TryParse(_config["Jwt:RefreshTokenExpiryInDays"], out var expiryDays) || expiryDays <= 0)
            {
                throw new InvalidOperationException("Configuration error: 'Jwt:RefreshTokenExpiryInDays' is missing or invalid in appsettings.json.");
            }

            var tokenHash = HashToken(rawToken);
            var refreshToken = new RefreshToken
            {
                UserId = userId,
                TokenHash = tokenHash,
                ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
                CreatedByIp = ipAddress,
                UserAgent = userAgent
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync(ct);

            return refreshToken;
        }
        public async Task<(bool Success, string? NewRawToken, User? User, string? ErrorMessage)> RotateRefreshTokenAsync(
            string rawToken,
            string? ipAddress,
            string? userAgent,
            CancellationToken ct = default)
        {
            var tokenHash = HashToken(rawToken);

            var existingToken = await _context.RefreshTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

            if(existingToken == null)
            {
                return (false, null, null, "Invalid refresh token");
            }

            if(existingToken.IsRevoked)
            {
                await RevokeAllUserTokensAsync(existingToken.UserId, ct);
                _logger.LogWarning("Security Alert: Refresh token reuse detected for user {UserId}! Revoking all sessions.", existingToken.UserId);

                return (false, null, null, "Refresh token was already used. All sessions have been revoked.");
            }

            if (existingToken.IsExpired)
            {
                return (false, null, null, "Refresh token has expired.");
            }
            if (!existingToken.User.IsActive)
            {
                return (false, null, null, "User account is inactive.");
            }

            var newRawToken = GenerateRawToken();
            var newRefreshToken = await CreateRefreshTokenAsync(existingToken.UserId, newRawToken, ipAddress, userAgent, ct);

            existingToken.RevokedAt = DateTime.UtcNow;
            existingToken.ReplacedByTokenId = newRefreshToken.Id;
            await _context.SaveChangesAsync(ct);
            return (true, newRawToken, existingToken.User, null);
        }

        public async Task<bool> RevokeAllUserTokensAsync(Guid userId, CancellationToken ct = default)
        {
            try
            {
                await _context.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(t => t.RevokedAt, DateTime.UtcNow), ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Error durning revoking user: {userId} refresh tokens ex: {ex}", userId, ex);
                return false;
            }

            return true;
        }

        public async Task<bool> RevokeRefreshTokenAsync(string rawToken, CancellationToken ct = default)
        {
            var tokenHash = HashToken(rawToken);

            var existingToken = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

            if(existingToken == null)
            {
                _logger.LogWarning("Revocation failed - refresh token not found in database.");
                return false;
            }

            existingToken.RevokedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(ct);

            return true;
        }
    }
}