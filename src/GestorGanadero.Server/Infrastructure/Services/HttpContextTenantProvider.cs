using Microsoft.AspNetCore.Http;
using GestorGanadero.Server.Application.Interfaces;

namespace GestorGanadero.Server.Infrastructure.Services;

public class HttpContextTenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private const string TenantHeaderName = "X-Tenant-Id";
    private static readonly Guid DefaultTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111"); // Matches data.sql

    public HttpContextTenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid TenantId
    {
        get
        {
            var context = _httpContextAccessor.HttpContext;
            if (context == null) return DefaultTenantId;

            if (context.Request.Headers.TryGetValue(TenantHeaderName, out var tenantIdStr))
            {
                if (Guid.TryParse(tenantIdStr, out var tenantId))
                {
                    return tenantId;
                }
            }

            return DefaultTenantId;
        }
    }
}
