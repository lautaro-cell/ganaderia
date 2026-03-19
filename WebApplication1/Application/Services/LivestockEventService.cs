using Microsoft.EntityFrameworkCore;
using WebApplication1.Application.DTOs;
using WebApplication1.Application.Interfaces;
using WebApplication1.Domain.Entities;
using WebApplication1.Domain.Enums;
using WebApplication1.Infrastructure.Persistence;

namespace WebApplication1.Application.Services;

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
        var pendingEvents = await _context.LivestockEvents
            .Where(e => e.Status == LivestockEventStatus.Draft)
            .Select(e => new LivestockEventResponse(
                e.Id,
                e.EventTemplateId,
                e.CostCenterCode,
                e.HeadCount,
                e.EstimatedWeightKg,
                e.TotalAmount,
                e.Status.ToString(),
                e.EventDate))
            .ToListAsync();

        return pendingEvents;
    }

    // Placeholder implementations for other interface methods
    public Task<string> CommitToErpAsync(IEnumerable<Guid> livestockEventIds) => throw new NotImplementedException();
    public Task<LivestockEventDto> GetByIdAsync(Guid id) => throw new NotImplementedException();
    public Task<IEnumerable<LivestockEventDto>> GetAllAsync(Guid tenantId) => throw new NotImplementedException();
    public Task UpdateAsync(LivestockEventDto dto) => throw new NotImplementedException();
    public Task DeleteAsync(Guid id) => throw new NotImplementedException();
}
