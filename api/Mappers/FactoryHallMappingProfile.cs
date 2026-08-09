using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class FactoryHallMappingProfile : Profile
    {
        public FactoryHallMappingProfile()
        {
            CreateMap<FactoryHall, FactoryHallDto>();
        }
    }
}
