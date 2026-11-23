using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class ProductionLinesMappingProfile : Profile
    {
        public ProductionLinesMappingProfile()
        {
            CreateMap<ProductionLine, ProductionLineDto>()
                .ForMember(dest => dest.Machines, opt => opt.MapFrom(src =>
                    src.Machines.Where(m => m.IsActive).OrderBy(m => m.OrderInLine)));
            CreateMap<CreateProductionLineDto, ProductionLine>();
        }
    }
}
