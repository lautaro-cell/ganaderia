using System.Text.Json;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Application.DTOs;

public record ExternalCatalogDto(
    Guid Id,
    Guid TenantId,
    CatalogType CatalogType,
    JsonDocument? Data,
    DateTimeOffset LastSyncedAt);
