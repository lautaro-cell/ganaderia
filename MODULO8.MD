# Módulo 8 — Performance y arquitectura

## Objetivo
Reducir latencia, evitar cargas innecesarias y robustecer streaming/paginación.

## Alcance
- caché de catálogos
- paginación de eventos
- streaming gRPC del Mayor
- retries controlados
- cancelación correcta

## Orden de implementación

### Tarea 8.1 — Caché de catálogos en cliente
**Objetivo:** evitar llamadas repetidas al montar páginas.

**Catálogos mínimos:**
- fields
- categories
- activities
- event types

**Reglas:**
- TTL de 5 minutos
- invalidación al guardar cambios en administración

**Criterios de aceptación:**
- menos llamadas repetidas
- datos consistentes tras invalidación

---

### Tarea 8.2 — Paginación de eventos
**Objetivo:** evitar cargas masivas O(N).

**Cambios esperados:**
- `page_index`
- `page_size`
- contador de resultados
- opción de rango de fechas

**Criterios de aceptación:**
- la página ya no carga todos los eventos indiscriminadamente

---

### Tarea 8.3 — Scroll infinito o paginación UX
**Objetivo:** mejorar consumo de grandes volúmenes.

**Opciones:**
- scroll infinito con `IntersectionObserver`
- paginación clásica si se prefiere simplicidad

**Criterios de aceptación:**
- UX clara
- no duplica registros
- conserva filtros

---

### Tarea 8.4 — Mejoras de streaming en Mayor
**Objetivo:** hacer robusta la carga incremental.

**Cambios esperados:**
- progress bar
- totales incrementales
- cancelación al cambiar de página
- retry acotado con backoff

**Criterios de aceptación:**
- el stream no queda colgado
- se cancela limpiamente
- el usuario ve progreso

---

### Tarea 8.5 — Observabilidad técnica mínima
**Objetivo:** detectar problemas de performance.

**Datos sugeridos:**
- duración de requests
- cantidad de registros
- fallos de stream
- reintentos

**Criterios de aceptación:**
- existe base mínima para diagnosticar lentitud y fallos

## Definición de terminado del módulo
- catálogos cacheados con invalidación
- eventos paginados
- streaming del Mayor resiliente
- trazabilidad básica de performance
