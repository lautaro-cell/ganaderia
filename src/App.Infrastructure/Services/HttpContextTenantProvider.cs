using Microsoft.AspNetCore.Http;
using App.Application.Interfaces;

namespace App.Infrastructure.Services;

public class HttpContextTenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private const string TenantHeaderName = "X-Tenant-Id";

    public HttpContextTenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid TenantId
    {
        get
        {
            var context = _httpContextAccessor.HttpContext;
            if (context == null) return Guid.Empty;

            var claim = context.User?.FindFirst("tenant_id");
            if (claim != null && Guid.TryParse(claim.Value, out var claimTenantId))
            {
                return claimTenantId;
            }

            if (context.Request.Headers.TryGetValue(TenantHeaderName, out var tenantIdStr))
            {
                if (Guid.TryParse(tenantIdStr, out var tenantId))
                {
                    return tenantId;
                }
            }

            return Guid.Empty;
        }
    }

    public bool IsSuperAdmin
    {
        get
        {
            var context = _httpContextAccessor.HttpContext;
            if (context?.User == null) return false;

            var roleClaim = context.User.FindFirst("role");
            return roleClaim != null && roleClaim.Value.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);
        }
    }
}
