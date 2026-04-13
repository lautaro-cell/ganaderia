using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.IO;

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
            // 1. Aplicar migraciones pendientes
            await context.Database.MigrateAsync();
            logger.LogInformation("Migraciones aplicadas correctamente.");

            // 2. Limpiar base de datos (Reset)
            await context.Database.ExecuteSqlRawAsync(@"
                TRUNCATE TABLE ""AccountingDrafts"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""LivestockEvents"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""EventTemplates"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""Lotes"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""AnimalCategories"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""Activities"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""Fields"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""Users"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""Tenants"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""ExternalCatalogs"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""GestorMaxConfigs"" RESTART IDENTITY CASCADE;
                TRUNCATE TABLE ""ActivityLote"" RESTART IDENTITY CASCADE;
            ");
            logger.LogInformation("Tablas vaciadas (TRUNCATE CASCADE).");

            // 3. Buscar y ejecutar data.sql
            var searchPaths = new List<string>
            {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "sql", "data.sql"), // Dev fallback
                Path.Combine(Directory.GetCurrentDirectory(), "sql", "data.sql"),                        // Relative to project root
                Path.Combine(Directory.GetCurrentDirectory(), "GestorGanadero.Server", "sql", "data.sql"),      // Relative to parent
                "sql/data.sql",
                "data.sql",
                @"c:\Users\HWLScuffi\Desktop\ganaderia\GestorGanadero.Server\sql\data.sql"                    // Absolute fallback
            };

            string? foundPath = null;
            foreach (var path in searchPaths)
            {
                if (File.Exists(path))
                {
                    foundPath = path;
                    break;
                }
            }

            if (foundPath != null)
            {
                logger.LogInformation("Ejecutando seed desde: {Path}", foundPath);
                string sql = await File.ReadAllTextAsync(foundPath);
                
                // Usamos ADO.NET directo para evitar problemas de EF con los caracteres '{' y '}' en el JSON del SQL
                var connection = context.Database.GetDbConnection();
                await connection.OpenAsync();
                using var command = connection.CreateCommand();
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync();
                
                logger.LogInformation("Seed SQL ejecutado con éxito.");
            }
            else
            {
                logger.LogWarning("No se encontró el archivo data.sql en ninguna de las rutas buscadas.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error durante el seeding de la base de datos.");
            throw;
        }
    }
}

