
# Módulo 2 — Modal de carga de eventos

## Criticidad

ALTA

## Objetivo

Mejorar el modal de carga de eventos para que el operador cargue datos en una secuencia lógica, se guarden todos los campos relevantes y pueda ver una vista previa del asiento antes de confirmar.

## Diagnóstico

El modal actual muestra todos los campos simultáneamente, sin cascada lógica. Esto genera errores operativos y confusión. Además, hay campos que no se guardan correctamente, como el campo o el kg promedio según el diagnóstico del plan.

## Alcance

Este módulo afecta principalmente:

- `public/index.html`
- `public/script.js`
- `index.js`
- Endpoint `POST /api/eventos`
- Endpoint `GET /api/eventos`
- Nuevo endpoint de actividades por campo
- Nuevo endpoint de preview de asiento

## Flujo requerido

La carga debe respetar esta cascada:

1. Tipo de evento
2. Campo
3. Actividad filtrada por campo
4. Categoría filtrada por actividad
5. Fecha
6. Cabezas
7. Kg totales / kg promedio
8. Observaciones
9. Preview de asiento
10. Confirmación final

## Tareas

### 1. Implementar cascada de selección en UI

Al cambiar el tipo de evento:

- Ejecutar la lógica existente de campos condicionales.
- Actualizar validaciones de cabezas.
- Recargar campos disponibles del tenant, si corresponde.
- Limpiar actividad y categoría.

Ejemplo:

```js
document.getElementById('tipoEvento').addEventListener('change', async () => {
  updateDynamicFields();
  updateCabezasValidation();
  await loadCamposForEvento();

  document.getElementById('actividad').value = '';
  document.getElementById('categoria').value = '';
});
```

Al cambiar campo:

```js
document.getElementById('campo').addEventListener('change', async () => {
  const campoId = document.getElementById('campo').value;
  if (!campoId) return;

  const data = await api(`/admin/campos/${campoId}/actividades`);

  populateSelect(
    'actividad',
    data.actividades,
    'id',
    'nombre',
    'Seleccionar actividad...'
  );

  document.getElementById('categoria').value = '';
});
```

Al cambiar actividad:

```js
document.getElementById('actividad').addEventListener('change', async () => {
  const actividadId = document.getElementById('actividad').value;
  if (!actividadId) return;

  const filtered = catalogs.categorias.filter(c => c.actividad_id == actividadId);

  populateSelect(
    'categoria',
    filtered,
    'id',
    'nombre',
    'Seleccionar categoría...'
  );
});
```

### 2. Crear endpoint de actividades por campo

Agregar en `index.js`:

```js
app.get('/api/admin/campos/:id/actividades', isAuthenticated, requireActiveTenant, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT a.id, a.nombre
     FROM actividades a
     JOIN campo_actividades ca ON ca.actividad_id = a.id
     WHERE ca.campo_id = $1
     ORDER BY a.nombre`,
    [parseInt(id, 10)]
  );

  res.json({ actividades: result.rows });
});
```

Verificar si la tabla puente se llama exactamente `campo_actividades`. Si el repositorio usa otro nombre, adaptar sin cambiar el modelo innecesariamente.

### 3. Corregir guardado de eventos

Revisar `POST /api/eventos` para asegurar que el `INSERT` incluya todos los campos relevantes:

- `tipo_evento_id`
- `campo_id`
- `categoria_id`
- `actividad_origen_id`
- `actividad_destino_id`, si aplica
- `campo_destino_id`, si aplica
- `fecha`
- `cabezas`
- `kg_totales`
- `kg_cabeza`
- `observaciones`

No perder `kg_cabeza` o `kg_promedio` si el modelo lo utiliza.

### 4. Corregir listado de eventos

El `GET /api/eventos` debe devolver nombres legibles para mostrar en UI:

```sql
SELECT
  e.id,
  e.fecha,
  e.cabezas,
  e.kg_totales,
  e.kg_cabeza,
  e.observaciones,
  te.nombre AS tipo_evento_nombre,
  c.nombre AS campo_nombre,
  cat.nombre AS categoria_nombre,
  act.nombre AS actividad_nombre
FROM eventos e
JOIN tipos_evento te ON e.tipo_evento_id = te.id
JOIN campos c ON e.campo_id = c.id
LEFT JOIN categorias cat ON e.categoria_id = cat.id
LEFT JOIN actividades act ON e.actividad_origen_id = act.id
WHERE c.tenant_id = $1
ORDER BY e.fecha DESC, e.id DESC;
```

### 5. Crear endpoint de preview de asiento

Agregar un endpoint que ejecute `generateAsientos()` sin persistir.

```js
app.post('/api/eventos/preview', isAuthenticated, requireActiveTenant, async (req, res) => {
  try {
    const asientos = await generateAsientos(req.body, pool);

    const enriched = await Promise.all(asientos.map(async a => {
      const c = await pool.query(
        'SELECT codigo, nombre FROM cuentas WHERE id = $1',
        [a.cuenta_id]
      );

      return {
        ...a,
        cuenta_codigo: c.rows[0]?.codigo,
        cuenta_nombre: c.rows[0]?.nombre
      };
    }));

    res.json({ asientos: enriched });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

Si `generateAsientos()` requiere transacción o cliente, usar el mismo patrón existente del repositorio.

### 6. Agregar preview en HTML

Dentro del modal de evento, antes del botón Guardar:

```html
<div id="previewAsiento" class="hidden mt-4 p-3 bg-background-dark rounded-lg border border-border-dark">
  <h4 class="text-sm font-semibold text-text-secondary mb-2">Vista previa del asiento</h4>
  <table class="w-full text-sm">
    <thead>
      <tr>
        <th class="text-left text-text-secondary">Cuenta</th>
        <th class="text-right text-text-secondary">DEBE</th>
        <th class="text-right text-text-secondary">HABER</th>
      </tr>
    </thead>
    <tbody id="previewAsientoBody"></tbody>
  </table>
</div>
```

### 7. Renderizar preview en UI

Crear una función que tome los asientos simulados y muestre:

- Código de cuenta
- Nombre de cuenta
- Valor en DEBE
- Valor en HABER
- Cabezas
- Kg, si corresponde

El botón Guardar debe permanecer bloqueado o advertir si el preview devuelve error.

## Criterios de aceptación

- El modal carga datos en cascada: tipo de evento → campo → actividad → categoría.
- Las actividades se filtran por campo.
- Las categorías se filtran por actividad.
- Se guardan correctamente campo, actividad, categoría, fecha, cabezas y kg.
- El listado de eventos muestra campo, actividad y categoría.
- El operador ve el asiento antes de guardar.
- Si el preview falla, el error es visible y no se debe guardar a ciegas.

## Pruebas mínimas

1. Seleccionar tipo de evento y verificar que se actualicen campos condicionales.
2. Seleccionar campo y confirmar que solo aparecen actividades asociadas.
3. Seleccionar actividad y confirmar que solo aparecen categorías asociadas.
4. Cargar evento completo y verificar que se guarda con todos los datos.
5. Recargar la pantalla y verificar que el listado muestra campo, actividad y categoría.
6. Probar preview con tipo de evento sin cuentas configuradas y validar error legible.
7. Probar preview exitoso y guardar evento.

## Prompt sugerido para agente

Implementá el módulo 2 del plan de mejoras. Mejorá el modal de eventos para que cargue en cascada tipo de evento, campo, actividad y categoría. Agregá endpoint de actividades por campo, corregí el guardado y listado de eventos para no perder campo, actividad, categoría ni kg promedio. Agregá un endpoint de preview de asiento que use `generateAsientos()` sin persistir y mostralo en el modal antes de guardar. No agregues frameworks nuevos. Mantené el estilo actual de la SPA Vanilla JS.
