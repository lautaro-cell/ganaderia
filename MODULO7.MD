# Módulo 7 — Administración de actividades, campos y usuarios

## Objetivo
Completar la configuración operativa del tenant con reglas consistentes.

## Alcance
- campos
- actividades
- categorías permitidas
- tipos de evento por actividad
- usuarios y roles
- permisos básicos

## Orden de implementación

### Tarea 7.1 — Gestión de campos
**Objetivo:** completar datos y reglas del establecimiento.

**Campos mínimos:**
- nombre
- razón social
- superficie
- ubicación GPS
- actividades habilitadas

**Validación mínima:**
- un campo debe tener al menos una actividad

**Criterios de aceptación:**
- el campo no se guarda incompleto
- sus actividades quedan persistidas

---

### Tarea 7.2 — Gestión de actividades
**Objetivo:** hacer operables las actividades comerciales del tenant.

**Datos mínimos:**
- nombre
- descripción
- categorías permitidas
- tipos de evento habilitados
- parámetros zootécnicos

**Criterios de aceptación:**
- se pueden asociar categorías y eventos a una actividad
- las relaciones M:N funcionan correctamente

---

### Tarea 7.3 — Tipos de evento y actividades aplicables
**Objetivo:** limitar qué eventos puede usar cada actividad.

**Cambios esperados:**
- multi-select de actividades por tipo de evento
- persistencia correcta
- lectura correcta desde el drawer

**Criterios de aceptación:**
- no se ofrece un evento en una actividad donde no aplica

---

### Tarea 7.4 — Gestión de usuarios y roles
**Objetivo:** formalizar perfiles de acceso.

**Roles mínimos:**
- Administrador
- Operador
- Auditor
- Contador

**Reglas mínimas:**
- Auditor = solo lectura
- posibilidad de asignar campos accesibles
- revocar acceso sin borrar historial

**Criterios de aceptación:**
- los roles restringen acciones críticas
- el usuario auditor no modifica datos

---

### Tarea 7.5 — Últimos accesos / trazabilidad básica
**Objetivo:** dar visibilidad operativa.

**Datos mínimos:**
- última sesión
- estado activo/inactivo
- campos asignados

**Criterios de aceptación:**
- administración puede revisar accesos recientes

## Definición de terminado del módulo
- campos, actividades y usuarios son configurables
- las relaciones entre actividad, categoría y evento funcionan
- los roles básicos restringen correctamente
