using System.Text.Json;
using App.Domain.Common;
using App.Domain.Enums;
using NodaTime;

namespace App.Domain.Entities;

public class ExternalCatalog : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public CatalogType CatalogType { get; set; }
    
    // Mapping to jsonb in EF Core
    public JsonDocument? Data { get; set; }
    
    public Instant LastSyncedAt { get; set; }
    
    public Tenant? Tenant { get; set; }
}
