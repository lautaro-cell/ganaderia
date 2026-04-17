# Fase 2: Dominio Completo y Base de Datos

**Objetivo**: Asegurar que el modelo de dominio represente correctamente todos los eventos y soporte la lógica contable extendida.

## Sprint 2.1: Actualizar EventType
- **Archivo**: `App.Domain/Enums/EventType.cs`
- **Acción**: Reemplazar con el enum completo de 12 valores.

```csharp
public enum EventType
{
    Apertura, Nacimiento, Destete, Compra, Venta, Mortandad, 
    Consumo, Traslado, CambioActividad, CambioCategoria, AjusteKg, Recuento
}
```

## Sprint 2.2: Campos en LivestockEvent
- **Archivo**: `App.Domain/Entities/LivestockEvent.cs`
- **Acción**: Agregar los siguientes campos para soportar eventos especiales:
  - `public Guid? DestinationFieldId { get; set; }`
  - `public Guid? OriginCategoryId { get; set; }`
  - `public Guid? DestinationCategoryId { get; set; }`
  - `public Guid? OriginActivityId { get; set; }`
  - `public Guid? DestinationActivityId { get; set; }`

## Sprint 2.3: Migración de Base de Datos
- **Acción**: 
  1. Ejecutar `dotnet ef migrations add AddEventTypeFields --project App.Infrastructure --startup-project App.Server`
  2. Aplicar: `dotnet ef database update --project App.Infrastructure --startup-project App.Server`

---
### Checklist de Verificación
- [ ] `EventType.cs` tiene 12 valores.
- [ ] `LivestockEvent.cs` tiene los nuevos campos Guid?.
- [ ] Migración aplicada exitosamente.
