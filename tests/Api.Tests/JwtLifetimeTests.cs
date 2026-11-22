using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Services;
using Xunit;

namespace SmartFactoryCMMS.Api.Tests;
public sealed class JwtLifetimeTests
{
    [Theory]
    [InlineData("2", 120)]
    [InlineData("10", 600)]
    public void AccessTokenUsesConfiguredMinutes(string minutes, int expectedSeconds)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Jwt:SecretKey"] = "a-local-test-key-that-is-at-least-32-bytes-long",
            ["Jwt:Issuer"] = "Tests", ["Jwt:Audience"] = "Tests", ["Jwt:AccessTokenExpiryInMinutes"] = minutes
        }).Build();
        var issued = DateTime.UtcNow;
        var token = new JwtTokenService(config).GenerateToken(new User { Role = UserRole.SuperAdmin });
        using var payload = JsonDocument.Parse(Base64UrlEncoder.DecodeBytes(token.Split('.')[1]));
        var validTo = DateTimeOffset.FromUnixTimeSeconds(payload.RootElement.GetProperty("exp").GetInt64());
        Assert.InRange((validTo.UtcDateTime - issued).TotalSeconds, expectedSeconds - 2, expectedSeconds + 2);
    }
}
