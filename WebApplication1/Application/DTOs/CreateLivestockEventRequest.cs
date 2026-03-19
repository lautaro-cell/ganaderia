namespace WebApplication1.Application.DTOs;

public record CreateLivestockEventRequest(
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    DateTimeOffset EventDate);
