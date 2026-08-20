using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class ProductionLinesMappingProfile : Profile
    {
        public ProductionLinesMappingProfile()
        {
            CreateMap<ProductionLine, ProductionLineDto>();
            CreateMap<CreateProductionLineDto, ProductionLine>();
        }
    }
}
