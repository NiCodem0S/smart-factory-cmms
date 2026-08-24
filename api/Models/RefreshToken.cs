using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartFactoryCMMS.Api.Models
{
    public class RefreshToken
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        [Required]
        [MaxLength(128)]
        public string TokenHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public DateTime? RevokedAt { get; set; }

        public Guid? ReplacedByTokenId { get; set; }

        [MaxLength(45)]
        public string? CreatedByIp { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        [NotMapped]
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

        [NotMapped]
        public bool IsRevoked => RevokedAt != null;

        [NotMapped]
        public bool IsActive => !IsRevoked && !IsExpired;
    }
}
