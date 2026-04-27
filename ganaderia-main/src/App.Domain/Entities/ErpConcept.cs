using App.Domain.Common;

namespace App.Domain.Entities;

public class ErpConcept : BaseAuditableEntity
{
    public required string Description { get; set; }
    public double Stock { get; set; }
    public string? UnitA { get; set; }
    public string? UnitB { get; set; }
    public string? GrupoConcepto { get; set; }
    public string? SubGrupoConcepto { get; set; }
    public string? ExternalErpId { get; set; }
    public DateTime LastSyncDate { get; set; }
    public Guid TenantId { get; set; }
    public Tenant? Tenant { get; set; }
}
