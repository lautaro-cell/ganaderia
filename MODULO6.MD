# Módulo 6 — Balance contable

## Objetivo
Completar la lógica del balance para mes/acumulado, filtros y totales físicos.

## Alcance
- toggle Mes / Acumulado
- rango de fechas correcto
- filtros de campo y categoría
- consolidado monetario y físico
- subtotales por grupo

## Orden de implementación

### Tarea 6.1 — Conectar toggle Mes / Acumulado
**Objetivo:** que la modalidad modifique el request real.

**Cambios esperados:**
- variable de estado `_modalidad`
- modalidad `Mes`
- modalidad `Acumulado`

**Reglas:**
- Mes: primer día / último día del mes seleccionado
- Acumulado: inicio de ejercicio / fecha de corte

**Criterios de aceptación:**
- el request cambia según modalidad
- el resultado cambia coherentemente

---

### Tarea 6.2 — Selector de mes y fecha de corte
**Objetivo:** completar los parámetros temporales.

**Cambios esperados:**
- selector visible cuando modalidad = Mes
- fecha de corte para acumulado si aplica
- default coherente

**Criterios de aceptación:**
- no hay ambigüedad temporal en el balance

---

### Tarea 6.3 — Filtros de campo y categoría
**Objetivo:** permitir balance segmentado.

**Cambios esperados:**
- agregar parámetros al request
- backend respeta filtros
- UI consume catálogos

**Criterios de aceptación:**
- el balance se puede acotar por campo y categoría

---

### Tarea 6.4 — Totales físicos
**Objetivo:** incorporar cabezas y kg.

**Datos esperados:**
- stock cabezas
- stock kg
- kg movimiento

**Criterios de aceptación:**
- backend expone métricas físicas
- UI las presenta sin mezclar con montos monetarios

---

### Tarea 6.5 — Subtotales por grupo contable
**Objetivo:** mejorar lectura del balance.

**Grupos mínimos:**
- Activo
- Pasivo
- Resultado

**Criterios de aceptación:**
- hay subtotales claros por grupo
- la agregación es consistente con filtros activos

## Definición de terminado del módulo
- toggle Mes/Acumulado funcional
- filtros operativos
- balance monetario y físico disponible
- subtotales por grupo visibles
