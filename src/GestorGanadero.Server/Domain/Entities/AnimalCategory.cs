using GestorGanadero.Server.Domain.Common;
using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Domain.Entities;

/// <summary>
/// Categoría animal (Ternero, Novillito, Vaquillona, etc.).
/// Soporta doble tipo CLIENT/GESTOR para interoperar con GestorMax.
/// Equivale a la tabla 'categorias' del sistema Node.js original.
/// </summary>
public class AnimalCategory : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid ActivityId { get; set; }
    public Guid? TenantId { get; set; } // null = categoría estándar global
    public decimal? StandardWeightKg { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Client = propia del cliente, Gestor = sincronizada desde GestorMax.</summary>
    public CategoryType Type { get; set; } = CategoryType.Client;

    /// <summary>ID externo en GestorMax, para enlace con el ERP.</summary>
    public string? ExternalId { get; set; }

    public DateTimeOffset? LastSyncedAt { get; set; }

    public Activity? Activity { get; set; }
    public Tenant? Tenant { get; set; }
}
