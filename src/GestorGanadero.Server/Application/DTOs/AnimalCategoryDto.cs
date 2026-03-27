namespace GestorGanadero.Server.Application.DTOs;

public record AnimalCategoryDto(
    Guid Id,
    string Name,
    Guid ActivityId,
    decimal StandardWeightKg,
    string CategoryType, // "CLIENTE" o "GESTOR"
    string? ExternalId,
    bool IsActive,
    Guid? TenantId);
