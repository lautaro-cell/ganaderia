namespace App.Domain.Entities;

/// <summary>
/// Join M:N entre Field y Activity — qué actividades están habilitadas en cada campo.
/// </summary>
public class FieldActivity
{
    public Guid FieldId { get; set; }
    public Guid ActivityId { get; set; }

    public Field? Field { get; set; }
    public Activity? Activity { get; set; }
}
