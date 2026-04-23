using System.ComponentModel.DataAnnotations;
using App.Domain.Enums;

namespace App.Application.DTOs;

// context7 /dotnet/blazor-samples: DataAnnotations para validación de modelo en formularios
public class SaveAccountConfigurationCommand
{
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "El tenant es obligatorio.")]
    public Guid TenantId { get; set; }

    [Required(ErrorMessage = "El tipo de evento es obligatorio.")]
    public EventType EventType { get; set; }

    [Required(ErrorMessage = "La cuenta DEBE es obligatoria.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "La cuenta DEBE debe tener entre 1 y 50 caracteres.")]
    public string DebitAccountCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "La cuenta HABER es obligatoria.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "La cuenta HABER debe tener entre 1 y 50 caracteres.")]
    public string CreditAccountCode { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }
}
