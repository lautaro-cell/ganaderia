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

    // --- Original DbSets ---
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ExternalCatalog> ExternalCatalogs => Set<ExternalCatalog>();
    public DbSet<EventTemplate> EventTemplates => Set<EventTemplate>();
    public DbSet<LivestockEvent> LivestockEvents => Set<LivestockEvent>();
    public DbSet<AccountingDraft> AccountingDrafts => Set<AccountingDraft>();

    // --- New DbSets (migrated from Node.js) ---
    public DbSet<Field> Fields => Set<Field>();
    public DbSet<Lote> Lotes => Set<Lote>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<AnimalCategory> AnimalCategories => Set<AnimalCategory>();
    public DbSet<GestorMaxConfig> GestorMaxConfigs => Set<GestorMaxConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- jsonb for ExternalCatalog (PostgreSQL) ---
        modelBuilder.Entity<ExternalCatalog>()
            .Property(e => e.Data)
            .HasColumnType("jsonb");

        // --- Decimal precision: HasPrecision(18, 2) for all numeric fields ---
        modelBuilder.Entity<AccountingDraft>(b =>
        {
            b.Property(e => e.DebitAmount).HasPrecision(18, 2);
            b.Property(e => e.CreditAmount).HasPrecision(18, 2);
            b.Property(e => e.WeightKg).HasPrecision(12, 2);
            b.Property(e => e.WeightPerHead).HasPrecision(10, 2);
        });

        modelBuilder.Entity<LivestockEvent>(b =>
        {
            b.Property(e => e.EstimatedWeightKg).HasPrecision(12, 2);
            b.Property(e => e.TotalAmount).HasPrecision(18, 2);
            b.Property(e => e.WeightPerHead).HasPrecision(10, 2);
        });

        modelBuilder.Entity<AnimalCategory>(b =>
        {
            b.Property(e => e.StandardWeightKg).HasPrecision(10, 2);
        });

        // --- Multi-tenant Global Query Filters ---
        modelBuilder.Entity<User>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<ExternalCatalog>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<EventTemplate>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<LivestockEvent>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AccountingDraft>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<Field>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<Lote>().HasQueryFilter(e => e.Field.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<GestorMaxConfig>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        // Activity & AnimalCategory support null TenantId (global), so we filter only tenant-specific or global
        modelBuilder.Entity<Activity>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AnimalCategory>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);

        // --- Relationships ---
        modelBuilder.Entity<LivestockEvent>()
            .HasMany(e => e.AccountingDrafts)
            .WithOne(e => e.LivestockEvent)
            .HasForeignKey(e => e.LivestockEventId);

        modelBuilder.Entity<LivestockEvent>()
            .HasOne(e => e.Field)
            .WithMany(f => f.LivestockEvents)
            .HasForeignKey(e => e.FieldId)
            .IsRequired(false);

        modelBuilder.Entity<AnimalCategory>()
            .HasOne(c => c.Activity)
            .WithMany(a => a.AnimalCategories)
            .HasForeignKey(c => c.ActivityId);

        // Many-to-many between Lote and Activity
        modelBuilder.Entity<Lote>()
            .HasMany(l => l.Activities)
            .WithMany(); 
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTimeOffset.UtcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
                    break;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
