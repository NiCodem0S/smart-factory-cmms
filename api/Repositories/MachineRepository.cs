using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Helpers.Enums;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using SmartFactoryCMMS.Api.Simulation;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;

namespace SmartFactoryCMMS.Api.Repositories;

public class MachineRepository(ApplicationDbContext db, IMapper mapper, IUserContext user, SimulationOrchestrator runtime,
    IOptions<SimulationOptions> options) : IMachineRepository
{
    private IQueryable<Machine> AccessibleMachines
    {
        get
        {
            var query = db.Machines.Where(m => m.IsActive);
            if (user.IsSuperAdmin && user.IsAuthenticated) return query;
            if (!user.IsAuthenticated || !user.FactoryHallId.HasValue) return query.Where(m => false);
            return query.Where(m => m.FactoryHallId == user.FactoryHallId);
        }
    }

    public async Task<PagedResult<MachineListDto>> GetMachinesAsync(int page, int pageSize, string? search,
        MachineStatus? status, Guid? selectedHallId, CancellationToken ct = default)
    {
        var query = AccessibleMachines;
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(m => m.Name.Contains(search));
        if (selectedHallId.HasValue && user.IsSuperAdmin) query = query.Where(m => m.FactoryHallId == selectedHallId);
        if (status.HasValue) query = query.Where(m => m.Status == status);
        return new PagedResult<MachineListDto>
        {
            TotalCount = await query.CountAsync(ct), PageNumber = page, PageSize = pageSize,
            Data = await query.OrderBy(m => m.Id).Skip((page - 1) * pageSize).Take(pageSize)
                .ProjectTo<MachineListDto>(mapper.ConfigurationProvider).ToListAsync(ct)
        };
    }

    public Task<MachineDetailDto?> GetMachineDetailsAsync(Guid id, CancellationToken ct = default) =>
        AccessibleMachines.AsNoTracking().AsSplitQuery().Where(m => m.Id == id)
            .ProjectTo<MachineDetailDto>(mapper.ConfigurationProvider).SingleOrDefaultAsync(ct);

    public async Task<List<MachineProductionLineDto>> GetMachinesByProductionLineId(Guid id, CancellationToken ct = default)
    {
        var line = await db.ProductionLines.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id, ct);
        if (line is null || !SimulationActor.From(user).CanRead(line.FactoryHallId))
            throw new SimulationRequestException(404, "Production line not found.");
        return await AccessibleMachines.Where(m => m.ProductionLineId == id).OrderBy(m => m.OrderInLine)
            .ProjectTo<MachineProductionLineDto>(mapper.ConfigurationProvider).ToListAsync(ct);
    }

    public Task<bool> UpdateMachineTresholds(List<CreateAlertThresholdDto> thresholds, Guid id, CancellationToken ct = default) =>
        runtime.UpdateThresholdsAsync(id, SimulationActor.From(user), thresholds, ct);

    public Task<Machine?> FindMachineByIdAsync(Guid id, CancellationToken ct = default) =>
        AccessibleMachines.FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<List<TelemetryReadDto>> GetMachineTelemetryAsync(Guid id, int limit, CancellationToken ct = default)
    {
        if (!await AccessibleMachines.AnyAsync(m => m.Id == id, ct)) throw new SimulationRequestException(404, "Machine not found.");
        return await db.TelemetryRead.Where(t => t.MachineId == id).OrderByDescending(t => t.Timestamp).Take(limit)
            .ProjectTo<TelemetryReadDto>(mapper.ConfigurationProvider).ToListAsync(ct);
    }

    public async Task<TelemetrySeriesDto> GetMachineTelemetrySeriesAsync(Guid id, int windowMinutes, CancellationToken ct = default)
    {
        if (windowMinutes is not (1 or 60 or 1440))
            throw new SimulationRequestException(400, "Choose a 1-minute, 1-hour or 24-hour telemetry window.");
        if (!await AccessibleMachines.AnyAsync(m => m.Id == id, ct))
            throw new SimulationRequestException(404, "Machine not found.");
        var to = DateTime.UtcNow;
        var from = to.AddMinutes(-windowMinutes);
        var bucketSeconds = windowMinutes == 1 ? 0 : (int)Math.Ceiling(windowMinutes * 60d / 720);
        var samples = await TelemetryHistoryQuery.Build(db, id, from, to, bucketSeconds)
            .OrderBy(t => t.Timestamp).ThenBy(t => t.Id)
            .ProjectTo<TelemetryReadDto>(mapper.ConfigurationProvider).ToListAsync(ct);
        return new(new DateTimeOffset(from), new DateTimeOffset(to), options.Value.HistorySampleIntervalSeconds, bucketSeconds, samples);
    }

    public Task<Machine> CreateMachineAsync(Machine machine) =>
        runtime.CreateMachineAsync(machine, SimulationActor.From(user));
    public Task<Machine?> UpdateMachineAsync(Guid id, UpdateMachineDto dto) =>
        runtime.EditMachineAsync(id, SimulationActor.From(user), dto);

    public Task<Machine?> DeleteMachineAsync(Guid id) =>
        runtime.DeleteMachineAsync(id, SimulationActor.From(user));
}
