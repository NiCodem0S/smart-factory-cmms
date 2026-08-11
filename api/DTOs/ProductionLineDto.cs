namespace SmartFactoryCMMS.Api.DTOs
{
    public class ProductionLineDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Guid CurrentProductId { get; set; }
        public Guid FactoryHallId { get; set; }
    }
}