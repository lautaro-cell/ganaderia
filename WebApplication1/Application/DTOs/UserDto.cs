using WebApplication1.Domain.Enums;

namespace WebApplication1.Application.DTOs;

public record UserDto(
    Guid Id,
    string Email,
    Guid TenantId,
    UserRole Role);
