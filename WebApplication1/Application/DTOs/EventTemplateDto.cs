using WebApplication1.Domain.Enums;

namespace WebApplication1.Application.DTOs;

public record EventTemplateDto(
    Guid Id,
    Guid TenantId,
    string Name,
    EventType EventType,
    string DebitAccountCode,
    string CreditAccountCode,
    bool IsActive);
