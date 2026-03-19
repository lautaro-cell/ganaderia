using System.Text.Json;
using WebApplication1.Domain.Common;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Domain.Entities;

public class ExternalCatalog : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public CatalogType CatalogType { get; set; }
    
    // Mapping to jsonb in EF Core
    public JsonDocument? Data { get; set; }
    
    public DateTimeOffset LastSyncedAt { get; set; }
    
    public Tenant? Tenant { get; set; }
}
