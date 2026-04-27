using App.Application.Interfaces;
using Microsoft.AspNetCore.Http;

namespace App.Infrastructure.Services;

public class HttpContextCurrentUserProvider : ICurrentUserProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentUserProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? UserId
    {
        get
        {
            var context = _httpContextAccessor.HttpContext;
            if (context?.User == null) return null;

            var value =
                context.User.FindFirst("sub")?.Value ??
                context.User.FindFirst("nameid")?.Value ??
                context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            return Guid.TryParse(value, out var userId) ? userId : null;
        }
    }
}
