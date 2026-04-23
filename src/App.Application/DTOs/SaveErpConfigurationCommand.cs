using System.ComponentModel.DataAnnotations;

namespace App.Application.DTOs;

public class SaveErpConfigurationCommand
{
    [Required(ErrorMessage = "El tenant es obligatorio.")]
    public Guid TenantId { get; set; }

    [Required(ErrorMessage = "La razón social es obligatoria.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "La razón social debe tener entre 2 y 200 caracteres.")]
    public string TenantName { get; set; } = string.Empty;

    // Empty = keep existing key; required only for new configs (validated in service)
    public string? ApiKey { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El Database ID debe ser un número positivo.")]
    public int GestorDatabaseId { get; set; }

    [Required(ErrorMessage = "La URL base es obligatoria.")]
    [Url(ErrorMessage = "La URL base no es válida. Ejemplo: https://api.gestormax.com")]
    public string BaseUrl { get; set; } = "https://api.gestormax.com";
}
