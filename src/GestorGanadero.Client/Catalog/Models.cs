// Catalog domain models (front-end in-memory scaffolding for Plan 3)
using System.Collections.Generic;

public class FieldModel
{
  public string Id { get; set; } = string.Empty;
  public string Name { get; set; } = string.Empty;
  public string Description { get; set; } = string.Empty;
  public bool IsActive { get; set; }
  public List<string> Activities { get; set; } = new List<string>();
  public string GeoJsonPolygon { get; set; } = string.Empty;
  public bool HasGeometry => !string.IsNullOrWhiteSpace(GeoJsonPolygon);
}

public class ActivityModel
{
  public string Id { get; set; } = string.Empty;
  public string Name { get; set; } = string.Empty;
  public bool IsGlobal { get; set; }
}

public class AnimalCategoryModel
{
  public string Id { get; set; } = string.Empty;
  public string Name { get; set; } = string.Empty;
  public string ActivityName { get; set; } = string.Empty;
  public double StandardWeightKg { get; set; }
  public string Type { get; set; } = string.Empty;
  public string ExternalId { get; set; } = string.Empty;
  public bool IsActive { get; set; }
}

