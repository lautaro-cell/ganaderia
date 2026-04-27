using NodaTime;
namespace App.Application.DTOs;

public record UpdateEventRequestDto(
    Guid Id,
    Instant OccurredOn,
    int HeadCount,
    decimal WeightPerHead,
    decimal PrimaryValue,
    string? Observations);


