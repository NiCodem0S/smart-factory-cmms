using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;

namespace SmartFactoryCMMS.Api.Repositories;

public class ProductionLinesRepository(ApplicationDbContext db, IMapper mapper, IFactoryHallRepository halls,
    IUserContext user, SimulationOrchestrator runtime) : IProductionLinesRepository
{
    public async Task<List<ProductionLineDto>?> GetProductionLinesByHallsId(Guid? hallsId, CancellationToken ct = default)
    {
        if (!user.IsSuperAdmin)
        {
            hallsId = user.FactoryHallId;
            if (!hallsId.HasValue) return new();
        }
        var query = db.ProductionLines.AsQueryable();
        if (hallsId.HasValue)
        {
            if (await halls.GetFactoryHallByIdAsync(hallsId.Value, ct) is null) return null;
            query = query.Where(l => l.FactoryHallId == hallsId);
        }
        return await query.OrderBy(l => l.OrderInHall ?? int.MaxValue).ThenBy(l => l.Name)
            .ProjectTo<ProductionLineDto>(mapper.ConfigurationProvider).ToListAsync(ct);
    }

    public async Task<ProductionLineDto> CreateProductionLineAsync(CreateProductionLineDto dto, CancellationToken ct = default)
    {
        var actor = SimulationActor.From(user);
        actor.RequireAdmin(); actor.RequireHall(dto.FactoryHallId);
        if (await halls.GetFactoryHallByIdAsync(dto.FactoryHallId, ct) is null)
            throw new SimulationRequestException(404, "Factory hall not found.");
        var line = mapper.Map<ProductionLine>(dto);
        line.Id = Guid.NewGuid(); line.Status = ProductionLinePolicy.Halted;
        db.ProductionLines.Add(line);
        await db.SaveChangesAsync(ct);
        return mapper.Map<ProductionLineDto>(line);
    }

    public async Task<bool> StopProductionLineAsync(Guid id, CancellationToken ct = default)
    {
        await runtime.SetLineAsync(id, SimulationActor.From(user), start: false, ct);
        return true;
    }

    public async Task<(bool Success, string Message, ProductionLineDto? Line)> StartProductionLineAsync(Guid id, CancellationToken ct = default)
    {
        var line = await runtime.SetLineAsync(id, SimulationActor.From(user), start: true, ct);
        return (true, "Production line started.", mapper.Map<ProductionLineDto>(line));
    }
}
