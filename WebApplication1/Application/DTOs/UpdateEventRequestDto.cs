namespace WebApplication1.Application.DTOs;

public record UpdateEventRequestDto(
    Guid Id,
    DateTimeOffset OccurredOn,
    int HeadCount,
    decimal WeightPerHead,
    decimal PrimaryValue,
    string? Observations);
