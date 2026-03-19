using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using WebApplication1.Domain.Entities;
using WebApplication1.Domain.Enums;

namespace WebApplication1.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    private static readonly Guid DemoTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public static async Task SeedAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<GestorGanaderoDbContext>();

        // Crear base de datos si no existe
        await context.Database.EnsureCreatedAsync();

        // Verificar si hay datos ignorando filtros de Tenant
        if (await context.EventTemplates.IgnoreQueryFilters().AnyAsync())
        {
            return; // Ya hay datos, no re-poblar
        }

        // 1. Insertar Tenant
        var tenant = new Tenant
        {
            Id = DemoTenantId,
            Name = "Ganadería Demo",
            ErpTenantId = "tenant_demo",
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Tenants.Add(tenant);

        // 2. Insertar Catálogos Externos (jsonb)
        var catalogData = new
        {
            Accounts = new[]
            {
                new { Code = "11010010", Description = "Existencia de Hacienda" },
                new { Code = "41010010", Description = "Producción Ganadera" }
            },
            CostCenters = new[]
            {
                new { Id = "CC-001", Name = "Lote Norte - Cría" }
            }
        };

        var catalog = new ExternalCatalog
        {
            TenantId = DemoTenantId,
            CatalogType = CatalogType.PlanCuentas,
            Data = JsonDocument.Parse(JsonSerializer.Serialize(catalogData)),
            LastSyncedAt = DateTimeOffset.UtcNow
        };
        context.ExternalCatalogs.Add(catalog);

        // 3. Insertar Plantilla de Evento
        var template = new EventTemplate
        {
            TenantId = DemoTenantId,
            Name = "Nacimiento de Terneros",
            EventType = EventType.Nacimiento, // Using Nacimiento as requested in step1.md, or Alta if preferred. Seed.md says EventType.Alta but mine has Birth-like enums.
            DebitAccountCode = "11010010",
            CreditAccountCode = "41010010",
            IsActive = true
        };
        context.EventTemplates.Add(template);

        // 4. Insertar Evento Operativo en Draft
        var livestockEvent = new LivestockEvent
        {
            TenantId = DemoTenantId,
            EventTemplate = template,
            CostCenterCode = "CC-001",
            HeadCount = 15,
            EstimatedWeightKg = 900,
            TotalAmount = 450000,
            Status = LivestockEventStatus.Draft,
            EventDate = DateTimeOffset.UtcNow
        };
        context.LivestockEvents.Add(livestockEvent);

        await context.SaveChangesAsync();
    }
}
