# Módulo 5 — Administración: quitar campos GIS de creación de campos

## Criticidad

MEDIA

## Objetivo

Eliminar o desactivar los campos de latitud y longitud del formulario de creación/edición de campos hasta que el módulo GIS esté realmente operativo.

## Diagnóstico

El formulario de alta de campos incluye inputs de coordenadas que no están en uso operacional. Esto genera confusión en usuarios administrativos y agrega datos que hoy no se usan.

## Alcance

Este módulo afecta principalmente:

- `public/index.html`
- `public/script.js`
- Endpoint `POST /api/admin/campos`
- Endpoint `PUT /api/admin/campos/:id`, si existe

## Tareas

### 1. Quitar o comentar inputs GIS del HTML

Localizar el formulario de creación/edición de campos y eliminar o comentar:

```html
<!-- QUITAR o comentar hasta que el módulo GIS esté activo:
<div class="form-group">
  <label>Latitud</label>
  <input type="number" id="campoLatitud" step="any" />
</div>

<div class="form-group">
  <label>Longitud</label>
  <input type="number" id="campoLongitud" step="any" />
</div>
-->
```

Preferencia: eliminar visualmente los inputs. Si se comentan, dejar una nota clara indicando que pertenecen al futuro módulo GIS.

### 2. Limpiar referencias en JavaScript

Buscar en `public/script.js` referencias a:

- `campoLatitud`
- `campoLongitud`
- `latitud`
- `longitud`

Eliminar:

- Lectura de valores desde inputs inexistentes.
- Validaciones de latitud/longitud.
- Envío de latitud/longitud en el payload.
- Renderizado o reseteo de esos campos.

### 3. Ajustar backend para ignorar GIS

En el backend, si `POST /api/admin/campos` o `PUT /api/admin/campos/:id` acepta `latitud` y `longitud`, ignorarlos por ahora.

Regla:

- No validar latitud/longitud.
- No obligar latitud/longitud.
- No fallar si vienen en el body por compatibilidad.
- No almacenarlos si el módulo GIS está desactivado.

### 4. Verificar edición de campos existentes

Si hay campos existentes con latitud/longitud guardadas, no romper la lectura de esos registros. Simplemente no mostrar ni modificar esos valores desde la UI.

## Criterios de aceptación

- El formulario de alta de campos ya no muestra latitud ni longitud.
- El formulario de edición de campos ya no muestra latitud ni longitud.
- No hay errores JavaScript por elementos inexistentes.
- Crear un campo funciona sin coordenadas.
- Editar un campo funciona sin coordenadas.
- El backend no exige ni valida coordenadas.

## Pruebas mínimas

1. Abrir administración de campos.
2. Crear campo nuevo sin latitud ni longitud.
3. Editar campo existente.
4. Revisar consola del navegador y confirmar que no hay errores por `campoLatitud` o `campoLongitud`.
5. Confirmar que el request enviado no incluye coordenadas o que el backend las ignora.

## Prompt sugerido para agente

Implementá el módulo 5 del plan de mejoras. Quitá del alta y edición de campos los inputs de latitud y longitud porque el módulo GIS no está operativo. Limpiá referencias JavaScript asociadas y ajustá backend para no validar ni requerir esos campos. No modifiques otras partes de administración. Verificá que crear y editar campos siga funcionando sin errores en consola.
