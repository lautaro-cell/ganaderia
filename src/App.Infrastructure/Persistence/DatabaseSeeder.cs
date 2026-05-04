using App.Domain.Entities;
using App.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace App.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<GestorGanaderoDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<GestorGanaderoDbContext>>();

        try
        {
            if (!await context.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == "admin@ganaderia.com"))
            {
                logger.LogInformation("Seeding: creando Tenant Demo y Admin...");

                var defaultTenant = new Tenant
                {
                    Id = Guid.NewGuid(),
                    Name = "Ganadería Demo"
                };
                context.Tenants.Add(defaultTenant);

                var adminUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = "admin@ganaderia.com",
                    Name = "Administrador",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = UserRole.Admin,
                    TenantId = defaultTenant.Id,
                    IsActive = true
                };
                context.Users.Add(adminUser);

                await context.SaveChangesAsync();
                logger.LogInformation("Admin y tenant creados: admin@ganaderia.com / admin123");
            }
            else
            {
                logger.LogInformation("Admin ya existe, se omite seed de admin.");
            }

            var existsSuperAdmin = await context.Users.IgnoreQueryFilters()
                .AnyAsync(u => u.Email == "superadmin@ganaderia.com");

            if (!existsSuperAdmin)
            {
                logger.LogInformation("Seeding: creando SuperAdmin...");

                var superTenant = await context.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Name == "Ganadería Demo");

                var superAdminUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = "superadmin@ganaderia.com",
                    Name = "Super Administrador",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("superadmin123"),
                    Role = UserRole.SuperAdmin,
                    TenantId = superTenant?.Id ?? Guid.NewGuid(),
                    IsActive = true
                };
                context.Users.Add(superAdminUser);

                await context.SaveChangesAsync();
                logger.LogInformation("SuperAdmin creado: superadmin@ganaderia.com / superadmin123");
            }
            else
            {
                logger.LogInformation("SuperAdmin ya existe, se omite seed.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error durante el seed de base de datos.");
            throw;
        }
    }
}
