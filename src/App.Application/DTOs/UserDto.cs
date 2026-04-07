using App.Domain.Enums;

namespace App.Application.DTOs;

public record UserDto(
    Guid Id,
    string Email,
    Guid TenantId,
    UserRole Role);

