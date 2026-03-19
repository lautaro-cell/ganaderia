using Microsoft.EntityFrameworkCore;
using WebApplication1.Application.Interfaces;
using WebApplication1.Application.Services;
using WebApplication1.Infrastructure.Persistence;
using WebApplication1.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Configurar DbContext con PostgreSQL (Npgsql)
builder.Services.AddDbContext<GestorGanaderoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Registrar IHttpContextAccessor (necesario para el TenantProvider)
builder.Services.AddHttpContextAccessor();

// 3. Registrar el ITenantProvider (Scoped)
builder.Services.AddScoped<ITenantProvider, HttpContextTenantProvider>();

// 4. Registrar los servicios de la capa de aplicación (Scoped)
builder.Services.AddScoped<ITranslationService, TranslationService>();
builder.Services.AddScoped<ILivestockEventService, LivestockEventService>();

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

// Seed database
await app.Services.SeedAsync();

app.Run();
