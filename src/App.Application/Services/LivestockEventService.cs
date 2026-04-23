using NodaTime;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;


namespace App.Application.Services;

public class LivestockEventService : ILivestockEventService
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly ITranslationService _translationService;

    public LivestockEventService(IApplicationDbContext context, ITenantProvider tenantProvider, ITranslationService translationService)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _translationService = translationService;
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

        // Ejecutar flujo de traducción automático para generar AccountingDrafts
        await _translationService.TranslateEventToDraftAsync(newEvent.Id);

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

    public async Task<IEnumerable<EventTemplateDto>> GetEventTemplatesAsync(Guid tenantId)
    {
        return await _context.EventTemplates
            .Where(t => t.TenantId == tenantId && t.IsActive)
            .Select(t => new EventTemplateDto(
                t.Id,
                t.TenantId,
                t.Name,
                t.EventType,
                t.DebitAccountCode,
                t.CreditAccountCode,
                t.IsActive
            ))
            .ToListAsync();
    }

    public async Task<IEnumerable<LivestockEventResponse>> GetEventsAsync(Guid? tenantId, Instant? start, Instant? end)
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

    public async Task<(IReadOnlyList<LivestockEventResponse> Items, int TotalCount)> GetEventsPagedAsync(
        Guid? tenantId, Instant? start, Instant? end, int pageIndex, int pageSize)
    {
        var query = _context.LivestockEvents
            .Include(e => e.EventTemplate)
            .AsQueryable();

        if (start.HasValue) query = query.Where(e => e.EventDate >= start.Value);
        if (end.HasValue) query = query.Where(e => e.EventDate <= end.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(e => e.EventDate)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(e => new LivestockEventResponse(
                e.Id, e.EventTemplateId, e.CostCenterCode, e.HeadCount,
                e.EstimatedWeightKg, e.TotalAmount, e.Status.ToString(), e.EventDate,
                e.EventTemplate != null ? e.EventTemplate.Name : "Evento",
                e.Field != null ? e.Field.Name : "",
                e.WeightPerHead ?? 0))
            .ToListAsync();

        return (items, total);
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


