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

            // 1. Prioritize JWT Claim (tenant_id)
            var claim = context.User?.FindFirst("tenant_id");
            if (claim != null && Guid.TryParse(claim.Value, out var claimTenantId))
            {
                return claimTenantId;
            }

            // 2. Fallback to Header (X-Tenant-Id)
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
}
