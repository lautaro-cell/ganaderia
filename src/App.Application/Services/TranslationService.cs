using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Entities;
using App.Domain.Enums;
using App.Domain.Exceptions;

namespace App.Application.Services;

public class TranslationService : ITranslationService
{
    private const decimal BalanceTolerance = 0.01m;

    private readonly IApplicationDbContext _context;
    private readonly IAccountConfigurationService _accountConfigService;
    private readonly ILogger<TranslationService> _logger;

    public TranslationService(
        IApplicationDbContext context,
        IAccountConfigurationService accountConfigService,
        ILogger<TranslationService> logger)
    {
        _context = context;
        _accountConfigService = accountConfigService;
        _logger = logger;
    }

    public async Task<IEnumerable<AccountingDraftDto>> TranslateEventToDraftAsync(Guid livestockEventId)
    {
        var eventEntity = await _context.LivestockEvents
            .Include(e => e.EventTemplate)
            .FirstOrDefaultAsync(e => e.Id == livestockEventId);

        if (eventEntity == null)
            throw new InvalidOperationException($"LivestockEvent con ID {livestockEventId} no encontrado.");

        if (eventEntity.Status != LivestockEventStatus.Draft)
            throw new InvalidOperationException("Solo eventos en estado 'Draft' pueden ser traducidos.");

        if (eventEntity.EventTemplate == null)
            throw new InvalidOperationException("El evento no tiene un template asociado.");

        var tenantId = eventEntity.TenantId;
        var eventType = eventEntity.EventTemplate.EventType;

        // BeginScope correlates all log entries for this translation operation (context7: /dotnet/docs logging)
        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["TranslationId"] = Guid.NewGuid(),
            ["TenantId"]      = tenantId,
            ["EventId"]       = livestockEventId,
            ["EventType"]     = eventType.ToString()
        });

        List<AccountingDraft> drafts;
        try
        {
            drafts = (await BuildDraftsAsync(eventEntity)).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Translation ERROR | EventType={EventType} Detail={Detail}",
                eventType, ex.Message);
            throw;
        }

        if (drafts.Count > 0)
            ValidateBalance(drafts);

        if (drafts.Count > 0)
        {
            _context.AccountingDrafts.AddRange(drafts);
            eventEntity.Status = LivestockEventStatus.Validated;
        }
        else if (eventType == EventType.Recuento)
        {
            eventEntity.Status = LivestockEventStatus.Validated;
        }

        await _context.SaveChangesAsync();

        var totalDebit = drafts.Sum(d => d.DebitAmount);
        var totalCredit = drafts.Sum(d => d.CreditAmount);
        _logger.LogInformation(
            "Translation OK | User={User} DEBE={TotalDebit:F2} HABER={TotalCredit:F2}",
            eventEntity.CreatedBy, totalDebit, totalCredit);

        return drafts.Select(d => new AccountingDraftDto(
            d.Id, d.TenantId, d.LivestockEventId, d.AccountCode, d.Concept, d.DebitAmount, d.CreditAmount));
    }

    private static void ValidateBalance(IList<AccountingDraft> drafts)
    {
        var totalDebit = drafts.Sum(d => d.DebitAmount);
        var totalCredit = drafts.Sum(d => d.CreditAmount);
        if (Math.Abs(totalDebit - totalCredit) > BalanceTolerance)
            throw new UnbalancedAccountingEntryException(totalDebit, totalCredit);
    }

    private async Task<IEnumerable<AccountingDraft>> BuildDraftsAsync(LivestockEvent ev)
    {
        var tipo = ev.EventTemplate!.EventType;
        var concept = $"Ref: {ev.EventTemplate.Name} - Campo: {ev.CostCenterCode} - Cabezas: {ev.HeadCount}";
        var amount = ev.TotalAmount;
        var heads = ev.HeadCount;
        var kg = ev.EstimatedWeightKg;

        var simpleTipos = new HashSet<EventType> {
            EventType.Apertura, EventType.Nacimiento, EventType.Destete,
            EventType.Compra, EventType.Venta, EventType.Mortandad, EventType.Consumo
        };

        if (simpleTipos.Contains(tipo))
            return BuildSimplePair(ev, concept, amount, heads, kg);

        return tipo switch
        {
            EventType.Traslado      => await BuildTrasladoAsync(ev, concept, amount, heads, kg),
            EventType.CambioActividad => await BuildCambioActividadAsync(ev, concept, amount, heads, kg),
            EventType.CambioCategoria => await BuildCambioCategoriaAsync(ev, concept, amount, heads, kg),
            EventType.AjusteKg      => await BuildAjusteKgAsync(ev, concept, kg),
            EventType.Recuento      => Enumerable.Empty<AccountingDraft>(),
            _ => BuildSimplePair(ev, concept, amount, heads, kg)
        };
    }

    private IEnumerable<AccountingDraft> BuildSimplePair(
        LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        return new[]
        {
            MakeDraft(ev, ev.EventTemplate!.DebitAccountCode,  concept, amount, 0,      heads, kg, "DEBE"),
            MakeDraft(ev, ev.EventTemplate!.CreditAccountCode, concept, 0,      amount, heads, kg, "HABER")
        };
    }

    private async Task<IEnumerable<AccountingDraft>> BuildTrasladoAsync(
        LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        var (debit, credit) = await _accountConfigService.GetAccountCodesAsync(
            ev.TenantId, EventType.Traslado,
            defaultDebitAccountCode: ev.EventTemplate?.DebitAccountCode,
            defaultCreditAccountCode: ev.EventTemplate?.CreditAccountCode);

        return new[]
        {
            MakeDraft(ev, debit,  concept, amount, 0,      heads, kg, "DEBE",  fieldId: ev.DestinationFieldId),
            MakeDraft(ev, credit, concept, 0,      amount, heads, kg, "HABER", fieldId: ev.FieldId)
        };
    }

    private async Task<IEnumerable<AccountingDraft>> BuildAjusteKgAsync(
        LivestockEvent ev, string concept, decimal kg)
    {
        var absKg = Math.Abs(kg);
        var (debit, credit) = await _accountConfigService.GetAccountCodesAsync(
            ev.TenantId, EventType.AjusteKg);

        if (kg >= 0)
        {
            return new[]
            {
                MakeDraft(ev, debit,  concept, absKg, 0,     0, absKg, "DEBE"),
                MakeDraft(ev, credit, concept, 0,     absKg, 0, absKg, "HABER")
            };
        }
        else
        {
            // Ajuste negativo: se invierten las cuentas
            return new[]
            {
                MakeDraft(ev, credit, concept, absKg, 0,     0, absKg, "DEBE"),
                MakeDraft(ev, debit,  concept, 0,     absKg, 0, absKg, "HABER")
            };
        }
    }

    private async Task<IEnumerable<AccountingDraft>> BuildCambioActividadAsync(
        LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        var (debit, credit) = await _accountConfigService.GetAccountCodesAsync(
            ev.TenantId, EventType.CambioActividad,
            defaultDebitAccountCode: ev.EventTemplate?.DebitAccountCode,
            defaultCreditAccountCode: ev.EventTemplate?.CreditAccountCode);

        return new[]
        {
            MakeDraft(ev, debit,  concept, amount, 0,      heads, kg, "DEBE",  activityId: ev.DestinationActivityId),
            MakeDraft(ev, credit, concept, 0,      amount, heads, kg, "HABER", activityId: ev.OriginActivityId)
        };
    }

    private async Task<IEnumerable<AccountingDraft>> BuildCambioCategoriaAsync(
        LivestockEvent ev, string concept, decimal amount, int heads, decimal kg)
    {
        var (debit, credit) = await _accountConfigService.GetAccountCodesAsync(
            ev.TenantId, EventType.CambioCategoria,
            defaultDebitAccountCode: ev.EventTemplate?.DebitAccountCode,
            defaultCreditAccountCode: ev.EventTemplate?.CreditAccountCode);

        return new[]
        {
            MakeDraft(ev, debit,  concept, amount, 0,      heads, kg, "DEBE",  categoryId: ev.DestinationCategoryId),
            MakeDraft(ev, credit, concept, 0,      amount, heads, kg, "HABER", categoryId: ev.OriginCategoryId)
        };
    }

    private static AccountingDraft MakeDraft(
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
