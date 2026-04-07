using NodaTime;
namespace App.Application.DTOs;

public record CreateLivestockEventRequest(
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    Instant EventDate);


