namespace App.Application.DTOs;

public record FieldDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    Guid TenantId,
    string? LegalName = null,
    decimal? AreaHectares = null,
    double? GpsLatitude = null,
    double? GpsLongitude = null,
    List<Guid>? ActivityIds = null);

