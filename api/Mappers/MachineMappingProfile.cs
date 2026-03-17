using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class MachineMappingProfile : Profile
    {
        public MachineMappingProfile() 
        {
            CreateMap<UpdateMachineDto, Machine>();
        }
    }
}
