using Microsoft.EntityFrameworkCore;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Domain.Entities;
using GestorGanadero.Server.Domain.Enums;
using GestorGanadero.Server.Infrastructure.Persistence;

namespace GestorGanadero.Server.Application.Services;

public class LivestockEventService : ILivestockEventService
{
    private readonly GestorGanaderoDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public LivestockEventService(GestorGanaderoDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<Guid> CreateEventAsync(CreateLivestockEventRequest request)
    {
        // Validación de Integridad: Verificar que la plantilla existe para este Tenant
        var templateExists = await _context.EventTemplates
            .AnyAsync(t => t.Id == request.EventTemplateId);

        if (!templateExists)
        {
            throw new ArgumentException("La plantilla de evento no existe.");
        }

        var newEvent = new LivestockEvent
        {
            TenantId = _tenantProvider.TenantId,
            EventTemplateId = request.EventTemplateId,
            CostCenterCode = request.CostCenterCode,
            HeadCount = request.HeadCount,
            EstimatedWeightKg = request.EstimatedWeightKg,
            TotalAmount = request.TotalAmount,
            EventDate = request.EventDate,
            Status = LivestockEventStatus.Draft
        };

        _context.LivestockEvents.Add(newEvent);
        await _context.SaveChangesAsync();

        return newEvent.Id;
    }

    public async Task<IEnumerable<LivestockEventResponse>> GetPendingEventsAsync()
    {
        return await _context.LivestockEvents
            .Where(e => e.Status == LivestockEventStatus.Draft)
            .Select(e => new LivestockEventResponse(
                e.Id, 
                e.EventTemplateId, 
                e.CostCenterCode, 
                e.HeadCount, 
                e.EstimatedWeightKg, 
                e.TotalAmount, 
                e.Status.ToString(), 
                e.EventDate,
                e.EventTemplate != null ? e.EventTemplate.Name : "Evento",
                e.Field != null ? e.Field.Name : "",
                e.WeightPerHead ?? 0))
            .ToListAsync();
    }

    public async Task<IEnumerable<LivestockEventResponse>> GetEventsAsync(Guid? tenantId, DateTimeOffset? start, DateTimeOffset? end)
    {
        var query = _context.LivestockEvents
            .Include(e => e.EventTemplate)
            .AsQueryable();

        if (start.HasValue) query = query.Where(e => e.EventDate >= start.Value);
        if (end.HasValue) query = query.Where(e => e.EventDate <= end.Value);

        return await query
            .Select(e => new LivestockEventResponse(
                e.Id, 
                e.EventTemplateId, 
                e.CostCenterCode, 
                e.HeadCount, 
                e.EstimatedWeightKg, 
                e.TotalAmount, 
                e.Status.ToString(), 
                e.EventDate,
                e.EventTemplate != null ? e.EventTemplate.Name : "Evento",
                e.Field != null ? e.Field.Name : "",
                e.WeightPerHead ?? 0))
            .ToListAsync();
    }

    public async Task<LivestockEventDetailDto> GetEventDetailsAsync(Guid id)
    {
        var e = await _context.LivestockEvents
            .Include(e => e.EventTemplate)
            .Include(e => e.Field)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (e == null) throw new KeyNotFoundException("Evento no encontrado");

        return new LivestockEventDetailDto(
            e.Id,
            e.EventTemplate?.Name ?? "N/A",
            e.EventDate,
            e.Field?.Name ?? "N/A",
            e.HeadCount,
            e.WeightPerHead ?? 0,
            e.EstimatedWeightKg,
            e.Observations, // Assuming we add this to entity if missing
            e.EventTemplate?.Id.ToString() ?? ""
        );
    }

    public async Task UpdateEventAsync(UpdateEventRequestDto dto)
    {
        var e = await _context.LivestockEvents.FindAsync(dto.Id);
        if (e == null) throw new KeyNotFoundException("Evento no encontrado");

        e.EventDate = dto.OccurredOn;
        e.HeadCount = dto.HeadCount;
        e.WeightPerHead = dto.WeightPerHead;
        e.EstimatedWeightKg = dto.PrimaryValue; // Assuming PrimaryValue maps to EstimatedWeightKg
        // e.Observations = dto.Observations; // Add to Entity if needed

        await _context.SaveChangesAsync();
    }

    public async Task DeleteEventAsync(Guid id)
    {
        var e = await _context.LivestockEvents.FindAsync(id);
        if (e != null)
        {
            _context.LivestockEvents.Remove(e);
            await _context.SaveChangesAsync();
        }
    }

    // Placeholder implementations for other interface methods
    public Task<string> CommitToErpAsync(IEnumerable<Guid> livestockEventIds) => throw new NotImplementedException();
    public Task<LivestockEventDto> GetByIdAsync(Guid id) => throw new NotImplementedException();
    public Task UpdateAsync(LivestockEventDto dto) => throw new NotImplementedException();
    public Task DeleteAsync(Guid id) => throw new NotImplementedException();
}
