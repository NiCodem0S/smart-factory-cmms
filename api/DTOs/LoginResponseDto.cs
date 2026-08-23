namespace SmartFactoryCMMS.Api.DTOs
{
    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty; // Token JWT
        public UserDto User { get; set; } = null!;
    }
}