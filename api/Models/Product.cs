using System.ComponentModel.DataAnnotations;

namespace SmartFactoryCMMS.Api.Models
{
    public class Product
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(50)]
        public string SKUNumber { get; set; } = string.Empty;
        
        public string? Description { get; set; }
        
        public ICollection<ProductionLine> ProductionLines { get; set; } = new List<ProductionLine>();
    }
}
