using System.Text.Json;
using GestorGanadero.Server.Domain.Common;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Domain.Entities;

public class ExternalCatalog : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public CatalogType CatalogType { get; set; }
    
    // Mapping to jsonb in EF Core
    public JsonDocument? Data { get; set; }
    
    public DateTimeOffset LastSyncedAt { get; set; }
    
    public Tenant? Tenant { get; set; }
}
