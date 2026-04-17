using Microsoft.EntityFrameworkCore;
using App.Domain.Entities;
using App.Domain.Common;
using App.Application.Interfaces;
using NodaTime;

namespace App.Infrastructure.Persistence;

public class GestorGanaderoDbContext : DbContext, IApplicationDbContext
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
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<AnimalCategory> AnimalCategories => Set<AnimalCategory>();
    public DbSet<CategoryMapping> CategoryMappings => Set<CategoryMapping>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<PlanCuenta> PlanesCuenta => Set<PlanCuenta>();
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
        modelBuilder.Entity<GestorMaxConfig>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<CategoryMapping>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        // Activity & AnimalCategory support null TenantId (global), so we filter only tenant-specific or global
        modelBuilder.Entity<Activity>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AnimalCategory>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);

        // --- Relationships ---
        modelBuilder.Entity<LivestockEvent>()
            .HasMany(e => e.AccountingDrafts)
            .WithOne(e => e.LivestockEvent)
            .HasForeignKey(e => e.LivestockEventId);

        modelBuilder.Entity<LivestockEvent>()
            .HasOne(c => c.Category)
            .WithMany()
            .HasForeignKey(c => c.CategoryId)
            .IsRequired(false);

        modelBuilder.Entity<AccountingDraft>(b =>
        {
            b.HasOne(d => d.Field)
                .WithMany()
                .HasForeignKey(d => d.FieldId)
                .IsRequired(false);
            
            b.HasOne(d => d.Activity)
                .WithMany()
                .HasForeignKey(d => d.ActivityId)
                .IsRequired(false);
            
            b.HasOne(d => d.Category)
                .WithMany()
                .HasForeignKey(d => d.CategoryId)
                .IsRequired(false);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = SystemClock.Instance.GetCurrentInstant();
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = SystemClock.Instance.GetCurrentInstant();
                    break;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}

