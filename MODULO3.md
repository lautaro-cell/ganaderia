# Módulo 3 — Empresas y conectividad ERP

## Objetivo
Hacer robusta la configuración de empresa y validar conectividad antes de operar.

## Alcance
- alta/edición de empresa
- api key
- base id
- URL ERP
- test de conectividad
- sync inicial de catálogos

## Orden de implementación

### Tarea 3.1 — Caso de uso Verificar conexión
**Objetivo:** probar credenciales y conectividad contra Gestor Max.

**Archivos permitidos:**
- servicio de aplicación
- provider ERP
- DTO/proto de request/response

**Salida sugerida:**
- `success`
- `message`
- `latencyMs`
- `checkedAt`

**Criterios de aceptación:**
- retorna OK o error descriptivo
- timeout controlado
- no persiste cambios

---

### Tarea 3.2 — Guardado seguro de empresa
**Objetivo:** validar y proteger la configuración.

**Cambios esperados:**
- validar razón social / identificador fiscal
- validar api key
- validar base id
- cifrar api key usando servicio existente
- validar URL base

**Criterios de aceptación:**
- no se guarda empresa inválida
- la api key queda cifrada
- los errores son claros

---

### Tarea 3.3 — Sync inicial de catálogos
**Objetivo:** traer cuentas y categorías luego de una configuración válida.

**Cambios esperados:**
- disparar sincronización post-guardado
- persistir fecha/hora de última sync
- registrar resultado

**Criterios de aceptación:**
- al guardar exitosamente queda trazabilidad de sync
- si la sync falla, el error es visible y no ambiguo

---

### Tarea 3.4 — Estado de conectividad en administración
**Objetivo:** exponer un estado simple de salud de la integración.

**Datos mínimos:**
- última verificación
- último resultado
- última sincronización
- estado resumido

**Criterios de aceptación:**
- el usuario administrador puede ver si la empresa está apta para operar

## Definición de terminado del módulo
- existe verificación real de conexión
- la empresa se guarda de forma segura
- hay sync inicial y trazabilidad
- el estado de integración es visible
