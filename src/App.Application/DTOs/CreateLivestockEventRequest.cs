using NodaTime;
namespace App.Application.DTOs;

public record CreateLivestockEventRequest(
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    Instant EventDate,
    Guid? FieldId = null,
    Guid? ActivityId = null,
    Guid? CategoryId = null,
    Guid? OriginActivityId = null,
    Guid? DestinationActivityId = null,
    Guid? OriginCategoryId = null,
    Guid? DestinationCategoryId = null,
    Guid? DestinationFieldId = null,
    decimal? WeightPerHead = null,
    string? Observations = null);

