# Módulo 2 — Configuración contable de eventos

## Objetivo
Hacer que cada tipo de evento sea configurable por tenant y gobierne el motor contable.

## Alcance
- EventType
- EventTemplate
- relación entre ambos
- cuentas DEBE/HABER configurables
- actividades permitidas por tipo de evento

## Orden de implementación

### Tarea 2.1 — Revisar y alinear modelo de dominio
**Objetivo:** definir con claridad qué representa `EventType` y qué representa `EventTemplate`.

**Archivos permitidos:**
- entidades de dominio
- mappings EF Core
- DTOs estrictamente necesarios

**Cambios esperados:**
- `EventType` como catálogo funcional del evento
- `EventTemplate` como configuración contable/operativa asociada
- FK explícita entre ambas entidades
- propiedades de cuentas contables correctamente mapeadas

**Criterios de aceptación:**
- modelo consistente
- sin duplicidad ambigua de responsabilidades
- sin propiedades legacy activas que induzcan errores

---

### Tarea 2.2 — Migración BD de relaciones faltantes
**Objetivo:** soportar reglas por actividad y categorías.

**Migraciones requeridas:**
- `ActivityAnimalCategories`
- `ActivityEventTypes`
- ajustes de columnas contables en `EventTemplate`
- opcionalmente `AuditLogs` si se decide dejar preparado

**Criterios de aceptación:**
- migración reversible
- índices y FK correctas
- naming consistente

---

### Tarea 2.3 — Backend para selector de cuentas ERP
**Objetivo:** exponer cuentas del ERP para configurar tipos de evento.

**Archivos permitidos:**
- servicios de aplicación
- provider Gestor Max
- contracts / proto / DTOs necesarios

**Cambios esperados:**
- endpoint/caso de uso para listar plan de cuentas del tenant
- respuesta apta para selector
- validación de tenant configurado

**Criterios de aceptación:**
- retorna cuentas reales del ERP
- maneja error de conectividad
- no usa cuentas mockeadas en producción

---

### Tarea 2.4 — Validación de configuración contable
**Objetivo:** evitar configuraciones inválidas.

**Reglas mínimas:**
- cuenta DEBE obligatoria
- cuenta HABER obligatoria
- DEBE != HABER
- tipo de operación obligatorio
- actividad aplicable definida cuando corresponda

**Criterios de aceptación:**
- no se puede guardar configuración inconsistente
- errores claros para UI

## Definición de terminado del módulo
- EventType y EventTemplate quedaron alineados
- existen relaciones Activity ↔ EventType y Activity ↔ Category
- el sistema puede consultar cuentas ERP
- la configuración contable del evento es validable
