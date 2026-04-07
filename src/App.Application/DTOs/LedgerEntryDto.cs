using NodaTime;

namespace App.Application.DTOs;

public record LedgerEntryDto(
    Guid Id,
    Instant Date,
    string Description,
    decimal Amount,
    string AccountCode,
    string Status,
    string EntryType,
    int HeadCount,
    decimal WeightKg);
