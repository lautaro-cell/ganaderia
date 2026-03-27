using GestorGanadero.Server.Domain.Enums;

namespace GestorGanadero.Server.Application.DTOs;

public record UserDto(
    Guid Id,
    string Email,
    Guid TenantId,
    UserRole Role);
