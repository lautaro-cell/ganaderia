using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using App.Application.Interfaces;
using App.Application.Services;
using App.Infrastructure.Persistence;
using App.Infrastructure.Services;
using App.Infrastructure.ExternalProviders;
using GestorGanadero.Server.Grpc;
using GestorGanadero.Server.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Kestrel usa configuración por defecto (http://localhost:5000 / https://localhost:5001)
// builder.WebHost.ConfigureKestrel(options =>
// {
//     options.ListenLocalhost(5073, o => o.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2);
// });

builder.Services.AddCors(options => {
    options.AddPolicy("BlazorPolicy", policy => {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding");
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "GestorGanaderoSecretKey2024!MustBeLongEnough"))
    };
});

builder.Services.AddAuthorization();

builder.Services.AddDbContext<GestorGanaderoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"), o => o.UseNodaTime()));

builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<GestorGanaderoDbContext>());

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();
builder.Services.AddScoped<ITranslationService, TranslationService>();
builder.Services.AddScoped<ILivestockEventService, LivestockEventService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ISyncCatalogService, SyncCatalogService>();
builder.Services.AddScoped<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<IErpSyncService, ErpSyncService>();
builder.Services.AddScoped<IAccountConfigurationService, AccountConfigurationService>();
builder.Services.AddScoped<IErpAccountQueryService, ErpAccountQueryService>();
builder.Services.AddScoped<ICompanyConfigurationService, CompanyConfigurationService>();
builder.Services.AddHttpClient<IErpConnectivityService, ErpConnectivityService>();
builder.Services.AddHttpClient<IERPProvider, GestorMaxProvider>();
builder.Services.AddTransient<App.Domain.Services.AccountingEntryGenerator>();

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
builder.Services.AddAntiforgery();
builder.Services.AddOpenApi();

var app = builder.Build();

await app.MigrateDatabaseAsync();

if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
    app.MapOpenApi();
    app.MapGrpcReflectionService();
}
else
{
    // app.UseHttpsRedirection(); // Deshabilitado: se usa HTTP para desarrollo
}

app.UseBlazorFrameworkFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseAntiforgery();
app.UseCors("BlazorPolicy");
app.UseGrpcWeb();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGrpcService<IdentityServiceImplementation>().RequireAuthorization().EnableGrpcWeb();
app.MapGrpcService<CatalogServiceImplementation>().RequireAuthorization().EnableGrpcWeb();
app.MapGrpcService<OperationsServiceImplementation>().RequireAuthorization().EnableGrpcWeb();
app.MapGrpcService<ReportingServiceImplementation>().RequireAuthorization().EnableGrpcWeb();
app.MapGrpcService<SyncServiceImplementation>().RequireAuthorization().EnableGrpcWeb();

app.MapGet("/health", () => new { status = "ok" });
app.MapFallbackToFile("index.html");

await app.Services.SeedAsync();
app.Run();
