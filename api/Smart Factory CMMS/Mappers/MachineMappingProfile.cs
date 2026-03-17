using AutoMapper;
using SmartFactoryCMMS.DTOs;
using SmartFactoryCMMS.Models;

namespace SmartFactoryCMMS.Mappers
{
    public class MachineMappingProfile : Profile
    {
        public MachineMappingProfile() 
        {
            CreateMap<UpdateMachineDto, Machine>();
        }
    }
}
