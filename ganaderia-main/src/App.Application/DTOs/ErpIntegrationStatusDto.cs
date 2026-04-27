namespace App.Application.DTOs;

public record ErpIntegrationStatusDto(
    bool IsConfigured,
    bool IsEnabled,
    string? ApiKeyLast4,
    string BaseUrl,
    int GestorDatabaseId,
    string TenantName,
    DateTimeOffset? LastTestedAt,
    bool? LastTestOk,
    string? LastTestError,
    DateTimeOffset? LastSyncAt,
    bool? LastSyncOk,
    string? LastSyncError,
    string StatusSummary);
