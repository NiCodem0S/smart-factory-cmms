using AutoMapper;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;

namespace SmartFactoryCMMS.Api.Mappers
{
    public class WorkOrderMappingProfile : Profile
    {
        public WorkOrderMappingProfile()
        {
            CreateMap<CreateWorkOrderDto, WorkOrder>();
            CreateMap<UpdateWorkOrderDto, WorkOrder>();
        }
    }
}
