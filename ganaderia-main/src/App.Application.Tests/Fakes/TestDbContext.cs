using Microsoft.EntityFrameworkCore;
using App.Application.Interfaces;
using App.Domain.Entities;

namespace App.Application.Tests.Fakes;

public class TestDbContext : DbContext, IApplicationDbContext
{
    public TestDbContext(DbContextOptions<TestDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ExternalCatalog> ExternalCatalogs => Set<ExternalCatalog>();
    public DbSet<EventTemplate> EventTemplates => Set<EventTemplate>();
    public DbSet<LivestockEvent> LivestockEvents => Set<LivestockEvent>();
    public DbSet<AccountingDraft> AccountingDrafts => Set<AccountingDraft>();
    public DbSet<Field> Fields => Set<Field>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<AnimalCategory> AnimalCategories => Set<AnimalCategory>();
    public DbSet<CategoryMapping> CategoryMappings => Set<CategoryMapping>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<PlanCuenta> PlanesCuenta => Set<PlanCuenta>();
    public DbSet<GestorMaxConfig> GestorMaxConfigs => Set<GestorMaxConfig>();
    public DbSet<ErpConcept> ErpConcepts => Set<ErpConcept>();
    public DbSet<AccountConfiguration> AccountConfigurations => Set<AccountConfiguration>();
    public DbSet<ActivityEventType> ActivityEventTypes => Set<ActivityEventType>();
    public DbSet<ActivityAnimalCategory> ActivityAnimalCategories => Set<ActivityAnimalCategory>();
    public DbSet<FieldActivity> FieldActivities => Set<FieldActivity>();
    public DbSet<EventTemplateActivity> EventTemplateActivities => Set<EventTemplateActivity>();
    public DbSet<UserField> UserFields => Set<UserField>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // JsonDocument cannot be mapped by InMemory provider
        modelBuilder.Entity<ExternalCatalog>().Ignore(e => e.Data);

        // PK compuestas para las join tables (requerido por InMemory validator)
        modelBuilder.Entity<ActivityEventType>()
            .HasKey(e => new { e.ActivityId, e.EventType });

        modelBuilder.Entity<ActivityAnimalCategory>()
            .HasKey(e => new { e.ActivityId, e.AnimalCategoryId });

        modelBuilder.Entity<FieldActivity>()
            .HasKey(e => new { e.FieldId, e.ActivityId });

        modelBuilder.Entity<EventTemplateActivity>()
            .HasKey(e => new { e.EventTemplateId, e.ActivityId });

        modelBuilder.Entity<UserField>()
            .HasKey(e => new { e.UserId, e.FieldId });
    }
}
