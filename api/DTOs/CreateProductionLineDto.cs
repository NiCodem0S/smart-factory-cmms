using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.DTOs
{
    public class CreateProductionLineDto
    {
        [Required(ErrorMessage = "Production line name is required.")]
        [MaxLength(100, ErrorMessage = "Name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Status { get; set; } = "Running";

        public int? OrderInHall { get; set; }

        [Required(ErrorMessage = "Factory hall selection is required.")]
        public Guid FactoryHallId { get; set; }

        public Guid? CurrentProductId { get; set; }
    }
}
