using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Application.DTOs;

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
