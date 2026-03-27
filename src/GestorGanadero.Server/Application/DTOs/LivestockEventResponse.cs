namespace GestorGanadero.Server.Application.DTOs;

public record LivestockEventResponse(
    Guid Id,
    Guid EventTemplateId,
    string CostCenterCode,
    int HeadCount,
    decimal EstimatedWeightKg,
    decimal TotalAmount,
    string Status,
    DateTimeOffset EventDate,
    string TypeName,
    string FieldName,
    decimal WeightPerHead);
