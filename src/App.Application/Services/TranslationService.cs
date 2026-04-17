using NodaTime;
using Microsoft.EntityFrameworkCore;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;

namespace App.Application.Services;

public class TranslationService : ITranslationService
{
    private readonly IApplicationDbContext _context;

    public TranslationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AccountingDraftDto>> TranslateEventToDraftAsync(Guid livestockEventId)
    {
        // 1. Buscar y Validar
        var eventEntity = await _context.LivestockEvents
            .Include(e => e.EventTemplate)
            .FirstOrDefaultAsync(e => e.Id == livestockEventId);

        if (eventEntity == null)
            throw new InvalidOperationException($"LivestockEvent with ID {livestockEventId} not found.");

        if (eventEntity.Status != LivestockEventStatus.Draft)
            throw new InvalidOperationException("Only events in 'Draft' status can be translated.");

        if (eventEntity.EventTemplate == null)
            throw new InvalidOperationException("The event does not have an associated template.");

        // 2. Generar Asientos según tipo de evento
        var drafts = BuildDrafts(eventEntity).ToList();

        // 3. Persistir si hay asientos o es Recuento (para validar el evento)
        if (drafts.Any())
        {
            _context.AccountingDrafts.AddRange(drafts);
            eventEntity.Status = LivestockEventStatus.Validated;
        }
        else if (eventEntity.EventTemplate.EventType == EventType.Recuento)
        {
            eventEntity.Status = LivestockEventStatus.Validated;
        }

        await _context.SaveChangesAsync();

        // 4. Mapear y Retornar
        return drafts.Select(d => new AccountingDraftDto(
            d.Id,
            d.TenantId,
            d.LivestockEventId,
            d.AccountCode,
            d.Concept,
            d.DebitAmount,
            d.CreditAmount
        ));
    }

    private IEnumerable<AccountingDraft> BuildDrafts(LivestockEvent ev)
    {
        var tipo = ev.EventTemplate!.EventType;
        var concept = $"Ref: {ev.EventTemplate.Name} - Campo: {ev.CostCenterCode} - Cabezas: {ev.HeadCount}";
        var amount = ev.TotalAmount;
        var heads = ev.HeadCount;
        var kg = ev.EstimatedWeightKg;

        // Mapa simple: la mayoría de tipos usan el par fijo del template
        var simpleTipos = new HashSet<EventType> {
            EventType.Apertura, EventType.Nacimiento, EventType.Destete,
            EventType.Compra, EventType.Venta, EventType.Mortandad, EventType.Consumo
        };

        if (simpleTipos.Contains(tipo))
            return BuildSimplePair(ev, concept, amount, heads, kg);

        return tipo switch
        {
            EventType.Traslado => BuildTraslado(ev, concept, amount, heads, kg),
            EventType.CambioActividad => BuildCambioActividad(ev, concept, amount, heads, kg),
            EventType.CambioCategoria => BuildCambioCategoria(ev, concept, amount, heads, kg),
            EventType.AjusteKg => BuildAjusteKg(ev, concept, kg),
            EventType.Recuento => Enumerable.Empty<AccountingDraft>(),
            _ => BuildSimplePair(ev, concept, amount, heads, kg)
        };
    }

    private IEnumerable<AccountingDraft> BuildSimplePair(LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        return new[]
        {
            MakeDraft(ev, ev.EventTemplate!.DebitAccountCode, concept, amount, 0, heads, kg, "DEBE"),
            MakeDraft(ev, ev.EventTemplate!.CreditAccountCode, concept, 0, amount, heads, kg, "HABER")
        };
    }

    private IEnumerable<AccountingDraft> BuildTraslado(LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        return new[]
        {
            MakeDraft(ev, "ACT001", concept, amount, 0, heads, kg, "DEBE", fieldId: ev.DestinationFieldId),
            MakeDraft(ev, "ACT001", concept, 0, amount, heads, kg, "HABER", fieldId: ev.FieldId)
        };
    }

    private IEnumerable<AccountingDraft> BuildAjusteKg(LivestockEvent ev, string concept, decimal kg)
    {
        var absKg = Math.Abs(kg);
        return kg >= 0
            ? new[]
              {
                  MakeDraft(ev, "ACT001", concept, absKg, 0, 0, absKg, "DEBE"),
                  MakeDraft(ev, "RES008", concept, 0, absKg, 0, absKg, "HABER")
              }
            : new[]
              {
                  MakeDraft(ev, "RES008", concept, absKg, 0, 0, absKg, "DEBE"),
                  MakeDraft(ev, "ACT001", concept, 0, absKg, 0, absKg, "HABER")
              };
    }

    private IEnumerable<AccountingDraft> BuildCambioActividad(LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        return new[]
        {
            MakeDraft(ev, "ACT001", concept, amount, 0, heads, kg, "DEBE", activityId: ev.DestinationActivityId),
            MakeDraft(ev, "ACT001", concept, 0, amount, heads, kg, "HABER", activityId: ev.OriginActivityId)
        };
    }

    private IEnumerable<AccountingDraft> BuildCambioCategoria(LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        return new[]
        {
            MakeDraft(ev, "ACT001", concept, amount, 0, heads, kg, "DEBE", categoryId: ev.DestinationCategoryId),
            MakeDraft(ev, "ACT001", concept, 0, amount, heads, kg, "HABER", categoryId: ev.OriginCategoryId)
        };
    }

    private AccountingDraft MakeDraft(
        LivestockEvent ev, 
        string accountCode, 
        string concept, 
        decimal debit, 
        decimal credit, 
        int heads, 
        decimal kg, 
        string entryType, 
        Guid? fieldId = null,
        Guid? activityId = null,
        Guid? categoryId = null)
    {
        return new AccountingDraft
        {
            TenantId = ev.TenantId,
            LivestockEventId = ev.Id,
            AccountCode = accountCode,
            Concept = concept,
            DebitAmount = debit,
            CreditAmount = credit,
            EntryType = entryType,
            HeadCount = heads,
            WeightKg = kg,
            FieldId = fieldId ?? ev.FieldId,
            ActivityId = activityId ?? ev.ActivityId,
            CategoryId = categoryId ?? ev.CategoryId
        };
    }
}
