using App.Domain.Enums;

namespace App.Domain.Entities;

/// <summary>
/// Tabla de join: qué EventTypes son válidos para una Activity.
/// Permite configurar por tenant qué tipos de evento aplican a cada actividad productiva.
/// </summary>
public class ActivityEventType
{
    public Guid ActivityId { get; set; }
    public EventType EventType { get; set; }

    public Activity? Activity { get; set; }
}
