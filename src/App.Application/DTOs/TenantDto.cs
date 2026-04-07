using NodaTime;
namespace App.Application.DTOs;

public record TenantDto(
    Guid Id,
    string Name,
    string ErpTenantId,
    Instant CreatedAt);


