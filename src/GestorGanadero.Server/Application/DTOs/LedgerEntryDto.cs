namespace GestorGanadero.Server.Application.DTOs;

public record LedgerEntryDto(
    Guid Id,
    DateTime Date,
    string Description,
    decimal Amount,
    string AccountCode,
    string Status,
    string EntryType,
    int HeadCount,
    decimal WeightKg);
