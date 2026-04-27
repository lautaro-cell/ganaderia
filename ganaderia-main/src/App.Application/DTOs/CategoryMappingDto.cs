namespace App.Application.DTOs;

public record CategoryMappingDto(
    Guid CategoriaClienteId,
    string CategoriaGestorId,
    string CategoriaClienteNombre,
    string CategoriaGestorNombre,
    Guid TenantId
);