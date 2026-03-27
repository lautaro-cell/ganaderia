namespace GestorGanadero.Server.Application.DTOs;

public record UpdateEventRequestDto(
    Guid Id,
    DateTimeOffset OccurredOn,
    int HeadCount,
    decimal WeightPerHead,
    decimal PrimaryValue,
    string? Observations);
