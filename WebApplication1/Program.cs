using Microsoft.EntityFrameworkCore;
using WebApplication1.Application.Interfaces;
using WebApplication1.Application.Services;
using WebApplication1.Infrastructure.Persistence;
using WebApplication1.Infrastructure.Services;
using WebApplication1.Infrastructure.ExternalProviders;
using WebApplication1.Grpc;

var builder = WebApplication.CreateBuilder(args);

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

// 4.1. Registrar servicios de sincronización
builder.Services.AddScoped<ISyncCatalogService, SyncCatalogService>();
builder.Services.AddHttpClient<IERPProvider, GestorMaxProvider>();

// 4.2. Motor de reglas contables (Domain Service)
builder.Services.AddTransient<WebApplication1.Domain.Services.AccountingEntryGenerator>();

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

app.UseHttpsRedirection();

app.UseCors("BlazorPolicy");

app.UseGrpcWeb();

app.UseAuthorization();

app.MapControllers();

app.MapGrpcService<LivestockServiceImplementation>()
   .EnableGrpcWeb()
   .RequireCors("BlazorPolicy");
await app.Services.SeedAsync();

app.Run();
