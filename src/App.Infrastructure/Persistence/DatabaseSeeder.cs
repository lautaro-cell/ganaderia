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
                logger.LogInformation("Seeding: Creating default Tenant and Admin user...");

                var tenant = new Tenant
                {
                    Id = Guid.NewGuid(),
                    Name = "Ganadería Demo"
                };

                context.Tenants.Add(tenant);

                var adminUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = "admin@ganaderia.com",
                    Name = "Administrador",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = UserRole.Admin,
                    TenantId = tenant.Id,
                    IsActive = true
                };

                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
                
                logger.LogInformation("Seeding successful: admin@ganaderia.com / admin123 created.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during database seeding.");
            throw;
        }
    }
}
