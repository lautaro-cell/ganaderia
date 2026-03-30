using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Application.DTOs;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using GestorGanadero.Server.Domain.Enums;
using System.Linq;
using System.Threading.Tasks;

namespace GestorGanadero.Server.Grpc;

public class IdentityServiceImplementation : IdentityService.IdentityServiceBase
{
    private readonly IUserService _userService;
    private readonly ILogger<IdentityServiceImplementation> _logger;

    public IdentityServiceImplementation(IUserService userService, ILogger<IdentityServiceImplementation> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    public override async Task<UserProfile> GetMyProfile(Empty request, ServerCallContext context)
    {
        var profile = await _userService.GetMyProfileAsync();
        return new UserProfile
        {
            Id = profile.Id.ToString(),
            Email = profile.Email,
            Name = profile.Email.Split('@')[0],
            Role = profile.Role.ToString(),
            ActiveTenantId = profile.TenantId.ToString()
        };
    }

    public override async Task<TenantList> GetAvailableTenants(Empty request, ServerCallContext context)
    {
        var tenants = await _userService.GetAvailableTenantsAsync();
        var response = new TenantList();
        response.Tenants.AddRange(tenants.Select(t => new TenantMessage { Id = t.Id.ToString(), Name = t.Name }));
        return response;
    }

    public override async Task<UserList> GetUsers(Empty request, ServerCallContext context)
    {
        var users = await _userService.GetAllUsersAsync();
        var response = new UserList();
        response.Users.AddRange(users.Select(u => new UserMessage { Id = u.Id.ToString(), Email = u.Email, RoleName = u.Role.ToString(), TenantId = u.TenantId.ToString(), IsActive = true }));
        return response;
    }

    public override async Task<ActionResponse> InviteUser(InviteUserRequest request, ServerCallContext context)
    {
        var id = await _userService.InviteUserAsync(new GestorGanadero.Server.Application.DTOs.InviteUserRequest(request.Email, request.Name, request.RoleName, System.Guid.Parse(request.TenantId)));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateUser(UserMessage request, ServerCallContext context)
    {
        await _userService.UpdateUserAsync(new UserDto(System.Guid.Parse(request.Id), request.Email, System.Guid.Parse(request.TenantId), System.Enum.Parse<UserRole>(request.RoleName)));
        return new ActionResponse { Success = true, Message = "Usuario actualizado." };
    }

    public override async Task<ActionResponse> DeleteUser(DeleteEntityRequest request, ServerCallContext context)
    {
        await _userService.DeleteUserAsync(System.Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Usuario eliminado." };
    }
}
