using System.Security.Cryptography;
using System.Text;

namespace SmartFactoryCMMS.Api.Services;

public static class DeviceKeyService
{
    public const string KeyPrefix = "sf_dev_";

    public static (string RawKey, string Hash, string DisplayPrefix) Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
        var raw = KeyPrefix + token;
        return (raw, Hash(raw), DisplayPrefix(raw));
    }

    public static string Hash(string rawKey)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    public static string DisplayPrefix(string rawKey)
    {
        if (string.IsNullOrEmpty(rawKey)) return string.Empty;
        return rawKey.Length <= 14 ? rawKey : $"{rawKey[..14]}…";
    }
}
