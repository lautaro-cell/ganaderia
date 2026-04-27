using App.Application.DTOs;
using App.Application.Interfaces;
using App.Domain.Enums;
using App.Domain.Exceptions;

namespace App.Application.Tests.Fakes;

public class FakeAccountConfigurationService : IAccountConfigurationService
{
    private readonly Dictionary<EventType, (string Debit, string Credit)> _configs;

    public FakeAccountConfigurationService(Dictionary<EventType, (string Debit, string Credit)> configs)
        => _configs = configs;

    public Task<string> GetDebitAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null)
    {
        if (_configs.TryGetValue(eventType, out var c))
            return Task.FromResult(c.Debit);
        if (!string.IsNullOrWhiteSpace(defaultAccountCode))
            return Task.FromResult(defaultAccountCode!);
        throw AccountConfigurationException.MissingDebitAccount(tenantId, eventType);
    }

    public Task<string> GetCreditAccountCodeAsync(Guid tenantId, EventType eventType, string? defaultAccountCode = null)
    {
        if (_configs.TryGetValue(eventType, out var c))
            return Task.FromResult(c.Credit);
        if (!string.IsNullOrWhiteSpace(defaultAccountCode))
            return Task.FromResult(defaultAccountCode!);
        throw AccountConfigurationException.MissingCreditAccount(tenantId, eventType);
    }

    public Task<(string DebitAccountCode, string CreditAccountCode)> GetAccountCodesAsync(
        Guid tenantId,
        EventType eventType,
        string? defaultDebitAccountCode = null,
        string? defaultCreditAccountCode = null)
    {
        if (_configs.TryGetValue(eventType, out var c))
            return Task.FromResult((c.Debit, c.Credit));
        if (!string.IsNullOrWhiteSpace(defaultDebitAccountCode) && !string.IsNullOrWhiteSpace(defaultCreditAccountCode))
            return Task.FromResult((defaultDebitAccountCode!, defaultCreditAccountCode!));
        throw AccountConfigurationException.MissingDebitAccount(tenantId, eventType);
    }

    public Task<Guid> SaveAsync(SaveAccountConfigurationCommand command)
        => throw new NotImplementedException("SaveAsync no se usa en tests unitarios del motor.");
}
