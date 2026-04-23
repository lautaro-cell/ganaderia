# Módulo 4 — EventoDrawer / Registro de eventos

## Objetivo
Permitir registrar eventos reales mostrando todos los tipos disponibles del tenant y su impacto contable.

## Alcance
- fuente de datos de tipos de evento
- selector y estado de configuración
- campos dinámicos
- validaciones inline
- preview de asiento

## Orden de implementación

### Tarea 4.1 — Endpoint para traer todos los EventTypes activos
**Objetivo:** dejar de depender solo de templates existentes.

**Archivos permitidos:**
- servicio backend de eventos/catálogos
- contracts / DTOs / proto
- componente del drawer solo para consumo

**Cambios esperados:**
- devolver todos los `EventType` activos del tenant
- incluir estado: configurado / sin configurar
- incluir datos mínimos para render

**Criterios de aceptación:**
- el drawer ve todos los tipos de evento configurados para el tenant
- los no configurados siguen visibles

---

### Tarea 4.2 — Selector con estado de configuración
**Objetivo:** mostrar el tipo de evento y bloquear uso inválido.

**Cambios esperados:**
- badge o estado visible
- warning si faltan cuentas o configuración requerida
- submit bloqueado si el tipo no es operable

**Criterios de aceptación:**
- un tipo mal configurado no puede registrarse
- el usuario entiende por qué

---

### Tarea 4.3 — Campos dinámicos por tipo de evento
**Objetivo:** mostrar solo los inputs relevantes.

**Primer alcance mínimo:**
- render condicional por flags/configuración
- validación mínima por campo requerido

**Campos típicos:**
- cabezas
- peso/cabeza
- campo
- categoría
- observaciones

**Criterios de aceptación:**
- no aparecen campos irrelevantes
- los requeridos son obligatorios

---

### Tarea 4.4 — Filtros dependientes por actividad/campo
**Objetivo:** encadenar selección de campo, actividad y categoría.

**Cambios esperados:**
- categorías filtradas según actividad
- actividades válidas según configuración del tenant/campo

**Criterios de aceptación:**
- no se pueden elegir combinaciones inválidas

---

### Tarea 4.5 — Preview del asiento contable
**Objetivo:** mostrar antes de guardar el impacto esperado.

**Contenido mínimo:**
- línea DEBE
- línea HABER
- cuentas
- importe estimado
- cabezas / kg si aplica

**Criterios de aceptación:**
- el usuario puede anticipar el asiento
- si falla la generación, el error es visible

## Definición de terminado del módulo
- el drawer carga todos los EventTypes activos
- bloquea los no configurados
- soporta campos dinámicos
- permite previsualizar el asiento
