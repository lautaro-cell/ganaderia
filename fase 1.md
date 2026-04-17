# Fase 1: Correcciones de Compilación (Urgente)

**Objetivo**: Lograr que la solución compile sin errores corrigiendo el uso de NodaTime.

## Sprint 1.1: Corregir NodaTime
- **Archivo**: `App.Application/Services/SyncCatalogService.cs`
- **Error**: `'Instant' no contiene una definición para 'UtcNow'` (líneas 39 y 49).
- **Acción**: Reemplazar `Instant.UtcNow` por `SystemClock.Instance.GetCurrentInstant()`.

```csharp
// Antes
existingCatalog.LastSyncedAt = Instant.UtcNow;
// Después
existingCatalog.LastSyncedAt = SystemClock.Instance.GetCurrentInstant();
```

## Sprint 1.2: Verificación de Build
- **Acción**: Ejecutar `dotnet build` en la raíz del proyecto.
- **Resultado esperado**: 0 errores de compilación.

---
### Checklist de Verificación
- [ ] `SyncCatalogService.cs` actualizado.
- [ ] `dotnet build` exitoso.
