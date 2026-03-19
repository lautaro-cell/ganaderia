using WebApplication1.Domain.Enums;

namespace WebApplication1.Application.DTOs;

public record LivestockEventDto(
    Guid Id,
    Guid TenantId,
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    DateTimeOffset EventDate,
    LivestockEventStatus Status,
    string? ErpTransactionId);
