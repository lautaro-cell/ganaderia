# Módulo 4 — Modal Balance: estructura contable correcta

## Criticidad

ALTA

## Objetivo

Corregir el balance para que muestre una estructura contable útil y operativa con jerarquía PLAN → CAMPO → CATEGORÍA, subtotales por grupo y selector de período Mes/Acumulado.

## Diagnóstico

El balance no implementa la jerarquía contable requerida. Falta agrupar de forma clara por plan contable, centro de costo/campo y categoría ganadera. También falta un toggle funcional entre vista mensual y acumulada.

## Alcance

Este módulo afecta principalmente:

- `public/script.js`
- UI del modal o sección de Balance en `public/index.html`
- Endpoint `GET /api/balance`, si requiere ajustes menores

Según el plan original, el endpoint ya devuelve campos como:

- `plan_codigo`
- `plan_nombre`
- `campo_nombre`
- `cuenta_nombre`
- `categoria_nombre`

El principal trabajo está en el frontend.

## Tareas

### 1. Implementar estado del modo de balance

Crear variables globales controladas por la UI:

```js
let balanceModo = 'mes'; // 'mes' | 'acumulado'
let balanceMesSeleccionado = new Date().toISOString().substring(0, 7); // YYYY-MM
let balanceFechaCorte = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
```

### 2. Calcular rango de fechas según modo

```js
function getBalanceDateRange() {
  if (balanceModo === 'mes') {
    const [year, month] = balanceMesSeleccionado.split('-').map(Number);
    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const hasta = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    return { desde, hasta };
  }

  const corte = balanceFechaCorte || new Date().toISOString().split('T')[0];
  const desde = `${corte.substring(0, 4)}-01-01`;

  return { desde, hasta: corte };
}
```

Si el ejercicio fiscal de la empresa no inicia el 1 de enero, dejar el punto preparado para futura parametrización, pero no inventar lógica fiscal sin confirmación del modelo.

### 3. Conectar request de balance

```js
async function loadBalance() {
  const { desde, hasta } = getBalanceDateRange();
  const campoId = document.getElementById('balanceCampo')?.value || '';
  const categoriaId = document.getElementById('balanceCategoria')?.value || '';

  const params = new URLSearchParams({ desde, hasta });

  if (campoId) params.set('campo_id', campoId);
  if (categoriaId) params.set('categoria_id', categoriaId);

  const data = await api(`/balance?${params.toString()}`);

  balanceData = data;
  renderBalance(data.balance);
}
```

### 4. Implementar controles UI

Agregar controles para:

- Modo `Mes`
- Modo `Acumulado`
- Selector de mes, visible cuando el modo es `Mes`
- Selector de fecha de corte, visible cuando el modo es `Acumulado`
- Filtro de campo
- Filtro de categoría

Los cambios de cualquiera de estos controles deben ejecutar `loadBalance()`.

### 5. Renderizar jerarquía PLAN → CAMPO → CATEGORÍA

Implementar render agrupado:

```js
function renderBalance(rows) {
  const container = document.getElementById('balanceTableContainer');

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="text-text-secondary text-center py-8">Sin datos para el período seleccionado.</p>';
    return;
  }

  const byPlan = {};

  rows.forEach(r => {
    const plan = `${r.plan_codigo} — ${r.plan_nombre}`;
    const campo = r.campo_nombre || 'SIN CAMPO';
    const cat = r.categoria_nombre || 'SIN CATEGORÍA';

    if (!byPlan[plan]) byPlan[plan] = {};
    if (!byPlan[plan][campo]) byPlan[plan][campo] = {};
    if (!byPlan[plan][campo][cat]) {
      byPlan[plan][campo][cat] = { cabezas: 0, kg: 0 };
    }

    byPlan[plan][campo][cat].cabezas += Number(r.saldo_cabezas || 0);
    byPlan[plan][campo][cat].kg += Number(r.saldo_kg || 0);
  });

  let html = '';
  const planOrder = ['ACT', 'PN', 'RES'];

  planOrder.forEach(planCodigo => {
    const planKey = Object.keys(byPlan).find(k => k.startsWith(planCodigo));
    if (!planKey) return;

    let planTotalCab = 0;
    let planTotalKg = 0;
    let planHtml = '';

    Object.entries(byPlan[planKey]).forEach(([campo, cats]) => {
      let campoTotalCab = 0;
      let campoTotalKg = 0;
      let campoHtml = '';

      Object.entries(cats).forEach(([cat, totals]) => {
        campoTotalCab += totals.cabezas;
        campoTotalKg += totals.kg;

        campoHtml += `
          <tr class="border-b border-border-dark/30 text-sm">
            <td class="pl-12 py-1.5 text-text-secondary">${cat}</td>
            <td class="text-right pr-4 tabular-nums">${totals.cabezas.toLocaleString('es-AR')}</td>
            <td class="text-right pr-4 tabular-nums">${totals.kg.toLocaleString('es-AR')}</td>
          </tr>`;
      });

      planTotalCab += campoTotalCab;
      planTotalKg += campoTotalKg;

      planHtml += `
        <tr class="bg-background-dark/40 font-medium">
          <td class="pl-6 py-2 text-text-primary">${campo}</td>
          <td class="text-right pr-4 tabular-nums font-semibold">${campoTotalCab.toLocaleString('es-AR')}</td>
          <td class="text-right pr-4 tabular-nums font-semibold">${campoTotalKg.toLocaleString('es-AR')}</td>
        </tr>
        ${campoHtml}`;
    });

    html += `
      <tr class="bg-primary/10 font-bold text-white">
        <td class="pl-3 py-2.5 text-base">${planKey}</td>
        <td class="text-right pr-4 tabular-nums text-primary">${planTotalCab.toLocaleString('es-AR')}</td>
        <td class="text-right pr-4 tabular-nums text-primary">${planTotalKg.toLocaleString('es-AR')}</td>
      </tr>
      ${planHtml}`;
  });

  container.innerHTML = `
    <table class="w-full">
      <thead>
        <tr class="text-xs text-text-secondary uppercase border-b border-border-dark">
          <th class="text-left pl-3 py-2">Plan / Campo / Categoría</th>
          <th class="text-right pr-4">Cabezas</th>
          <th class="text-right pr-4">Kg</th>
        </tr>
      </thead>
      <tbody>${html}</tbody>
    </table>`;
}
```

### 6. Verificar endpoint `/api/balance`

Si el endpoint no devuelve los campos necesarios, ajustarlo para incluir:

- `plan_codigo`
- `plan_nombre`
- `campo_nombre`
- `categoria_nombre`
- `saldo_cabezas`
- `saldo_kg`

No romper filtros existentes.

## Criterios de aceptación

- El balance muestra jerarquía PLAN → CAMPO → CATEGORÍA.
- Se muestran subtotales por campo.
- Se muestran totales por plan.
- El modo Mes calcula desde el primer al último día del mes seleccionado.
- El modo Acumulado calcula desde inicio del año hasta la fecha de corte.
- Los filtros de campo y categoría se aplican al request.
- Si no hay datos, se muestra un mensaje claro y no una tabla vacía rota.

## Pruebas mínimas

1. Abrir balance en modo Mes.
2. Cambiar mes y verificar que cambian los datos.
3. Cambiar a modo Acumulado y verificar fecha desde/hasta enviada.
4. Filtrar por campo.
5. Filtrar por categoría.
6. Verificar que cada plan muestra subtotales por campo y detalle por categoría.
7. Probar período sin datos y verificar mensaje claro.

## Prompt sugerido para agente

Implementá el módulo 4 del plan de mejoras. Corregí el balance para renderizar jerarquía PLAN → CAMPO → CATEGORÍA con subtotales por campo y totales por plan. Agregá toggle Mes/Acumulado conectado al request, con selector de mes y fecha de corte. Usá los datos existentes del endpoint `/api/balance`; solo ajustá backend si faltan campos necesarios. No introduzcas frameworks nuevos y mantené el estilo actual de la SPA.
