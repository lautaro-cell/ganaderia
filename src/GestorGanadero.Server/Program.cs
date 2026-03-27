using Microsoft.EntityFrameworkCore;
using GestorGanadero.Server.Application.Interfaces;
using GestorGanadero.Server.Application.Services;
using GestorGanadero.Server.Infrastructure.Persistence;
using GestorGanadero.Server.Infrastructure.Services;
using GestorGanadero.Server.Infrastructure.ExternalProviders;
using GestorGanadero.Server.Grpc;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    // Permitir HTTP/1 y HTTP/2 en el puerto 5073 para navegación y gRPC
    options.ListenLocalhost(5073, o => o.Protocols = Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2);
    // Puerto HTTPS normal
    options.ListenLocalhost(7240, o => o.UseHttps());
});

builder.Services.AddCors(options => {
    options.AddPolicy("BlazorPolicy", policy => {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding");
    });
});

builder.Services.AddDbContext<GestorGanaderoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();

builder.Services.AddScoped<ITranslationService, TranslationService>();
builder.Services.AddScoped<ILivestockEventService, LivestockEventService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<ILoteService, LoteService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IReportService, ReportService>();

// 4.1. Registrar servicios de sincronización
builder.Services.AddScoped<ISyncCatalogService, SyncCatalogService>();
builder.Services.AddHttpClient<IERPProvider, GestorMaxProvider>();

// 4.2. Motor de reglas contables (Domain Service)
builder.Services.AddTransient<GestorGanadero.Server.Domain.Services.AccountingEntryGenerator>();

builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapGrpcReflectionService();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("BlazorPolicy");

app.UseBlazorFrameworkFiles();
app.UseStaticFiles();
app.UseGrpcWeb();

app.UseAuthorization();

app.MapControllers();

app.MapGrpcService<LivestockServiceImplementation>()
   .EnableGrpcWeb()
   .RequireCors("BlazorPolicy");

app.MapFallbackToFile("index.html");

await app.Services.SeedAsync();

app.Run();
