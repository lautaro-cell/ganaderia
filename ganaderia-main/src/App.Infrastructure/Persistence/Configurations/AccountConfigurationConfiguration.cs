using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using App.Domain.Entities;

namespace App.Infrastructure.Persistence.Configurations;

public class AccountConfigurationConfiguration : IEntityTypeConfiguration<AccountConfiguration>
{
    public void Configure(EntityTypeBuilder<AccountConfiguration> b)
    {
        b.ToTable("AccountConfigurations");

        b.HasKey(e => e.Id);

        b.Property(e => e.DebitAccountCode)
            .IsRequired()
            .HasMaxLength(50);

        b.Property(e => e.CreditAccountCode)
            .IsRequired()
            .HasMaxLength(50);

        b.Property(e => e.Description)
            .HasMaxLength(500);

        // Unique: una sola configuración contable por tipo de evento por tenant
        b.HasIndex(e => new { e.TenantId, e.EventType })
            .IsUnique()
            .HasDatabaseName("IX_AccountConfig_Tenant_EventType");

        b.HasOne(e => e.Tenant)
            .WithMany()
            .HasForeignKey(e => e.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
