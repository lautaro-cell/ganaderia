// Datos maestros para tipos de evento, actividades y categorías.
const eventTypes = [
  { code: 'APERTURA', name: 'Apertura del ejercicio' },
  { code: 'NACIMIENTO', name: 'Nacimiento' },
  { code: 'DESTETE', name: 'Destete' },
  { code: 'COMPRA', name: 'Compra' },
  { code: 'VENTA', name: 'Venta' },
  { code: 'MORTANDAD', name: 'Mortandad' },
  { code: 'CONSUMO', name: 'Consumo propio' },
  { code: 'CAMBIO_ACTIVIDAD', name: 'Cambio de actividad' },
  { code: 'CAMBIO_CATEGORIA', name: 'Cambio de categoría' },
  { code: 'TRASLADO', name: 'Traslado de campo' }
];

const activities = ['CRIA', 'RECRIA', 'FEEDLOT'];

const categories = [
  { id: 1, name: 'Vaca', activity: 'CRIA' },
  { id: 2, name: 'Vaquillona venta', activity: 'CRIA' },
  { id: 3, name: 'Ternero', activity: 'CRIA' },
  { id: 4, name: 'Ternera', activity: 'CRIA' },
  { id: 5, name: 'Novillo', activity: 'RECRIA' },
  { id: 6, name: 'Novilla', activity: 'RECRIA' },
  { id: 7, name: 'Toro', activity: 'RECRIA' },
  { id: 8, name: 'Torito', activity: 'FEEDLOT' },
  { id: 9, name: 'Vaca CUT', activity: 'FEEDLOT' }
];

// Población de selectores al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  const tipoSelect = document.getElementById('tipo');
  eventTypes.forEach(evt => {
    const opt = document.createElement('option');
    opt.value = evt.code;
    opt.textContent = evt.name;
    tipoSelect.appendChild(opt);
  });
  const actOrig = document.getElementById('actividadOrigen');
  const actDest = document.getElementById('actividadDestino');
  activities.forEach(act => {
    const opt1 = document.createElement('option');
    opt1.value = act;
    opt1.textContent = act;
    actOrig.appendChild(opt1.cloneNode(true));
    actDest.appendChild(opt1);
  });
  const catOrig = document.getElementById('categoriaOrigen');
  const catDest = document.getElementById('categoriaDestino');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    opt.setAttribute('data-activity', cat.activity);
    catOrig.appendChild(opt.cloneNode(true));
    catDest.appendChild(opt);
  });

  // Filtrar categorías según actividad seleccionada
  actOrig.addEventListener('change', () => {
    filterCategories(catOrig, actOrig.value);
  });
  actDest.addEventListener('change', () => {
    filterCategories(catDest, actDest.value);
  });

  // Enviar evento al servidor
  document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = document.getElementById('fecha').value;
    const tipo = tipoSelect.value;
    const actividadOrigen = actOrig.value;
    const actividadDestino = actDest.value;
    const categoriaOrigen = catOrig.value;
    const categoriaDestino = catDest.value;
    const cabezas = parseInt(document.getElementById('cabezas').value, 10);
    const kgTotales = parseFloat(document.getElementById('kgTotales').value);
    const eventObj = {
      fecha,
      tipo,
      actividadOrigen,
      actividadDestino,
      categoriaOrigen,
      categoriaDestino,
      cabezas,
      kgTotales
    };
    try {
      const res = await fetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventObj)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert('Evento registrado correctamente.');
        e.target.reset();
      } else {
        alert('Error al registrar el evento.');
      }
    } catch (err) {
      console.error(err);
      alert('Error en la comunicación con el servidor.');
    }
  });

  // Botón para cargar mayor
  document.getElementById('loadLedger').addEventListener('click', async () => {
    try {
      const res = await fetch('/ledger');
      const ledger = await res.json();
      populateLedger(ledger);
    } catch (err) {
      console.error(err);
      alert('Error al cargar el mayor.');
    }
  });

  // Botón para cargar balance
  document.getElementById('loadBalance').addEventListener('click', async () => {
    try {
      const res = await fetch('/balance');
      const balance = await res.json();
      populateBalance(balance);
    } catch (err) {
      console.error(err);
      alert('Error al cargar el balance.');
    }
  });
});

// Filtra un selector de categorías según la actividad
function filterCategories(selectElem, activity) {
  Array.from(selectElem.options).forEach(opt => {
    const act = opt.getAttribute('data-activity');
    if (!opt.value) return; // primera opción (vacía)
    opt.disabled = act !== activity;
    if (opt.disabled && selectElem.value === opt.value) {
      selectElem.value = '';
    }
  });
}

// Muestra el mayor en la tabla
function populateLedger(entries) {
  const section = document.getElementById('ledgerSection');
  // Mostrar con animación
  section.classList.remove('hidden');
  section.classList.add('visible');
  const tbody = document.querySelector('#ledgerTable tbody');
  tbody.innerHTML = '';
  entries.forEach(entry => {
    const tr = document.createElement('tr');
    const tdFecha = document.createElement('td');
    tdFecha.textContent = entry.fecha || '';
    const tdCuenta = document.createElement('td');
    tdCuenta.textContent = entry.cuenta;
    const tdTipo = document.createElement('td');
    tdTipo.textContent = entry.tipo;
    const tdImporte = document.createElement('td');
    tdImporte.textContent = entry.importe.toFixed(2);
    tr.appendChild(tdFecha);
    tr.appendChild(tdCuenta);
    tr.appendChild(tdTipo);
    tr.appendChild(tdImporte);
    tbody.appendChild(tr);
  });
}

// Muestra el balance en la tabla
function populateBalance(balance) {
  const section = document.getElementById('balanceSection');
  // Mostrar con animación
  section.classList.remove('hidden');
  section.classList.add('visible');
  const tbody = document.querySelector('#balanceTable tbody');
  tbody.innerHTML = '';
  Object.keys(balance).forEach(cuenta => {
    const tr = document.createElement('tr');
    const data = balance[cuenta];
    const tdCuenta = document.createElement('td');
    tdCuenta.textContent = cuenta;
    const tdDebe = document.createElement('td');
    tdDebe.textContent = data.debe.toFixed(2);
    const tdHaber = document.createElement('td');
    tdHaber.textContent = data.haber.toFixed(2);
    tr.appendChild(tdCuenta);
    tr.appendChild(tdDebe);
    tr.appendChild(tdHaber);
    tbody.appendChild(tr);
  });
  // Renderizar gráfico
  renderBalanceChart(balance);
}

// Renderiza un gráfico de barras simple del balance (debe-haber)
function renderBalanceChart(balance) {
  const canvas = document.getElementById('balanceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  // Limpiar canvas
  ctx.clearRect(0, 0, width, height);
  // Convertir balance en lista de objetos { cuenta, net }
  const items = Object.keys(balance).map(cuenta => {
    const data = balance[cuenta];
    const net = data.debe - data.haber;
    return { cuenta, net };
  });
  if (items.length === 0) {
    return;
  }
  // Ordenar por valor absoluto descendente y limitar a 6 elementos para claridad
  items.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const topItems = items.slice(0, 6);
  const maxAbs = Math.max(...topItems.map(item => Math.abs(item.net)));
  const barHeight = height / (topItems.length * 1.5);
  const barSpacing = barHeight * 0.5;
  // Configurar fuentes
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  topItems.forEach((item, idx) => {
    const y = idx * (barHeight + barSpacing) + barSpacing;
    const barWidth = (Math.abs(item.net) / maxAbs) * (width * 0.6);
    // Definir color: rojo oscuro si neto negativo, rosa claro si positivo
    const isPositive = item.net >= 0;
    const color = isPositive ? '#ef5350' : '#c62828';
    ctx.fillStyle = color;
    ctx.fillRect(150, y, barWidth, barHeight);
    // Etiqueta de cuenta
    ctx.fillStyle = '#333333';
    ctx.fillText(item.cuenta, 10, y + barHeight / 2);
    // Valor neto
    ctx.fillStyle = '#333333';
    ctx.fillText(item.net.toFixed(2), 150 + barWidth + 10, y + barHeight / 2);
  });
}
