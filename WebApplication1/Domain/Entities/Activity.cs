using WebApplication1.Domain.Common;

namespace WebApplication1.Domain.Entities;

/// <summary>
/// Actividad productiva (Hacienda, Agricultura, etc.).
/// TenantId null = actividad global del sistema; con TenantId = específica del cliente.
/// Equivale a la tabla 'actividades' del sistema Node.js original.
/// </summary>
public class Activity : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid? TenantId { get; set; } // null = global (compartida entre tenants)
    public bool IsGlobal { get; set; } = false;

    public Tenant? Tenant { get; set; }
    public ICollection<AnimalCategory> AnimalCategories { get; set; } = new List<AnimalCategory>();
}
