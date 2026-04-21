namespace App.Application.DTOs;

public record ErpConceptDto(
    Guid Id,
    string Description,
    double Stock,
    string? UnitA,
    string? UnitB,
    string? Grupo,
    string? Subgrupo,
    string? ExternalId,
    Guid TenantId
);
