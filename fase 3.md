# Fase 3: Lógica Contable Correcta (TranslationService)

**Objetivo**: Refactorizar el servicio de traducción para generar asientos (AccountingDrafts) basados en el tipo de evento y poblar datos físicos (Cabezas/Kg).

## Sprint 3.1: Estructura Base y Par Simple
- **Archivo**: `App.Application/Services/TranslationService.cs`
- **Acción**: 
  - Refactorizar `TranslateEventToDraftAsync` para usar un `switch` por `EventType`.
  - Implementar `BuildSimplePair` para los tipos: Apertura, Nacimiento, Destete, Compra, Venta, Mortandad, Consumo.

## Sprint 3.2: Traslado y AjusteKg
- **Acción**: Implementar métodos privados:
  - `BuildTraslado`: Genera asientos en `ACT001` cruzando `DestinationFieldId`.
  - `BuildAjusteKg`: Lógica direccional según el signo del peso (Debe/Haber).

## Sprint 3.3: Cambio de Actividad y Categoría
- **Acción**: Implementar `BuildCambioActividad` y `BuildCambioCategoria` usando los campos de ID de origen y destino correspondientes.

## Sprint 3.4: Recuento y Metadatos Físicos
- **Acción**:
  - `Recuento`: Debe retornar una lista vacía (no genera asientos).
  - **Crítico**: Asegurar que `MakeDraft` (o el helper similar) pueble `HeadCount` y `WeightKg` en cada draft.

## Sprint 3.5: Validación Unitaria
- **Acción**: Crear o actualizar tests unitarios para verificar que cada tipo de evento genera la cantidad y tipo de asientos correctos (según Sección 6 de `PLAN.MD`).

---
### Checklist de Verificación
- [ ] `TranslationService.cs` soporta los 12 tipos de eventos.
- [ ] `RECUENTO` no genera asientos.
- [ ] Los asientos de `TRASLADO` incluyen los IDs de campo correctos.
- [ ] Todos los `AccountingDraft` tienen `HeadCount` y `WeightKg`.
