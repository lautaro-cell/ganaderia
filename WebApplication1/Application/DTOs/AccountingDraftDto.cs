namespace WebApplication1.Application.DTOs;

public record AccountingDraftDto(
    Guid Id,
    Guid TenantId,
    Guid LivestockEventId,
    string AccountCode,
    string Concept,
    decimal DebitAmount,
    decimal CreditAmount);
