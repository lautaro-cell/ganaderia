namespace WebApplication1.Application.DTOs;

public record LivestockEventResponse(
    Guid Id,
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    string Status,
    DateTimeOffset EventDate);
