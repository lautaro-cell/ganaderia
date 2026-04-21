using App.Domain.Common;

namespace App.Domain.Entities;

public class Tenant : BaseAuditableEntity
{
    public required string Name { get; set; }
    public string? GestorMaxDatabaseId { get; set; }
    public string? GestorMaxApiKeyEncrypted { get; set; }
}

