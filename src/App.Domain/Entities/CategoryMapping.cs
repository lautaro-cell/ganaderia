using App.Domain.Common;

namespace App.Domain.Entities;

/// <summary>
/// Mapeo entre una categoría local del cliente y una categoría en GestorMax.
/// </summary>
public class CategoryMapping : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid CategoriaClienteId { get; set; }
    public string CategoriaGestorId { get; set; } = string.Empty;

    public AnimalCategory? CategoriaCliente { get; set; }
    public Tenant? Tenant { get; set; }
}