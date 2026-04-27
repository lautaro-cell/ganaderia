using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using App.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace GestorGanadero.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[IgnoreAntiforgeryToken]
public class AuthController : ControllerBase
{
    private readonly GestorGanaderoDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        GestorGanaderoDbContext context,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Email y contraseña son requeridos." });

        _logger.LogInformation("Login attempt for {Email}", request.Email);

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null)
        {
            _logger.LogWarning("User not found for {Email}", request.Email);
            return Unauthorized(new { message = "Credenciales inválidas." });
        }

        bool isPasswordCorrect;
        try
        {
            isPasswordCorrect = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "BCrypt verification error for {Email}", user.Email);
            isPasswordCorrect = false;
        }

        if (!isPasswordCorrect)
        {
            _logger.LogWarning("Invalid password for {Email}", request.Email);
            return Unauthorized(new { message = "Credenciales inválidas." });
        }

        _logger.LogInformation("Successful login for {Email}", request.Email);

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == user.TenantId);

        var token = GenerateJwtToken(user.Id, user.Email, user.Role.ToString(), user.TenantId);

        return Ok(new LoginResponse
        {
            Token = token,
            UserId = user.Id.ToString(),
            Email = user.Email,
            Role = user.Role.ToString(),
            TenantId = user.TenantId.ToString(),
            TenantName = tenant?.Name ?? ""
        });
    }

    private string GenerateJwtToken(Guid userId, string email, string role, Guid tenantId)
    {
        var jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey))
            throw new InvalidOperationException("JWT key is missing.");

        var issuer = _configuration["Jwt:Issuer"] ?? "gestor-ganadero";
        var audience = _configuration["Jwt:Audience"] ?? "gestor-ganadero-client";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
}

