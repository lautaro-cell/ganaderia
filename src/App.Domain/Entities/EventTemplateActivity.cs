namespace App.Domain.Entities;

/// <summary>
/// Join M:N entre EventTemplate y Activity — qué actividades pueden usar cada tipo de evento.
/// </summary>
public class EventTemplateActivity
{
    public Guid EventTemplateId { get; set; }
    public Guid ActivityId { get; set; }

    public EventTemplate? EventTemplate { get; set; }
    public Activity? Activity { get; set; }
}
