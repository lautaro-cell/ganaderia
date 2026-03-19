using Microsoft.EntityFrameworkCore;
using WebApplication1.Domain.Entities;
using WebApplication1.Domain.Common;
using WebApplication1.Application.Interfaces;

namespace WebApplication1.Infrastructure.Persistence;

public class GestorGanaderoDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public GestorGanaderoDbContext(DbContextOptions<GestorGanaderoDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ExternalCatalog> ExternalCatalogs => Set<ExternalCatalog>();
    public DbSet<EventTemplate> EventTemplates => Set<EventTemplate>();
    public DbSet<LivestockEvent> LivestockEvents => Set<LivestockEvent>();
    public DbSet<AccountingDraft> AccountingDrafts => Set<AccountingDraft>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuración de jsonb para ExternalCatalog.Data (PostgreSQL)
        modelBuilder.Entity<ExternalCatalog>()
            .Property(e => e.Data)
            .HasColumnType("jsonb");

        // Filtro Global de Multi-Tenant
        // Aplicamos el filtro a todas las entidades que tienen TenantId
        
        modelBuilder.Entity<User>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<ExternalCatalog>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<EventTemplate>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<LivestockEvent>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AccountingDraft>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);

        // Configuraciones adicionales de relaciones si fuera necesario
        modelBuilder.Entity<LivestockEvent>()
            .HasMany(e => e.AccountingDrafts)
            .WithOne(e => e.LivestockEvent)
            .HasForeignKey(e => e.LivestockEventId);
            
        // Auditoría automática (opcionalmente configurada aquí o vía Interceptor)
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTimeOffset.UtcNow;
                    // entry.Entity.CreatedBy = ... (del User Context)
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
                    // entry.Entity.UpdatedBy = ... (del User Context)
                    break;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
