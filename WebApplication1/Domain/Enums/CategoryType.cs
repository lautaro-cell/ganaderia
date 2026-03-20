using WebApplication1.Domain.Common;

namespace WebApplication1.Domain.Enums;

/// <summary>
/// Distingue entre categorías propias del cliente y categorías del ERP GestorMax.
/// </summary>
public enum CategoryType
{
    Client = 1,   // Categoría definida por el cliente
    Gestor = 2    // Categoría sincronizada desde GestorMax
}
