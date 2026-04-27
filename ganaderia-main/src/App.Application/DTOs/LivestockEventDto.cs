using NodaTime;
using App.Domain.Enums;

namespace App.Application.DTOs;

public record LivestockEventDto(
    Guid Id,
    Guid TenantId,
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    Instant EventDate,
    LivestockEventStatus Status,
    string? ErpTransactionId);


