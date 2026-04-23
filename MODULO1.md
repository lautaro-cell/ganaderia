  # Módulo 1 — Motor contable

## Objetivo
Eliminar lógica hardcodeada y garantizar integridad contable en cada evento.

## Alcance
- TranslationService
- generación de AccountingDrafts
- validación DEBE = HABER
- auditoría mínima de generación

## Problemas detectados
- cuentas hardcodeadas en TranslationService
- no existe validación post-generación del asiento
- no hay registro mínimo de auditoría técnica del resultado

## Orden de implementación

### Tarea 1.1 — Reemplazar cuentas hardcodeadas
**Objetivo:** eliminar cualquier código de cuenta literal del motor.

**Archivos permitidos:**
- `TranslationService.cs`
- entidades/modelos estrictamente necesarios para resolver `EventTemplate` o `EventType`

**Cambios esperados:**
- reemplazar cuentas fijas por `DebitAccountCode` y `CreditAccountCode` configurados
- la resolución debe depender del tenant y del tipo/template del evento
- no introducir valores por defecto silenciosos

**No tocar:**
- UI
- reporting
- páginas Blazor
- migraciones

**Criterios de aceptación:**
- no quedan cuentas contables hardcodeadas
- todo asiento toma cuentas desde configuración
- si faltan cuentas configuradas, falla con error explícito

---

### Tarea 1.2 — Validación DEBE = HABER
**Objetivo:** impedir persistencia de asientos descuadrados.

**Archivos permitidos:**
- `TranslationService.cs`
- servicio/aplicación que persiste el evento si resulta necesario

**Cambios esperados:**
- sumar `DebitAmount`
- sumar `CreditAmount`
- aplicar tolerancia decimal
- lanzar excepción de dominio o resultado inválido si no balancea

**Criterios de aceptación:**
- ningún evento se guarda con asiento descuadrado
- el error incluye diferencia y totales calculados
- el mensaje es apto para log y diagnóstico

---

### Tarea 1.3 — Tests unitarios del motor
**Objetivo:** cubrir casos críticos con pruebas pequeñas y determinísticas.

**Casos mínimos:**
- traslado entre campos
- cambio de actividad
- ajuste positivo
- ajuste negativo

**Cada test debe validar:**
- cuentas usadas
- montos
- signo correcto
- balance final
- referencias relevantes del evento

**Criterios de aceptación:**
- tests aislados
- sin dependencias de UI
- sin acceso real a ERP

---

### Tarea 1.4 — Auditoría mínima de generación
**Objetivo:** registrar el resultado de traducción del evento.

**Campos mínimos sugeridos:**
- tenant
- usuario
- tipo de evento
- fecha/hora
- total debe
- total haber
- estado: `OK` / `ERROR`
- detalle breve

**No tocar:**
- reportes de auditoría UI
- exportaciones

**Criterios de aceptación:**
- cada intento de generación deja rastro
- los errores quedan trazables

## Definición de terminado del módulo
- no hay cuentas hardcodeadas
- existe validación DEBE = HABER
- hay tests para casos críticos
- existe auditoría mínima técnica
  