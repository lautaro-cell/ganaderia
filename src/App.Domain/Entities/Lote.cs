using App.Domain.Common;

namespace App.Domain.Entities;

/// <summary>
/// Representa un lote productivo dentro de un campo (Field).
/// Un lote puede estar asociado a múltiples actividades.
/// </summary>
public class Lote : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid TenantId { get; set; }
    public Guid FieldId { get; set; }
    public Field? Field { get; set; }
    
    // Muchos a muchos con Activity
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}

