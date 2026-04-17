using App.Domain.Common;

namespace App.Domain.Enums;

/// <summary>
/// Distingue entre categorías propias del cliente y categorías del ERP GestorMax.
/// </summary>
public enum CategoryType
{
    Cliente = 1,   // Categoría definida por el cliente
    Gestor = 2    // Categoría sincronizada desde GestorMax
}

