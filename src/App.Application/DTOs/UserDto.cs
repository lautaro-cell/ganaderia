using App.Domain.Enums;
using NodaTime;

namespace App.Application.DTOs;

public record UserDto(
    Guid Id,
    string Email,
    Guid TenantId,
    UserRole Role,
    string? Name = null,
    bool IsActive = true,
    Instant? LastLoginAt = null,
    List<Guid>? AssignedFieldIds = null);

