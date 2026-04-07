using App.Domain.Enums;

namespace App.Application.DTOs;

public record EventTemplateDto(
    Guid Id,
    Guid TenantId,
    string Name,
    EventType EventType,
    string DebitAccountCode,
    string CreditAccountCode,
    bool IsActive);

