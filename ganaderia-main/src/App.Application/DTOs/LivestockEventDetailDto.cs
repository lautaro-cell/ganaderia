using NodaTime;
namespace App.Application.DTOs;

public record LivestockEventDetailDto(
    Guid Id,
    string TypeName,
    Instant OccurredOn,
    string FieldName,
    int HeadCount,
    decimal WeightPerHead,
    decimal TotalWeight,
    string? Observations,
    string TypeCode);


