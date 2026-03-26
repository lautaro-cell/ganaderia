namespace WebApplication1.Application.DTOs;

public record InviteUserRequest(
    string Email,
    string Name,
    string RoleName,
    Guid TenantId);
