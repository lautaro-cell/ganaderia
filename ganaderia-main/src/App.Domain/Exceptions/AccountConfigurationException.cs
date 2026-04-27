using App.Domain.Enums;

namespace App.Domain.Exceptions;

public class AccountConfigurationException : InvalidOperationException
{
    public Guid TenantId { get; }
    public EventType EventType { get; }
    public string? AccountType { get; }
    
    public AccountConfigurationException(Guid tenantId, EventType eventType, string? accountType, string message)
        : base(message)
    {
        TenantId = tenantId;
        EventType = eventType;
        AccountType = accountType;
    }
    
    public static AccountConfigurationException MissingDebitAccount(Guid tenantId, EventType eventType)
    {
        return new AccountConfigurationException(
            tenantId, 
            eventType, 
            "DEBIT", 
            $"No debit account configured for event type '{eventType}' for tenant '{tenantId}'");
    }
    
    public static AccountConfigurationException MissingCreditAccount(Guid tenantId, EventType eventType)
    {
        return new AccountConfigurationException(
            tenantId, 
            eventType, 
            "CREDIT", 
            $"No credit account configured for event type '{eventType}' for tenant '{tenantId}'");
    }
}