using System.ComponentModel.DataAnnotations;

namespace GestorGanadero.Server.Domain.Common;

public abstract class BaseAuditableEntity
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
