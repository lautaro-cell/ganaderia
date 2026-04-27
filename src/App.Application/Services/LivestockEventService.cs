using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NodaTime;

namespace App.Application.Services;

public class LivestockEventService : ILivestockEventService
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly ITranslationService _translationService;

    public LivestockEventService(
        IApplicationDbContext context,
        ITenantProvider tenantProvider,
        ITranslationService translationService)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _translationService = translationService;
    }

    public async Task<Guid> CreateEventAsync(CreateLivestockEventRequest request)
    {
        var templateExists = await _context.EventTemplates
            .AnyAsync(t => t.Id == request.EventTemplateId && t.IsActive);

        if (!templateExists)
            throw new ArgumentException("La plantilla de evento no existe o está inactiva.");

        var estimatedWeight = request.EstimatedWeightKg > 0
            ? request.EstimatedWeightKg
            : (request.WeightPerHead ?? 0) * request.HeadCount;

        var totalAmount = request.TotalAmount > 0 ? request.TotalAmount : estimatedWeight;

        var newEvent = new LivestockEvent
        {
            TenantId = _tenantProvider.TenantId,
            EventTemplateId = request.EventTemplateId,
            CostCenterCode = request.CostCenterCode,
            FieldId = request.FieldId,
            DestinationFieldId = request.DestinationFieldId,
            ActivityId = request.ActivityId ?? request.OriginActivityId,
            OriginActivityId = request.OriginActivityId ?? request.ActivityId,
            DestinationActivityId = request.DestinationActivityId,
            CategoryId = request.CategoryId ?? request.OriginCategoryId,
            OriginCategoryId = request.OriginCategoryId ?? request.CategoryId,
            DestinationCategoryId = request.DestinationCategoryId,
            HeadCount = request.HeadCount,
            WeightPerHead = request.WeightPerHead,
            EstimatedWeightKg = estimatedWeight,
            TotalAmount = totalAmount,
            EventDate = request.EventDate,
            Observations = request.Observations,
            Status = LivestockEventStatus.Draft
        };

        _context.LivestockEvents.Add(newEvent);
        await _context.SaveChangesAsync();

        await _translationService.TranslateEventToDraftAsync(newEvent.Id);
        return newEvent.Id;
    }

    public async Task<IEnumerable<LivestockEventResponse>> GetPendingEventsAsync()
    {
        return await _context.LivestockEvents
            .AsNoTracking()
            .Where(e => e.Status == LivestockEventStatus.Validated)
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
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.IsActive)
            .Select(t => new EventTemplateDto(
                t.Id,
                t.TenantId,
                t.Name,
                t.EventType,
                t.DebitAccountCode,
                t.CreditAccountCode,
                t.IsActive))
            .ToListAsync();
    }

    public async Task<IEnumerable<LivestockEventResponse>> GetEventsAsync(Guid? tenantId, Instant? start, Instant? end)
    {
        if (tenantId.HasValue && tenantId.Value != _tenantProvider.TenantId)
            return Enumerable.Empty<LivestockEventResponse>();

        var query = _context.LivestockEvents
            .AsNoTracking()
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
        if (tenantId.HasValue && tenantId.Value != _tenantProvider.TenantId)
            return (Array.Empty<LivestockEventResponse>(), 0);

        var query = _context.LivestockEvents
            .AsNoTracking()
            .AsQueryable();

        if (start.HasValue) query = query.Where(e => e.EventDate >= start.Value);
        if (end.HasValue) query = query.Where(e => e.EventDate <= end.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.EventDate)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
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

        return (items, total);
    }

    public async Task<LivestockEventDetailDto> GetEventDetailsAsync(Guid id)
    {
        var e = await _context.LivestockEvents
            .AsNoTracking()
            .Include(x => x.EventTemplate)
            .Include(x => x.Field)
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
            e.Observations,
            e.EventTemplate?.Code ?? "");
    }

    public async Task UpdateEventAsync(UpdateEventRequestDto dto)
    {
        var e = await _context.LivestockEvents.FindAsync(dto.Id);
        if (e == null) throw new KeyNotFoundException("Evento no encontrado");

        e.EventDate = dto.OccurredOn;
        e.HeadCount = dto.HeadCount;
        e.WeightPerHead = dto.WeightPerHead;
        e.EstimatedWeightKg = dto.PrimaryValue;
        e.TotalAmount = dto.PrimaryValue;
        e.Observations = dto.Observations;

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

    public async Task<string> CommitToErpAsync(IEnumerable<Guid> livestockEventIds)
    {
        var ids = livestockEventIds.Distinct().ToList();
        if (ids.Count == 0) return "Sin eventos para sincronizar.";

        var events = await _context.LivestockEvents
            .Where(e => ids.Contains(e.Id) && (e.Status == LivestockEventStatus.Validated || e.Status == LivestockEventStatus.Draft))
            .ToListAsync();

        var prefix = $"ERP-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var seq = 1;
        foreach (var ev in events)
        {
            ev.Status = LivestockEventStatus.Synced;
            ev.ErpTransactionId = $"{prefix}-{seq++:D4}";
        }

        await _context.SaveChangesAsync();
        return $"{prefix} ({events.Count} evento(s))";
    }

    public async Task<LivestockEventDto> GetByIdAsync(Guid id)
    {
        var e = await _context.LivestockEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (e == null) throw new KeyNotFoundException("Evento no encontrado");

        return new LivestockEventDto(
            e.Id,
            e.TenantId,
            e.EventTemplateId,
            e.CostCenterCode,
            e.HeadCount,
            e.EstimatedWeightKg,
            e.TotalAmount,
            e.EventDate,
            e.Status,
            e.ErpTransactionId);
    }

    public async Task UpdateAsync(LivestockEventDto dto)
    {
        var e = await _context.LivestockEvents.FindAsync(dto.Id);
        if (e == null) throw new KeyNotFoundException("Evento no encontrado");

        e.EventTemplateId = dto.EventTemplateId;
        e.CostCenterCode = dto.CostCenterCode;
        e.HeadCount = dto.HeadCount;
        e.EstimatedWeightKg = dto.EstimatedWeightKg;
        e.TotalAmount = dto.TotalAmount;
        e.EventDate = dto.EventDate;
        e.Status = dto.Status;
        e.ErpTransactionId = dto.ErpTransactionId;

        await _context.SaveChangesAsync();
    }

    public Task DeleteAsync(Guid id) => DeleteEventAsync(id);
}
