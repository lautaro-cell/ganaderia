namespace WebApplication1.Application.DTOs;

public record LivestockEventDetailDto(
    Guid Id,
    string TypeName,
    DateTimeOffset OccurredOn,
    string FieldName,
    int HeadCount,
    decimal WeightPerHead,
    decimal TotalWeight,
    string? Observations,
    string TypeCode);
