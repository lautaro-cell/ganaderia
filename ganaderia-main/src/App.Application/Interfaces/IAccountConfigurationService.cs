using App.Application.DTOs;
using App.Domain.Enums;

namespace App.Application.Interfaces;

public interface IAccountConfigurationService
{
    Task<string> GetDebitAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null);

    Task<string> GetCreditAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null);

    Task<(string DebitAccountCode, string CreditAccountCode)> GetAccountCodesAsync(
        Guid tenantId,
        EventType eventType,
        string? defaultDebitAccountCode = null,
        string? defaultCreditAccountCode = null);

    /// <summary>
    /// Valida y persiste una configuración contable para un tipo de evento.
    /// Lanza ValidationException si la configuración es inválida.
    /// </summary>
    Task<Guid> SaveAsync(SaveAccountConfigurationCommand command);
}