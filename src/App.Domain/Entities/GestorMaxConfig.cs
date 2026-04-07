using App.Domain.Common;

namespace App.Domain.Entities;

/// <summary>
/// Configuración de integración con GestorMax por Tenant.
/// Almacena las credenciales de la API de forma encriptada.
/// Equivale a la tabla 'empresa_gestor_config' del sistema Node.js original.
/// </summary>
public class GestorMaxConfig : BaseAuditableEntity
{
    public Guid TenantId { get; set; }
    public int GestorDatabaseId { get; set; }

    /// <summary>API Key encriptada con AES-256-GCM (formato: iv.tag.payload en base64).</summary>
    public string ApiKeyEncrypted { get; set; } = string.Empty;

    /// <summary>Últimos 4 caracteres de la API Key en claro, para mostrar en UI.</summary>
    public string ApiKeyLast4 { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = "https://api.gestormax.com";
    public bool IsEnabled { get; set; } = true;

    public DateTimeOffset? LastTestedAt { get; set; }
    public bool? LastTestOk { get; set; }
    public string? LastTestError { get; set; }

    public Tenant? Tenant { get; set; }
}

