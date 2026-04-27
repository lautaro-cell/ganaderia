using System.Security.Claims;
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
            var user = _httpContextAccessor.HttpContext?.User;
            var sub = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user?.FindFirst("sub")?.Value;

            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public string? Email
        => _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value
           ?? _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value;
}

