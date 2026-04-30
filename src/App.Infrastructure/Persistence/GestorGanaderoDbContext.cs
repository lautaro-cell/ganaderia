using Microsoft.EntityFrameworkCore;
using App.Domain.Entities;
using App.Domain.Common;
using App.Application.Interfaces;
using App.Infrastructure.Persistence.Configurations;
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

    // --- Core ---
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ExternalCatalog> ExternalCatalogs => Set<ExternalCatalog>();
    public DbSet<EventTemplate> EventTemplates => Set<EventTemplate>();
    public DbSet<LivestockEvent> LivestockEvents => Set<LivestockEvent>();
    public DbSet<AccountingDraft> AccountingDrafts => Set<AccountingDraft>();

    // --- Catalog ---
    public DbSet<Field> Fields => Set<Field>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<AnimalCategory> AnimalCategories => Set<AnimalCategory>();
    public DbSet<CategoryMapping> CategoryMappings => Set<CategoryMapping>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<PlanCuenta> PlanesCuenta => Set<PlanCuenta>();
    public DbSet<GestorMaxConfig> GestorMaxConfigs => Set<GestorMaxConfig>();
    public DbSet<ErpConcept> ErpConcepts => Set<ErpConcept>();
    public DbSet<AccountConfiguration> AccountConfigurations => Set<AccountConfiguration>();

    // --- Join tables ---
    public DbSet<ActivityEventType> ActivityEventTypes => Set<ActivityEventType>();
    public DbSet<ActivityAnimalCategory> ActivityAnimalCategories => Set<ActivityAnimalCategory>();
    public DbSet<FieldActivity> FieldActivities => Set<FieldActivity>();
    public DbSet<EventTemplateActivity> EventTemplateActivities => Set<EventTemplateActivity>();
    public DbSet<UserField> UserFields => Set<UserField>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // context7 /dotnet/docs: ApplyConfigurationsFromAssembly registra todos los IEntityTypeConfiguration<T>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EventTemplateConfiguration).Assembly);

        // --- jsonb for ExternalCatalog (PostgreSQL) ---
        modelBuilder.Entity<ExternalCatalog>()
            .Property(e => e.Data)
            .HasColumnType("jsonb");

        // --- ErpConcept ---
        modelBuilder.Entity<ErpConcept>(b =>
        {
            b.HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
            b.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId);
        });

        // --- Decimal precision ---
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
        modelBuilder.Entity<User>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId || _tenantProvider.IsSuperAdmin);
        modelBuilder.Entity<ExternalCatalog>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<EventTemplate>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<LivestockEvent>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AccountingDraft>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<Field>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<GestorMaxConfig>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<CategoryMapping>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AccountConfiguration>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
        // Activity & AnimalCategory: null = global, con TenantId = específica del cliente
        modelBuilder.Entity<Activity>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);
        modelBuilder.Entity<AnimalCategory>().HasQueryFilter(e => e.TenantId == null || e.TenantId == _tenantProvider.TenantId);

        // --- Field precision ---
        modelBuilder.Entity<Field>(b =>
        {
            b.Property(e => e.AreaHectares).HasPrecision(12, 2);
        });

        // --- Join: ActivityAnimalCategory ---
        modelBuilder.Entity<ActivityAnimalCategory>(b =>
        {
            b.HasKey(ac => new { ac.ActivityId, ac.AnimalCategoryId });
            b.HasOne(ac => ac.Activity).WithMany(a => a.ActivityAnimalCategories).HasForeignKey(ac => ac.ActivityId);
            b.HasOne(ac => ac.AnimalCategory).WithMany().HasForeignKey(ac => ac.AnimalCategoryId);
        });

        // --- Join: ActivityEventType ---
        modelBuilder.Entity<ActivityEventType>(b =>
        {
            b.HasKey(ae => new { ae.ActivityId, ae.EventType });
            b.HasOne(ae => ae.Activity).WithMany().HasForeignKey(ae => ae.ActivityId);
        });

        // --- Join: FieldActivity ---
        modelBuilder.Entity<FieldActivity>(b =>
        {
            b.HasKey(fa => new { fa.FieldId, fa.ActivityId });
            b.HasOne(fa => fa.Field).WithMany(f => f.FieldActivities).HasForeignKey(fa => fa.FieldId);
            b.HasOne(fa => fa.Activity).WithMany().HasForeignKey(fa => fa.ActivityId);
        });

        // --- Join: EventTemplateActivity ---
        modelBuilder.Entity<EventTemplateActivity>(b =>
        {
            b.HasKey(eta => new { eta.EventTemplateId, eta.ActivityId });
            b.HasOne(eta => eta.EventTemplate).WithMany(et => et.EventTemplateActivities).HasForeignKey(eta => eta.EventTemplateId);
            b.HasOne(eta => eta.Activity).WithMany().HasForeignKey(eta => eta.ActivityId);
        });

        // --- Join: UserField ---
        modelBuilder.Entity<UserField>(b =>
        {
            b.HasKey(uf => new { uf.UserId, uf.FieldId });
            b.HasOne(uf => uf.User).WithMany(u => u.UserFields).HasForeignKey(uf => uf.UserId);
            b.HasOne(uf => uf.Field).WithMany().HasForeignKey(uf => uf.FieldId);
        });

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
            b.HasOne(d => d.Field).WithMany().HasForeignKey(d => d.FieldId).IsRequired(false);
            b.HasOne(d => d.Activity).WithMany().HasForeignKey(d => d.ActivityId).IsRequired(false);
            b.HasOne(d => d.Category).WithMany().HasForeignKey(d => d.CategoryId).IsRequired(false);
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
