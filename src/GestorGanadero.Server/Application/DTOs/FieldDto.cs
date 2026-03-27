namespace GestorGanadero.Server.Application.DTOs;

public record FieldDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    Guid TenantId);
