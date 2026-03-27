using Microsoft.EntityFrameworkCore;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Domain.Entities;
using GestorGanadero.Server.Domain.Enums;
using GestorGanadero.Server.Infrastructure.Persistence;

namespace GestorGanadero.Server.Application.Services;

public class TranslationService : ITranslationService
{
    private readonly GestorGanaderoDbContext _context;

    public TranslationService(GestorGanaderoDbContext context)
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

        var totalAmount = eventEntity.TotalAmount;
        var concept = $"Ref: {eventEntity.EventTemplate.Name} - Lote: {eventEntity.CostCenterCode} - Cabezas: {eventEntity.HeadCount}";

        // 2. Generar el Asiento del DEBE (Debit)
        var debitDraft = new AccountingDraft
        {
            TenantId = eventEntity.TenantId,
            LivestockEventId = eventEntity.Id,
            AccountCode = eventEntity.EventTemplate.DebitAccountCode,
            Concept = concept,
            DebitAmount = totalAmount,
            CreditAmount = 0
        };

        // 3. Generar el Asiento del HABER (Credit)
        var creditDraft = new AccountingDraft
        {
            TenantId = eventEntity.TenantId,
            LivestockEventId = eventEntity.Id,
            AccountCode = eventEntity.EventTemplate.CreditAccountCode,
            Concept = concept,
            DebitAmount = 0,
            CreditAmount = totalAmount
        };

        // 4. Persistir
        _context.AccountingDrafts.Add(debitDraft);
        _context.AccountingDrafts.Add(creditDraft);

        // Cambiar el Status del LivestockEvent a Validated
        eventEntity.Status = LivestockEventStatus.Validated;

        await _context.SaveChangesAsync();

        // 5. Mapear y Retornar
        return new List<AccountingDraftDto>
        {
            new AccountingDraftDto(
                debitDraft.Id,
                debitDraft.TenantId,
                debitDraft.LivestockEventId,
                debitDraft.AccountCode,
                debitDraft.Concept,
                debitDraft.DebitAmount,
                debitDraft.CreditAmount),
            new AccountingDraftDto(
                creditDraft.Id,
                creditDraft.TenantId,
                creditDraft.LivestockEventId,
                creditDraft.AccountCode,
                creditDraft.Concept,
                creditDraft.DebitAmount,
                creditDraft.CreditAmount)
        };
    }
}
