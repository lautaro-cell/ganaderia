using Grpc.Core;
using Google.Protobuf.WellKnownTypes;
using App.Application.Interfaces;
using App.Application.DTOs;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Microsoft.Extensions.Logging;
using App.Domain.Enums;

namespace GestorGanadero.Server.Grpc;

public class IdentityServiceImplementation : IdentityService.IdentityServiceBase
{
    private readonly IUserService _userService;
    private readonly IErpConnectivityService _connectivity;
    private readonly ICompanyConfigurationService _companyConfig;
    private readonly IErpSyncService _syncService;
    private readonly ILogger<IdentityServiceImplementation> _logger;

    public IdentityServiceImplementation(
        IUserService userService,
        IErpConnectivityService connectivity,
        ICompanyConfigurationService companyConfig,
        IErpSyncService syncService,
        ILogger<IdentityServiceImplementation> logger)
    {
        _userService = userService;
        _connectivity = connectivity;
        _companyConfig = companyConfig;
        _syncService = syncService;
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
            ActiveTenantId = profile.TenantId.ToString(),
            ProfileImageUrl = ""
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
        foreach (var u in users)
        {
            var msg = new UserMessage
            {
                Id = u.Id.ToString(),
                Email = u.Email,
                Name = u.Name ?? u.Email.Split('@')[0],
                RoleName = u.Role.ToString(),
                TenantId = u.TenantId.ToString(),
                IsActive = u.IsActive,
                LastLoginAt = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString() : ""
            };
            if (u.AssignedFieldIds != null) msg.AssignedFieldIds.AddRange(u.AssignedFieldIds.Select(id => id.ToString()));
            response.Users.Add(msg);
        }
        return response;
    }

    public override async Task<ActionResponse> InviteUser(
        Services.Identity.Contracts.InviteUserRequest request, ServerCallContext context)
    {
        var id = await _userService.InviteUserAsync(
            new App.Application.DTOs.InviteUserRequest(request.Email, request.Name, request.RoleName, Guid.Parse(request.TenantId)));
        return new ActionResponse { Success = true, ObjectId = id.ToString() };
    }

    public override async Task<ActionResponse> UpdateUser(UserMessage request, ServerCallContext context)
    {
        var fieldIds = request.AssignedFieldIds.Select(Guid.Parse).ToList();
        await _userService.UpdateUserAsync(new UserDto(
            Guid.Parse(request.Id), request.Email, Guid.Parse(request.TenantId),
            System.Enum.Parse<UserRole>(request.RoleName),
            request.Name, request.IsActive, null,
            fieldIds.Any() ? fieldIds : null));
        return new ActionResponse { Success = true, Message = "Usuario actualizado." };
    }

    public override async Task<ActionResponse> DeleteUser(DeleteEntityRequest request, ServerCallContext context)
    {
        await _userService.DeleteUserAsync(Guid.Parse(request.Id));
        return new ActionResponse { Success = true, Message = "Usuario eliminado." };
    }

    public override async Task<TenantList> GetAllTenants(Empty request, ServerCallContext context)
    {
        var tenants = await _userService.GetAvailableTenantsAsync();
        var response = new TenantList();

        foreach (var t in tenants)
        {
            var status = await _connectivity.GetStatusAsync(t.Id, context.CancellationToken);
            response.Tenants.Add(new TenantMessage
            {
                Id = t.Id.ToString(),
                Name = t.Name,
                GestorMaxDatabaseId = t.GestorMaxDatabaseId ?? "",
                StatusSummary = status?.StatusSummary ?? "Sin configurar",
                HasErpConfig = status?.IsConfigured ?? false,
                LastSyncAt = status?.LastSyncAt?.ToString("O") ?? "",
                LastTestOk = status?.LastTestOk ?? false
            });
        }

        return response;
    }

    public override async Task<ActionResponse> UpdateTenant(TenantMessage request, ServerCallContext context)
    {
        try
        {
            await _userService.UpdateTenantAsync(new TenantDto(
                Guid.Parse(request.Id),
                request.Name,
                request.GestorMaxDatabaseId,
                NodaTime.Instant.FromDateTimeUtc(DateTime.UtcNow),
                request.GestorMaxApiKey));
            return new ActionResponse { Success = true, Message = "Empresa actualizada correctamente." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error actualizando empresa");
            return new ActionResponse { Success = false, Message = ex.Message };
        }
    }

    // --- Module 3 ---

    public override async Task<ActionResponse> SaveCompanyConfiguration(
        SaveCompanyConfigurationRequest request, ServerCallContext context)
    {
        try
        {
            await _companyConfig.SaveAsync(new SaveErpConfigurationCommand
            {
                TenantId = Guid.Parse(request.TenantId),
                TenantName = request.TenantName,
                ApiKey = string.IsNullOrWhiteSpace(request.ApiKey) ? null : request.ApiKey,
                GestorDatabaseId = request.GestorDatabaseId,
                BaseUrl = string.IsNullOrWhiteSpace(request.BaseUrl) ? "https://api.gestormax.com" : request.BaseUrl
            }, context.CancellationToken);

            return new ActionResponse { Success = true, Message = "Configuración guardada y sincronización iniciada." };
        }
        catch (System.ComponentModel.DataAnnotations.ValidationException ex)
        {
            return new ActionResponse { Success = false, Message = ex.Message };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving company configuration | TenantId={TenantId}", request.TenantId);
            return new ActionResponse { Success = false, Message = ex.Message };
        }
    }

    public override async Task<VerifyConnectionResponse> VerifyConnection(
        VerifyConnectionRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "TenantId inválido."));

        var result = await _connectivity.VerifyConnectionAsync(tenantId, context.CancellationToken);

        return new VerifyConnectionResponse
        {
            Success = result.Success,
            Message = result.Message,
            LatencyMs = result.LatencyMs,
            CheckedAt = result.CheckedAt.ToString("O")
        };
    }

    public override async Task<CompanyStatusResponse> GetCompanyStatus(
        GetCompanyStatusRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "TenantId inválido."));

        var status = await _connectivity.GetStatusAsync(tenantId, context.CancellationToken);

        if (status == null)
            throw new RpcException(new Status(StatusCode.NotFound, "Tenant no encontrado."));

        return new CompanyStatusResponse
        {
            IsConfigured = status.IsConfigured,
            IsEnabled = status.IsEnabled,
            ApiKeyLast4 = status.ApiKeyLast4 ?? "",
            BaseUrl = status.BaseUrl,
            GestorDatabaseId = status.GestorDatabaseId,
            TenantName = status.TenantName,
            LastTestedAt = status.LastTestedAt?.ToString("O") ?? "",
            LastTestOk = status.LastTestOk ?? false,
            LastTestError = status.LastTestError ?? "",
            LastSyncAt = status.LastSyncAt?.ToString("O") ?? "",
            LastSyncOk = status.LastSyncOk ?? false,
            LastSyncError = status.LastSyncError ?? "",
            StatusSummary = status.StatusSummary
        };
    }

    public override async Task<ActionResponse> TriggerCatalogSync(
        TriggerSyncRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "TenantId inválido."));

        try
        {
            await _syncService.SyncCatalogAsync(tenantId, context.CancellationToken);
            return new ActionResponse { Success = true, Message = "Sincronización completada." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual sync failed | TenantId={TenantId}", request.TenantId);
            return new ActionResponse { Success = false, Message = ex.Message };
        }
    }
}
