using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using App.Domain.Entities;

namespace App.Infrastructure.Persistence.Configurations;

// context7 /dotnet/docs: IEntityTypeConfiguration per entity, registered via ApplyConfigurationsFromAssembly
public class EventTemplateConfiguration : IEntityTypeConfiguration<EventTemplate>
{
    public void Configure(EntityTypeBuilder<EventTemplate> b)
    {
        b.ToTable("EventTemplates");

        b.HasKey(e => e.Id);

        b.Property(e => e.Code)
            .IsRequired()
            .HasMaxLength(50);

        b.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200);

        b.Property(e => e.DebitAccountCode)
            .IsRequired()
            .HasMaxLength(50);

        b.Property(e => e.CreditAccountCode)
            .IsRequired()
            .HasMaxLength(50);

        // Unique: un solo template por tipo de evento por tenant
        b.HasIndex(e => new { e.TenantId, e.EventType })
            .IsUnique()
            .HasDatabaseName("IX_EventTemplate_Tenant_EventType");

        b.HasIndex(e => new { e.TenantId, e.Code })
            .IsUnique()
            .HasDatabaseName("IX_EventTemplate_Tenant_Code");

        // FK explícita hacia Tenant
        b.HasOne(e => e.Tenant)
            .WithMany()
            .HasForeignKey(e => e.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
