using NodaTime;
using System.Text.Json;
using App.Domain.Enums;

namespace App.Application.DTOs;

public record ExternalCatalogDto(
    Guid Id,
    Guid TenantId,
    CatalogType CatalogType,
    JsonDocument? Data,
    Instant LastSyncedAt);


