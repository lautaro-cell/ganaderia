using System.ComponentModel.DataAnnotations;
using NodaTime;

namespace App.Domain.Common;

public abstract class BaseAuditableEntity
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Instant CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public Instant? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
