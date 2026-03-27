namespace GestorGanadero.Server.Application.DTOs;

public record TenantDto(
    Guid Id,
    string Name,
    string ErpTenantId,
    DateTimeOffset CreatedAt);
