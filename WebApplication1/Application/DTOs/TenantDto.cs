namespace WebApplication1.Application.DTOs;

public record TenantDto(
    Guid Id,
    string Name,
    string ErpTenantId,
    DateTimeOffset CreatedAt);
