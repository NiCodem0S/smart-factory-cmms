using System.ComponentModel.DataAnnotations;
using SmartFactoryCMMS.Api.Helpers.Enums;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateMachineDto
    {
        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(127)]
        public string Category { get; set; } = string.Empty;

        [StringLength(127)]
        public string SerialNumber { get; set; } = string.Empty;

        [Required]
        public MachineStatus Status { get; set; } = MachineStatus.Offline;  // Running, Maintenance, Error, Offline
    }
}