namespace App.Domain.Entities;

/// <summary>
/// Tabla de join many-to-many: Activity ↔ AnimalCategory.
/// Una categoría puede pertenecer a múltiples actividades productivas.
/// </summary>
public class ActivityAnimalCategory
{
    public Guid ActivityId { get; set; }
    public Guid AnimalCategoryId { get; set; }

    public Activity? Activity { get; set; }
    public AnimalCategory? AnimalCategory { get; set; }
}
