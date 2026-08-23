using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class UserMappingProfile : Profile
    {
        public UserMappingProfile()
        {
            CreateMap<User, UserDto>()
                .ForMember(dto => dto.FactoryHallName, opt => opt.MapFrom(src => src.FactoryHall != null ? src.FactoryHall.Name : null));
        }
    }
}
