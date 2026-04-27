using App.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestorGanadero.Server.Extensions;

public static class DatabaseMigrationExtensions
{
    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment() && !app.Environment.IsStaging())
            return;

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GestorGanaderoDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<GestorGanaderoDbContext>>();

        try
        {
            await db.Database.MigrateAsync();
            logger.LogInformation("Pending migrations applied successfully.");
        }
        catch (Exception ex)
        {
            logger.LogCritical(ex, "Database migration failed. Application startup aborted.");
            throw;
        }
    }
}
