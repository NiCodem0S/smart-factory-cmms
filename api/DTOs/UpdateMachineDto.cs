using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class UpdateMachineDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Category { get; set; } = string.Empty;

        [StringLength(100)]
        public string? SerialNumber { get; set; }

        [Required]
        [StringLength(30)]
        public MachineStatus Status { get; set; } = MachineStatus.Offline;

        public bool IsActive { get; set; }
    }
}
