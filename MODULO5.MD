# Módulo 5 — Mayor contable

## Objetivo
Convertir el Mayor en una herramienta operativa y auditable.

## Alcance
- filtros funcionales
- proto/backend/UI alineados
- totales del período
- visualización de asientos descuadrados
- exportación
- streaming controlado

## Orden de implementación

### Tarea 5.1 — Extender contrato de filtros
**Objetivo:** incorporar filtros reales al request.

**Campos a agregar:**
- `account_code`
- `category_id`
- `field_id`

**Archivos permitidos:**
- `reporting.proto`
- implementación backend de reporting
- cliente que consume el contrato

**Criterios de aceptación:**
- proto compilado
- cliente y servidor alineados
- filtros opcionales

---

### Tarea 5.2 — Aplicar filtros en backend
**Objetivo:** que la query respete cuenta, categoría y campo.

**Cambios esperados:**
- filtros opcionales
- string vacío = sin filtro
- composición segura y clara de query

**Criterios de aceptación:**
- cada filtro reduce resultados cuando aplica
- combinaciones de filtros funcionan

---

### Tarea 5.3 — Binding real en la UI del Mayor
**Objetivo:** conectar controles visuales con el request real.

**Cambios esperados:**
- estados locales `_accountFilter`, `_categoryFilter`, `_fieldFilter`
- carga inicial de catálogos necesarios
- botón/acción de filtrar

**Criterios de aceptación:**
- el request enviado refleja exactamente el estado de filtros

---

### Tarea 5.4 — Totales del período
**Objetivo:** calcular y mostrar sumas del filtro aplicado.

**Cambios esperados:**
- sumar débitos y créditos del período actual
- mostrar fila de totales
- si hay streaming, actualizar incrementalmente

**Criterios de aceptación:**
- los totales coinciden con el conjunto filtrado

---

### Tarea 5.5 — Resaltado de asientos descuadrados
**Objetivo:** marcar visualmente eventos con inconsistencia contable.

**Regla:**
- agrupar por `LivestockEventId`
- comparar suma DEBE y HABER

**Criterios de aceptación:**
- filas/agrupaciones descuadradas se resaltan
- el usuario puede identificarlas rápidamente

---

### Tarea 5.6 — Exportar CSV
**Objetivo:** descargar resultados del filtro activo.

**Criterios de aceptación:**
- exporta todo el filtro
- no solo la página visible
- headers legibles

## Definición de terminado del módulo
- filtros funcionales end-to-end
- totales del período correctos
- asientos descuadrados visibles
- exportación CSV operativa
