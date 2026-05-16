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
            CreateMap<WorkOrder, WorkOrderListDto>()
                .ForMember(dto => dto.MachineName, opt => opt.MapFrom(src => src.Machine != null ? src.Machine.Name : string.Empty))
                .ForMember(dto => dto.Description, opt => opt.MapFrom(src => src.Description ?? string.Empty));
            CreateMap<WorkOrder, WorkOrderDetailDto>()
                .ForMember(dto => dto.MachineName, opt => opt.MapFrom(src => src.Machine != null ? src.Machine.Name : string.Empty))
                .ForMember(dto => dto.Description, opt => opt.MapFrom(src => src.Description ?? string.Empty));
        }
    }
}

