namespace App.Application.DTOs;

public record VerifyConnectionResult(
    bool Success,
    string Message,
    long LatencyMs,
    DateTimeOffset CheckedAt);
