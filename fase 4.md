# Fase 4: Balance y Mayor Correctos

**Objetivo**: Asegurar que los reportes reflejen los asientos contables y actualizar la interfaz de usuario en Blazor.

## Sprint 4.1: Refactorizar GetBalanceAsync
- **Archivo**: `App.Application/Services/ReportService.cs`
- **Acción**: Cambiar la consulta base de `LivestockEvents` a `AccountingDrafts`.
- **Lógica**: Agrupar por `AccountCode` y sumar saldos (Debe/Haber). Ver Sección 3.4 de `PLAN.MD`.

## Sprint 4.2: DTOs y Protobuf
- **Archivos**: `App.Shared/Dtos/BalanceItemDto.cs` y archivos `.proto` de reporting.
- **Acción**: Extender `BalanceItemDto` con los campos: `AccountCode`, `DebitTotal`, `CreditTotal` y `NetBalance`.

## Sprint 4.3: Interfaz de Balance (UI)
- **Archivo**: `App.Client/Pages/Balance.razor`
- **Acción**: Actualizar la tabla para mostrar las nuevas columnas de código de cuenta y saldos contables.

## Sprint 4.4: Filtros y Ordenamiento
- **Acción**: 
  - Conectar los filtros de fecha (`startDate`, `endDate`) del frontend al backend gRPC.
  - Corregir `GetLedgerAsync` para que ordene los movimientos por `EventDate` (NodaTime Instant).

---
### Checklist de Verificación
- [ ] El balance agrupa por cuenta contable.
- [ ] La UI muestra `NetBalance = DebitTotal - CreditTotal`.
- [ ] Los filtros de fecha funcionan y recargan los datos.
- [ ] El mayor está ordenado cronológicamente por fecha de evento.
