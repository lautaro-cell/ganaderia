using App.Domain.Common;

namespace App.Domain.Entities;

/// <summary>
/// Representa un campo/estancia productiva perteneciente a un Tenant.
/// Equivale a la tabla 'campos' del sistema Node.js original.
/// </summary>
public class Field : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LegalName { get; set; }
    public decimal? AreaHectares { get; set; }
    public double? GpsLatitude { get; set; }
    public double? GpsLongitude { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid TenantId { get; set; }

    public Tenant? Tenant { get; set; }
    public ICollection<LivestockEvent> LivestockEvents { get; set; } = new List<LivestockEvent>();
    public ICollection<FieldActivity> FieldActivities { get; set; } = new List<FieldActivity>();
}

