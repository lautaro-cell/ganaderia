Modal Mayor: datos visibles y filtros funcionales

## Criticidad

ALTA

## Objetivo

Corregir el mayor contable para que muestre datos completos, aplique filtros correctamente y exporte un CSV estructurado con headers legibles.

## Diagnóstico

El mayor actual no muestra campo ni categoría en los asientos. Los filtros no aplican correctamente y el filtro de mes tiene un comportamiento incorrecto: cuando no hay mes seleccionado, debería mostrar todos los registros. La exportación CSV no tiene una estructura adecuada para Excel o Google Sheets.

## Alcance

Este módulo afecta principalmente:

- `index.js`
- `public/script.js`
- UI del modal o sección de Mayor
- Endpoint `GET /api/mayor`
- Exportación CSV

## Tareas

### 1. Enriquecer endpoint `/api/mayor`

Actualizar el endpoint para devolver:

- Fecha del asiento
- ID del asiento
- Tipo DEBE/HABER
- Cabezas
- Kg
- Kg/cabeza
- Código y nombre de cuenta
- Código y nombre de plan
- Campo
- Categoría
- Actividad
- Tipo de evento
- Fecha e ID del evento origen

Ejemplo de estructura:

```js
app.get('/api/mayor', isAuthenticated, requireActiveTenant, apiReadLimiter, async (req, res) => {
  const { mes, campo_id, categoria_id, cuenta_id } = req.query;
  const tenantId = req.activeTenantId;

  const params = [tenantId];
  const conditions = ['ca.tenant_id = $1'];

  if (mes && mes.trim() !== '') {
    params.push(`${mes}-01`);
    conditions.push(`TO_CHAR(a.fecha, 'YYYY-MM') = TO_CHAR($${params.length}::date, 'YYYY-MM')`);
  }

  if (campo_id) {
    params.push(campo_id);
    conditions.push(`a.campo_id = $${params.length}`);
  }

  if (categoria_id) {
    params.push(categoria_id);
    conditions.push(`a.categoria_id = $${params.length}`);
  }

  if (cuenta_id) {
    params.push(cuenta_id);
    conditions.push(`a.cuenta_id = $${params.length}`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  const result = await pool.query(`
    SELECT
      a.id,
      a.fecha,
      a.tipo,
      a.cabezas,
      a.kg,
      a.kg_cabeza,
      c.codigo AS cuenta_codigo,
      c.nombre AS cuenta_nombre,
      pc.codigo AS plan_codigo,
      pc.nombre AS plan_nombre,
      ca.nombre AS campo_nombre,
      cat.nombre AS categoria_nombre,
      act.nombre AS actividad_nombre,
      te.nombre AS tipo_evento_nombre,
      e.fecha AS evento_fecha,
      e.id AS evento_id
    FROM asientos a
    JOIN cuentas c ON a.cuenta_id = c.id
    JOIN planes_cuenta pc ON c.plan_cuenta_id = pc.id
    JOIN campos ca ON a.campo_id = ca.id
    JOIN eventos e ON a.evento_id = e.id
    JOIN tipos_evento te ON e.tipo_evento_id = te.id
    LEFT JOIN categorias cat ON a.categoria_id = cat.id
    LEFT JOIN actividades act ON a.actividad_id = act.id
    ${where}
    ORDER BY a.fecha DESC, a.id DESC
  `, params);

  const totalDebe = result.rows
    .filter(r => r.tipo === 'DEBE')
    .reduce((s, r) => s + Number(r.kg || 0), 0);

  const totalHaber = result.rows
    .filter(r => r.tipo === 'HABER')
    .reduce((s, r) => s + Number(r.kg || 0), 0);

  res.json({
    asientos: result.rows,
    total_debe: totalDebe,
    total_haber: totalHaber
  });
});
```

Adaptar nombres de columnas si en el repositorio difieren.

### 2. Corregir lógica del filtro de mes

Regla obligatoria:

- Si `mes` viene vacío, nulo o no existe, no filtrar por mes.
- Si `mes` existe con formato `YYYY-MM`, filtrar por ese mes.

No usar el mes actual por defecto si el usuario no seleccionó mes.

### 3. Conectar filtros en UI

Implementar o corregir `loadMayor()`:

```js
async function loadMayor() {
  const mes = document.getElementById('mayorMes')?.value?.trim() || '';
  const campoId = document.getElementById('mayorCampo')?.value || '';
  const categoriaId = document.getElementById('mayorCategoria')?.value || '';
  const cuentaId = document.getElementById('mayorCuenta')?.value || '';

  const params = new URLSearchParams();

  if (mes) params.set('mes', mes);
  if (campoId) params.set('campo_id', campoId);
  if (categoriaId) params.set('categoria_id', categoriaId);
  if (cuentaId) params.set('cuenta_id', cuentaId);

  const queryString = params.toString();
  const data = await api(`/mayor${queryString ? `?${queryString}` : ''}`);

  mayorData = data;
  renderMayorTable(data.asientos);
  renderMayorTotales(data.total_debe, data.total_haber);
}
```

### 4. Renderizar datos completos

Cada línea del mayor debe mostrar como mínimo:

- Fecha
- Tipo de evento
- Campo
- Categoría
- Cuenta
- DEBE en cabezas/kg
- HABER en cabezas/kg

Si el modelo usa kg como principal, mostrar kg como columna central. Si también corresponde cabezas, mantener ambas.

### 5. Exportación CSV estructurada

Implementar exportación con headers legibles y BOM UTF-8 para Excel:

```js
function exportMayorCSV() {
  const headers = [
    'Fecha',
    'ID Asiento',
    'Tipo Evento',
    'Campo',
    'Categoría',
    'Cuenta Código',
    'Cuenta Nombre',
    'Tipo',
    'Cabezas',
    'Kg',
    'Kg/Cabeza'
  ];

  const rows = mayorData.asientos.map(a => [
    a.fecha?.split('T')[0] || '',
    a.id,
    a.tipo_evento_nombre || '',
    a.campo_nombre || '',
    a.categoria_nombre || '',
    a.cuenta_codigo || '',
    a.cuenta_nombre || '',
    a.tipo,
    a.cabezas ?? '',
    a.kg ?? '',
    a.kg_cabeza ?? ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mayor_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

## Criterios de aceptación

- Cada línea del mayor muestra campo y categoría.
- El filtro por mes solo aplica si el usuario selecciona un mes.
- Sin mes seleccionado, el mayor muestra todos los registros según los demás filtros.
- Los filtros de campo, categoría y cuenta funcionan.
- Los totales DEBE y HABER responden al período filtrado.
- El CSV tiene headers legibles.
- El CSV abre correctamente en Excel y Google Sheets.

## Pruebas mínimas

1. Abrir mayor sin filtros y verificar que muestra todos los registros del tenant.
2. Filtrar por mes y confirmar que muestra solo ese mes.
3. Limpiar el mes y confirmar que vuelve a mostrar todos.
4. Filtrar por campo.
5. Filtrar por categoría.
6. Filtrar por cuenta.
7. Exportar CSV y abrirlo en Excel o Sheets.
8. Confirmar que el CSV contiene campo, categoría y cuenta legibles.

## Prompt sugerido para agente

Implementá el módulo 3 del plan de mejoras. Corregí `/api/mayor` para devolver campo, categoría, actividad, cuenta, plan, tipo de evento y totales. Ajustá la lógica de filtros para que el mes solo filtre cuando esté seleccionado; sin mes debe mostrar todos los registros. Corregí el renderizado de la tabla y la exportación CSV con headers legibles y BOM UTF-8. No modifiques el motor contable salvo que sea imprescindible.
