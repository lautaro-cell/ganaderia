using System.Text.Json;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Application.DTOs;

public record ExternalCatalogDto(
    Guid Id,
    Guid TenantId,
    CatalogType CatalogType,
    JsonDocument? Data,
    DateTimeOffset LastSyncedAt);
