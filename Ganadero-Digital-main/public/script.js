console.log('[DEBUG] script.js cargando...');

let currentUser = null;
let catalogs = {};
let adminData = {};
let editingItem = { type: null, id: null };
let balanceMode = 'acumulado';
let mayorCategoriaView = 'cliente';
let balanceCategoriaView = 'cliente';
let balanceData = { balance: [], meses: [] };

// Variables for auditor-client management
let selectedAuditorId = null;
let clienteSelections = {};
let auditorClientesData = { auditores: [], clientes: [], asignaciones: [] };

// Variables for user management
let usuariosData = [];
let usuariosFilter = 'todos';
let usuariosSearch = '';

// Global helper functions for formatting
function formatNum(val) {
  if (val === 0 || val === null || val === undefined || Number.isNaN(val)) return '-';
  const num = Number(val);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('es-AR');
}

function formatKg(val) {
  if (val === 0 || val === null || val === undefined) return '-';
  return Math.abs(parseFloat(val)).toLocaleString('es-AR') + ' kg';
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAdminTable(columns, rows, emptyMessage = 'No hay datos') {
  const headerCells = columns.map(col => 
    `<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary whitespace-nowrap">${col}</th>`
  ).join('');

  const rowsHtml = rows.length > 0 
    ? rows.join('') 
    : `<tr><td colspan="${columns.length}" class="px-6 py-8 text-center text-text-secondary">${emptyMessage}</td></tr>`;

  return `
    <div class="overflow-hidden border border-[#392828] rounded-2xl shadow-lg">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-[#271c1c]">
            <tr>${headerCells}</tr>
          </thead>
          <tbody class="divide-y divide-[#392828] bg-[#1E1818]">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderActionButtons(type, id, showEdit = true) {
  // Clientes solo pueden ver, no editar ni eliminar entidades de administración
  const canEdit = currentUser && (currentUser.rol === 'auditor' || currentUser.rol === 'administrador');
  // Solo administrador puede eliminar
  const canDelete = currentUser && currentUser.rol === 'administrador';
  
  let buttons = '';
  if (showEdit && canEdit) {
    buttons += `
      <button data-action="edit" data-type="${type}" data-id="${id}"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#392828] hover:bg-[#4a3a3a] rounded-lg transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-base">edit</span>
        Editar
      </button>
    `;
  }
  if (canDelete) {
    buttons += `
      <button data-action="delete" data-type="${type}" data-id="${id}"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-900/60 hover:bg-red-800 rounded-lg transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-base">delete</span>
        Eliminar
      </button>
    `;
  }
  return buttons ? `<div class="flex items-center gap-2">${buttons}</div>` : '';
}

function renderBadge(active, activeText = 'Activo', inactiveText = 'Inactivo') {
  return active 
    ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-green-900/40 text-green-400"><span class="material-symbols-outlined text-sm">check_circle</span>${activeText}</span>`
    : `<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-yellow-900/40 text-yellow-400"><span class="material-symbols-outlined text-sm">pending</span>${inactiveText}</span>`;
}

window.editItem = function(type, id) {
  console.log('[DEBUG] editItem called:', type, id);
  if (typeof window._editItemImpl === 'function') {
    window._editItemImpl(type, id);
  } else {
    console.error('[ERROR] editItem implementation not loaded');
  }
};

window.deleteItem = async function(type, id) {
  console.log('[DEBUG] deleteItem called:', type, id);
  if (typeof window._deleteItemImpl === 'function') {
    await window._deleteItemImpl(type, id);
  } else {
    console.error('[ERROR] deleteItem implementation not loaded');
  }
};

window.editCliente = function(id) {
  console.log('[DEBUG] editCliente called:', id);
  if (typeof window._editClienteImpl === 'function') {
    window._editClienteImpl(id);
  } else {
    console.error('[ERROR] editCliente implementation not loaded');
  }
};

window.deleteCliente = async function(id) {
  console.log('[DEBUG] deleteCliente called:', id);
  if (typeof window._deleteClienteImpl === 'function') {
    await window._deleteClienteImpl(id);
  } else {
    console.error('[ERROR] deleteCliente implementation not loaded');
  }
};

window.deleteAuditorCliente = async function(id) {
  console.log('[DEBUG] deleteAuditorCliente called:', id);
  if (typeof window._deleteAuditorClienteImpl === 'function') {
    await window._deleteAuditorClienteImpl(id);
  } else {
    console.error('[ERROR] deleteAuditorCliente implementation not loaded');
  }
};

function renderTableRow(cells) {
  const cellsHtml = cells.map(cell => 
    `<td class="px-4 py-3 text-sm text-white whitespace-nowrap">${cell}</td>`
  ).join('');
  return `<tr class="hover:bg-[#271c1c]/50 transition-colors">${cellsHtml}</tr>`;
}

async function api(endpoint, options = {}) {
  const res = await fetch('/api' + endpoint, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  const data = await res.json();
  if (!res.ok && data.error) {
    throw new Error(data.error);
  }
  return data;
}

let notificationTimeoutId = null;

function showNotification(message, type = 'success') {
  const el = document.getElementById('notification');
  if (!el) return;

  // Asegurar visibilidad y cancelar ocultado previo
  el.classList.remove('hidden');
  if (notificationTimeoutId) clearTimeout(notificationTimeoutId);

  el.textContent = message;
  const baseClasses = 'fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg font-medium';
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-600 text-white'
  };

  el.className = baseClasses + ' ' + (typeClasses[type] || typeClasses.success);

  notificationTimeoutId = setTimeout(() => {
    el.classList.add('hidden');
    notificationTimeoutId = null;
  }, 3000);
}

function showSection(section) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('clientSelectSection').classList.toggle('hidden', section !== 'clientSelect');
  document.getElementById('mainSection').classList.toggle('hidden', section !== 'main');
}

async function selectTenant(tenantId) {
  try {
    const result = await api('/select-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId })
    });
    if (result.success) {
      currentUser.active_tenant_id = result.active_tenant_id;
      currentUser.active_tenant_nombre = result.active_tenant_nombre;
      return true;
    }
    return false;
  } catch (err) {
    showNotification(err.message || 'Error al seleccionar cliente', 'error');
    return false;
  }
}

async function clearTenant() {
  try {
    await api('/clear-tenant', { method: 'POST' });
    currentUser.active_tenant_id = null;
    currentUser.active_tenant_nombre = null;
    return true;
  } catch (err) {
    showNotification(err.message || 'Error al cambiar cliente', 'error');
    return false;
  }
}

function showClientSelector(tenants) {
  const selector = document.getElementById('clienteSelector');
  selector.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Buscar por nombre o ID...';
  selector.appendChild(defaultOption);
  tenants.forEach(t => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = t.nombre;
    selector.appendChild(option);
  });

  const countEl = document.getElementById('clientCount');
  if (countEl) {
    countEl.textContent = tenants.length + ' cliente' + (tenants.length !== 1 ? 's' : '') + ' asignado' + (tenants.length !== 1 ? 's' : '');
  }

  const warningEl = document.getElementById('noClientsWarning');
  if (warningEl) {
    warningEl.classList.toggle('hidden', tenants.length > 0);
  }

  if (currentUser) {
    const selectUserName = document.getElementById('selectUserName');
    const selectUserRole = document.getElementById('selectUserRole');
    const selectUserAvatar = document.getElementById('selectUserAvatar');
    if (selectUserName) selectUserName.textContent = currentUser.nombre || 'Usuario';
    if (selectUserRole) selectUserRole.textContent = currentUser.rol || 'Auditor';
    if (selectUserAvatar) selectUserAvatar.textContent = (currentUser.nombre || 'U').charAt(0).toUpperCase();
  }

  showSection('clientSelect');
}

function updateActiveTenantDisplay() {
  const adminSelector = document.getElementById('adminClienteSelector');
  const tenantBadge = document.getElementById('tenantDisplayBadge');
  const tenantDisplayName = document.getElementById('tenantDisplayName');

  // Obtener nombre de empresa activa
  const empresaNombre = currentUser?.active_tenant_nombre || currentUser?.tenant_nombre;

  if (currentUser && currentUser.rol === 'administrador') {
    // SOLO Administrador: mostrar selector dropdown para cambiar cliente
    if (tenantBadge) tenantBadge.classList.add('hidden');
    if (adminSelector) {
      adminSelector.classList.remove('hidden');
      // Poblar el selector con clientes disponibles
      populateAdminClienteSelector();
    }
  } else if (currentUser && (currentUser.rol === 'auditor' || currentUser.rol === 'cliente')) {
    // Auditor y Cliente: mostrar solo badge informativo (sin selector)
    if (adminSelector) adminSelector.classList.add('hidden');
    if (empresaNombre && tenantBadge) {
      tenantBadge.classList.remove('hidden');
      tenantBadge.classList.add('flex');
      if (tenantDisplayName) tenantDisplayName.textContent = empresaNombre;
    } else {
      if (tenantBadge) tenantBadge.classList.add('hidden');
    }
  } else {
    if (adminSelector) adminSelector.classList.add('hidden');
    if (tenantBadge) tenantBadge.classList.add('hidden');
  }
}

function populateAdminClienteSelector() {
  const selector = document.getElementById('adminClienteSelector');
  if (!selector || !currentUser?.tenants_disponibles) return;
  
  selector.innerHTML = '<option value="">Seleccionar cliente...</option>';
  currentUser.tenants_disponibles.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    if (currentUser.active_tenant_id && parseInt(c.id) === parseInt(currentUser.active_tenant_id)) {
      opt.selected = true;
    }
    selector.appendChild(opt);
  });
}

function resetLocalState() {
  catalogs = {};
  eventosCache = [];
  mayorData = { asientos: [], total: 0 };
  balanceData = { balance: [], meses: [] };
}

async function reloadAppContext() {
  await Promise.all([
    loadEventos(),
    loadMayor(),
    loadBalance()
  ]);
}

async function changeTenant(tenantId) {
  try {
    const res = await fetch('/api/admin/change-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tenant_id: tenantId })
    });

    if (!res.ok) {
      const err = await res.json();
      showNotification(err.error || 'Error al cambiar de empresa', 'error');
      return;
    }

    const data = await res.json();

    currentUser.active_tenant_id = data.tenant.id;
    currentUser.active_tenant_nombre = data.tenant.nombre;

    showNotification(
      `Empresa activa: ${data.tenant.nombre}`,
      'success'
    );

    resetLocalState();
    await loadCatalogs();
    await reloadAppContext();

  } catch {
    showNotification('Error al cambiar de empresa', 'error');
  }
}

async function handleAdminClienteChange(e) {
  const tenantId = parseInt(e.target.value, 10);
  if (!tenantId || tenantId <= 0) return;
  await changeTenant(tenantId);
}

function populateSelect(selectId, items, valueKey = 'id', textKey = 'nombre', placeholder = 'Seleccionar...') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.replaceChildren();
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = placeholder;
  select.appendChild(defaultOpt);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = typeof textKey === 'function' ? textKey(item) : item[textKey];
    if (item.actividad_id) opt.dataset.actividadId = item.actividad_id;
    if (item.campo_id) opt.dataset.campoId = item.campo_id;
    if (item.requiere_origen_destino) opt.dataset.requiereOrigenDestino = 'true';
    if (item.requiere_campo_destino) opt.dataset.requiereCampoDestino = 'true';
    if (item.codigo) opt.dataset.codigo = item.codigo;
    select.appendChild(opt);
  });
}

function populateSelectWithGroups(selectId, tiposEvento) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.replaceChildren();
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Seleccionar tipo...';
  select.appendChild(defaultOpt);

  const grupos = {
    'Entradas': ['APERTURA', 'NACIMIENTO', 'DESTETE', 'COMPRA'],
    'Salidas': ['VENTA', 'MORTANDAD', 'CONSUMO'],
    'Reclasificaciones': ['TRASLADO', 'CAMBIO_ACTIVIDAD', 'CAMBIO_CATEGORIA'],
    'Ajustes': ['RECUENTO', 'AJUSTE_KG']
  };

  Object.entries(grupos).forEach(([grupoNombre, codigos]) => {
    const items = tiposEvento.filter(t => codigos.includes(t.codigo));
    if (items.length === 0) return;

    const optgroup = document.createElement('optgroup');
    optgroup.label = grupoNombre;

    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.nombre;
      if (item.requiere_origen_destino) opt.dataset.requiereOrigenDestino = 'true';
      if (item.requiere_campo_destino) opt.dataset.requiereCampoDestino = 'true';
      if (item.codigo) opt.dataset.codigo = item.codigo;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });
}

async function loadCatalogs() {
  try {
    catalogs = await api('/catalogs');

    if (catalogs.error) {
      catalogs = { tipos_evento: [], campos: [], actividades: [], categorias: [], cuentas: [] };
      return;
    }

    populateSelectWithGroups('tipoEvento', catalogs.tipos_evento);
    populateSelect('campo', catalogs.campos, 'id', 'nombre', 'Seleccionar campo...');
    populateSelect('campoDestino', catalogs.campos, 'id', 'nombre', 'Seleccionar campo destino...');
    populateSelect('actividadOrigen', catalogs.actividades, 'id', 'nombre', 'Seleccionar...');
    populateSelect('actividadDestino', catalogs.actividades, 'id', 'nombre', 'Seleccionar...');
    populateSelect('categoria', catalogs.categorias, 'id', item => item.nombre + ' (' + item.actividad_nombre + ')', 'Seleccionar categoria...');
    populateSelect('categoriaOrigen', catalogs.categorias, 'id', item => item.nombre + ' (' + item.actividad_nombre + ')', 'Seleccionar...');
    populateSelect('categoriaDestino', catalogs.categorias, 'id', item => item.nombre + ' (' + item.actividad_nombre + ')', 'Seleccionar...');

    populateSelect('mayorCampo', catalogs.campos, 'id', 'nombre', 'Todos los campos');
    populateSelect('mayorCategoria', catalogs.categorias, 'id', item => item.nombre + ' (' + item.actividad_nombre + ')', 'Todas las categorías');
    populateSelect('mayorCuenta', catalogs.cuentas || [], 'id', 'nombre', 'Todas las cuentas');
    populateSelect('balanceCampo', catalogs.campos, 'id', 'nombre', 'Todos');
    populateSelect('balanceCategoria', catalogs.categorias, 'id', item => item.nombre + ' (' + item.actividad_nombre + ')', 'Todas');

    document.getElementById('fecha').valueAsDate = new Date();
  } catch (err) {
    catalogs = { tipos_evento: [], campos: [], actividades: [], categorias: [], cuentas: [] };
  }
}

function calculateKgTotales() {
  const tipoSelect = document.getElementById('tipoEvento');
  const selectedOption = tipoSelect.options[tipoSelect.selectedIndex];
  if (selectedOption?.dataset.codigo === 'AJUSTE_KG') {
    return;
  }

  const cabezas = parseFloat(document.getElementById('cabezas').value) || 0;
  const kgCabeza = parseFloat(document.getElementById('kgCabeza').value) || 0;
  const kgTotales = cabezas * kgCabeza;
  document.getElementById('kgTotales').value = kgTotales > 0 ? kgTotales.toFixed(2) : '';
}

function updateCabezasValidation() {
  const tipoSelect = document.getElementById('tipoEvento');
  const selectedOption = tipoSelect.options[tipoSelect.selectedIndex];
  const isAjusteKg = selectedOption?.dataset.codigo === 'AJUSTE_KG';
  const cabezasInput = document.getElementById('cabezas');
  const kgCabezaInput = document.getElementById('kgCabeza');
  const kgTotalesInput = document.getElementById('kgTotales');
  const labelCabezas = document.getElementById('labelCabezas');
  const labelKgCabeza = document.getElementById('labelKgCabeza');
  const labelKgTotales = document.getElementById('labelKgTotales');
  const labelKgTotalesContainer = document.getElementById('labelKgTotalesContainer');

  if (isAjusteKg) {
    cabezasInput.value = '0';
    cabezasInput.readOnly = true;
    cabezasInput.classList.add('opacity-50', 'cursor-not-allowed');
    kgCabezaInput.value = '0';
    kgCabezaInput.readOnly = true;
    kgCabezaInput.classList.add('opacity-50', 'cursor-not-allowed');
    kgTotalesInput.value = '';
    kgTotalesInput.readOnly = false;
    kgTotalesInput.classList.remove('bg-border-dark', 'cursor-not-allowed', 'text-text-secondary');
    kgTotalesInput.classList.add('bg-background-dark', 'text-white');
    kgTotalesInput.required = true;
    if (labelKgTotalesContainer) labelKgTotalesContainer.classList.remove('opacity-80');
    if (labelKgTotales) labelKgTotales.innerHTML = 'Kg Ajuste (+/-) <span class="text-primary">*</span>';
    if (labelKgCabeza) labelKgCabeza.innerHTML = 'Kg por Cabeza';
    if (labelCabezas) labelCabezas.innerHTML = 'Cabezas';
  } else {
    cabezasInput.readOnly = false;
    cabezasInput.classList.remove('opacity-50', 'cursor-not-allowed');
    kgCabezaInput.readOnly = false;
    kgCabezaInput.classList.remove('opacity-50', 'cursor-not-allowed');
    kgTotalesInput.readOnly = true;
    kgTotalesInput.classList.add('bg-border-dark', 'cursor-not-allowed', 'text-text-secondary');
    kgTotalesInput.classList.remove('bg-background-dark', 'text-white');
    kgTotalesInput.required = false;
    if (labelKgTotalesContainer) labelKgTotalesContainer.classList.add('opacity-80');
    if (labelKgTotales) labelKgTotales.innerHTML = 'Kg Totales <span class="material-symbols-outlined text-sm">lock</span>';
    if (labelKgCabeza) labelKgCabeza.innerHTML = 'Kg Promedio / Cabeza <span class="text-primary">*</span>';
    if (labelCabezas) labelCabezas.innerHTML = 'Cabezas <span class="text-primary">*</span>';
  }
}


function updateDynamicFields() {
  const tipoSelect = document.getElementById('tipoEvento');
  const selectedOption = tipoSelect.options[tipoSelect.selectedIndex];
  const codigo = selectedOption?.dataset.codigo || '';

  const origenDestinoFields = document.getElementById('origenDestinoFields');
  const campoDestinoField = document.getElementById('campoDestinoField');
  const categoriaSimpleField = document.getElementById('categoriaSimpleField');
  const actividadOrigenDestinoFields = document.getElementById('actividadOrigenDestinoFields');
  const categoriaOrigenDestinoFields = document.getElementById('categoriaOrigenDestinoFields');
  const origenDestinoTitle = document.getElementById('origenDestinoTitle');

  const requiereOrigenDestino = selectedOption?.dataset.requiereOrigenDestino === 'true';
  const requiereCampoDestino = selectedOption?.dataset.requiereCampoDestino === 'true';
  const isCambioCategoria = codigo === 'CAMBIO_CATEGORIA';
  const isCambioActividad = codigo === 'CAMBIO_ACTIVIDAD';

  origenDestinoFields.classList.toggle('hidden', !requiereOrigenDestino);
  campoDestinoField.classList.toggle('hidden', !requiereCampoDestino);
  categoriaSimpleField.classList.toggle('hidden', requiereOrigenDestino);

  if (isCambioCategoria) {
    actividadOrigenDestinoFields.classList.add('hidden');
    categoriaOrigenDestinoFields.classList.remove('hidden');
    if (origenDestinoTitle) {
      origenDestinoTitle.innerHTML = '<span class="material-symbols-outlined text-primary text-xl">pets</span> Cambio de Categoría';
    }
    document.getElementById('actividadOrigen').required = false;
    document.getElementById('actividadDestino').required = false;
    document.getElementById('categoriaOrigen').required = true;
    document.getElementById('categoriaDestino').required = true;
  } else if (isCambioActividad) {
    actividadOrigenDestinoFields.classList.remove('hidden');
    categoriaOrigenDestinoFields.classList.add('hidden');
    if (origenDestinoTitle) {
      origenDestinoTitle.innerHTML = '<span class="material-symbols-outlined text-primary text-xl">agriculture</span> Cambio de Actividad';
    }
    document.getElementById('actividadOrigen').required = true;
    document.getElementById('actividadDestino').required = true;
    document.getElementById('categoriaOrigen').required = false;
    document.getElementById('categoriaDestino').required = false;
  } else if (requiereOrigenDestino) {
    actividadOrigenDestinoFields.classList.remove('hidden');
    categoriaOrigenDestinoFields.classList.remove('hidden');
    if (origenDestinoTitle) {
      origenDestinoTitle.innerHTML = '<span class="material-symbols-outlined text-primary text-xl">swap_horiz</span> Origen / Destino';
    }
    document.getElementById('actividadOrigen').required = false;
    document.getElementById('actividadDestino').required = false;
    document.getElementById('categoriaOrigen').required = true;
    document.getElementById('categoriaDestino').required = true;
  } else {
    actividadOrigenDestinoFields.classList.add('hidden');
    categoriaOrigenDestinoFields.classList.add('hidden');
    document.getElementById('actividadOrigen').required = false;
    document.getElementById('actividadDestino').required = false;
    document.getElementById('categoriaOrigen').required = false;
    document.getElementById('categoriaDestino').required = false;
  }

  document.getElementById('categoria').required = !requiereOrigenDestino;
  document.getElementById('campoDestino').required = requiereCampoDestino;
}

let eventosCache = [];

async function deleteEvento(id) {
  console.log('[EVENT CLICK DELETE]', { id });
  
  if (!confirm('¿Está seguro de eliminar este evento? Esta acción eliminará también los asientos contables asociados.')) {
    return;
  }
  
  const url = '/api/eventos/' + id;
  console.log('[EVENT FETCH]', { action: 'delete', url, method: 'DELETE' });
  
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    console.log('[EVENT FETCH RESULT]', { status: res.status, ok: res.ok });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      console.log('[EVENT FETCH ERROR]', err);
      showNotification(err.error || 'Error al eliminar evento', 'error');
      return;
    }
    showNotification('Evento eliminado correctamente');
    loadEventos();
  } catch (err) {
    console.log('[EVENT FETCH EXCEPTION]', err);
    showNotification('Error al eliminar evento: ' + (err.message || err), 'error');
  }
}

async function editEvento(id) {
  console.log('[EVENT CLICK EDIT]', { id });
  
  const evento = eventosCache.find(e => e.id === parseInt(id));
  if (!evento) {
    showNotification('Evento no encontrado', 'error');
    return;
  }
  
  const nuevaFecha = prompt('Fecha (YYYY-MM-DD):', evento.fecha.split('T')[0]);
  if (nuevaFecha === null) return;
  
  const nuevasCabezas = prompt('Cabezas:', evento.cabezas);
  if (nuevasCabezas === null) return;
  
  const nuevoKgCabeza = prompt('Kg por cabeza:', evento.kg_cabeza || '');
  if (nuevoKgCabeza === null) return;
  
  const nuevasObservaciones = prompt('Observaciones:', evento.observaciones || '');
  if (nuevasObservaciones === null) return;
  
  try {
    const updateData = {
      fecha: nuevaFecha,
      cabezas: parseInt(nuevasCabezas),
      observaciones: nuevasObservaciones
    };
    if (nuevoKgCabeza) {
      updateData.kg_cabeza = parseFloat(nuevoKgCabeza);
      updateData.kg_totales = parseFloat(nuevoKgCabeza) * parseInt(nuevasCabezas);
    }
    
    const url = '/api/eventos/' + id;
    console.log('[EVENT FETCH]', { action: 'edit', url, method: 'PUT', body: updateData });
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    console.log('[EVENT FETCH RESULT]', { status: res.status, ok: res.ok });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      console.log('[EVENT FETCH ERROR]', err);
      showNotification(err.error || 'Error al actualizar evento', 'error');
      return;
    }
    showNotification('Evento actualizado correctamente');
    loadEventos();
  } catch (err) {
    console.log('[EVENT FETCH EXCEPTION]', err);
    showNotification('Error al actualizar evento: ' + (err.message || err), 'error');
  }
}

function updateDashboardKPIs(eventos) {
  const kpiStockEl = document.getElementById('kpiStockTotal');
  const kpiEventosEl = document.getElementById('kpiEventosMes');
  const kpiEstadoEl = document.getElementById('kpiEstado');
  const estadoCard = kpiEstadoEl?.closest('.bg-surface-dark');
  const estadoIcon = estadoCard?.querySelector('.material-symbols-outlined');
  const estadoIconContainer = estadoIcon?.parentElement;
  const estadoSubtexto = estadoCard?.querySelector('.text-text-secondary.text-xs:last-child');
  
  if (!eventos || eventos.length === 0) {
    if (kpiStockEl) kpiStockEl.textContent = '0';
    if (kpiEventosEl) kpiEventosEl.textContent = '0';
    if (kpiEstadoEl) {
      kpiEstadoEl.className = 'text-red-400 text-lg font-bold flex items-center gap-1';
      kpiEstadoEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span> Desactualizado';
    }
    if (estadoIcon) {
      estadoIcon.textContent = 'error';
      estadoIcon.className = 'material-symbols-outlined text-red-400 text-2xl';
    }
    if (estadoIconContainer) {
      estadoIconContainer.className = 'w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center';
    }
    if (estadoSubtexto) estadoSubtexto.textContent = 'Datos antiguos. Revisar carga.';
    return;
  }
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const eventosMesActual = eventos.filter(e => {
    const fecha = new Date(e.fecha);
    return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear;
  });
  
  if (kpiEventosEl) kpiEventosEl.textContent = eventosMesActual.length.toLocaleString('es-AR');
  
  let stockTotal = 0;
  const entradas = ['APERTURA', 'NACIMIENTO', 'DESTETE', 'COMPRA'];
  const salidas = ['VENTA', 'MORTANDAD', 'CONSUMO'];
  
  eventos.forEach(e => {
    const codigo = e.tipo_codigo || '';
    if (entradas.includes(codigo)) {
      stockTotal += e.cabezas || 0;
    } else if (salidas.includes(codigo)) {
      stockTotal -= e.cabezas || 0;
    }
  });
  
  if (kpiStockEl) kpiStockEl.textContent = stockTotal.toLocaleString('es-AR');
  
  const sortedEventos = [...eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimoEvento = sortedEventos[0];
  const ultimaFecha = new Date(ultimoEvento.fecha);
  const diffTime = Math.abs(now - ultimaFecha);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (kpiEstadoEl && estadoIcon && estadoIconContainer && estadoSubtexto) {
    if (diffDays <= 7) {
      kpiEstadoEl.className = 'text-green-400 text-lg font-bold flex items-center gap-1';
      kpiEstadoEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-400"></span> Al día';
      estadoIcon.textContent = 'check_circle';
      estadoIcon.className = 'material-symbols-outlined text-green-400 text-2xl';
      estadoIconContainer.className = 'w-12 h-12 rounded-xl bg-green-900/30 flex items-center justify-center';
      estadoSubtexto.textContent = diffDays === 0 ? 'Último registro: hoy' : `Último registro: hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffDays <= 15) {
      kpiEstadoEl.className = 'text-yellow-400 text-lg font-bold flex items-center gap-1';
      kpiEstadoEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400"></span> Atención';
      estadoIcon.textContent = 'warning';
      estadoIcon.className = 'material-symbols-outlined text-yellow-400 text-2xl';
      estadoIconContainer.className = 'w-12 h-12 rounded-xl bg-yellow-900/30 flex items-center justify-center';
      estadoSubtexto.textContent = `Sin novedades hace ${diffDays} días`;
    } else {
      kpiEstadoEl.className = 'text-red-400 text-lg font-bold flex items-center gap-1';
      kpiEstadoEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span> Desactualizado';
      estadoIcon.textContent = 'error';
      estadoIcon.className = 'material-symbols-outlined text-red-400 text-2xl';
      estadoIconContainer.className = 'w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center';
      estadoSubtexto.textContent = 'Datos antiguos. Revisar carga.';
    }
  }
}

async function loadEventos() {
  const container = document.getElementById('eventosRecientes');
  try {
    const data = await api('/eventos');
    if (data.error) {
      container.innerHTML = '<p class="p-8 text-center text-text-secondary">Seleccione un cliente para ver eventos</p>';
      updateDashboardKPIs([]);
      return;
    }
    if (!data.eventos || data.eventos.length === 0) {
      container.innerHTML = '<p class="p-8 text-center text-text-secondary">No hay eventos registrados</p>';
      updateDashboardKPIs([]);
      return;
    }
    
    eventosCache = data.eventos;
    updateDashboardKPIs(data.eventos);

    let html = '<table class="w-full min-w-[800px]"><thead>' +
      '<tr class="bg-surface-dark border-b border-border-dark">' +
      '<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary">Fecha</th>' +
      '<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary">Tipo</th>' +
      '<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary">Campo</th>' +
      '<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary">Categoría</th>' +
      '<th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Cabezas</th>' +
      '<th class="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Kg</th>' +
      '<th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-secondary">Acciones</th>' +
      '</tr></thead><tbody class="divide-y divide-border-dark">';

    const canEditEvent = currentUser && (currentUser.rol === 'administrador' || currentUser.rol === 'auditor');
    const canDeleteEvent = currentUser && (currentUser.rol === 'administrador' || currentUser.rol === 'auditor');

    data.eventos.slice(0, 30).forEach(e => {
      const cat = e.categoria_nombre || e.categoria_origen_nombre || '-';
      let accionesBtns = '<div class="flex items-center justify-center gap-1">';
      if (canEditEvent) {
        accionesBtns += `<button data-action="edit-evento" data-id="${e.id}" class="p-1.5 text-text-secondary hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors" title="Editar evento">
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>`;
      }
      if (canDeleteEvent) {
        accionesBtns += `<button data-action="delete-evento" data-id="${e.id}" class="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar evento">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>`;
      }
      if (!canEditEvent && !canDeleteEvent) {
        accionesBtns += '<span class="text-text-secondary text-xs">-</span>';
      }
      accionesBtns += '</div>';
      html += '<tr class="hover:bg-surface-dark/50 transition-colors">' +
        '<td class="px-4 py-3 text-sm text-white font-medium">' + escapeHtml(e.fecha.split('T')[0]) + '</td>' +
        '<td class="px-4 py-3 text-sm text-white">' + escapeHtml(e.tipo_nombre) + '</td>' +
        '<td class="px-4 py-3 text-sm text-text-secondary">' + escapeHtml(e.campo_nombre) + '</td>' +
        '<td class="px-4 py-3 text-sm text-text-secondary">' + escapeHtml(cat) + '</td>' +
        '<td class="px-4 py-3 text-sm text-right font-mono font-medium text-white">' + e.cabezas.toLocaleString('es-AR') + '</td>' +
        '<td class="px-4 py-3 text-sm text-right font-mono font-medium text-text-secondary">' + (e.kg_totales ? parseFloat(e.kg_totales).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 1}) : '-') + '</td>' +
        '<td class="px-4 py-3 text-center">' + accionesBtns + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p class="p-8 text-center text-text-secondary">Error al cargar eventos</p>';
  }
}

let mayorData = { asientos: [], total: 0 };
let mayorPage = 1;
const mayorPageSize = 10;

async function loadLedger() {
  const tbody = document.getElementById('mayorTableBody');
  const mes = document.getElementById('mayorMes')?.value;
  const campoId = document.getElementById('mayorCampo')?.value;
  const categoriaId = document.getElementById('mayorCategoria')?.value;
  const cuentaId = document.getElementById('mayorCuenta')?.value;

  // Mostrar estado de carga
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-text-secondary"><span class="material-symbols-outlined animate-spin mr-2">sync</span>Cargando datos...</td></tr>';
  }

  let endpoint = '/ledger';
  const params = [];
  
  // Si hay un mes seleccionado, calcular rango desde/hasta
  if (mes && mes !== 'Todos' && mes !== '') {
    const [year, month] = mes.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const lastDayFormatted = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    params.push('desde=' + firstDay);
    params.push('hasta=' + lastDayFormatted);
  }
  if (campoId && campoId !== '') params.push('campo_id=' + campoId);
  if (categoriaId && categoriaId !== '') params.push('categoria_id=' + categoriaId);
  if (cuentaId && cuentaId !== '') params.push('cuenta_id=' + cuentaId);
  if (mayorCategoriaView === 'gestor') params.push('categoria_view=gestor');
  if (params.length) endpoint += '?' + params.join('&');

  try {
    const data = await api(endpoint);
    if (data.error) {
      tbody.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-text-secondary">Seleccione un cliente para ver el mayor</td></tr>';
      updateMayorTotals(0, 0, 0, 0);
      updateMayorPagination(0, 0);
      return;
    }

    mayorData.asientos = data.asientos || [];
    mayorData.total = mayorData.asientos.length;
    mayorPage = 1;

    // Poblar el select de meses si hay datos
    if (data.meses && data.meses.length > 0) {
      const mayorMesSelect = document.getElementById('mayorMes');
      const currentValue = mayorMesSelect.value;
      mayorMesSelect.innerHTML = '<option value="">Todos</option>';
      data.meses.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        mayorMesSelect.appendChild(opt);
      });
      if (currentValue) mayorMesSelect.value = currentValue;
    }

    renderMayorTable();

    if (currentUser?.rol === 'auditor' || currentUser?.rol === 'administrador') {
      document.getElementById('auditNotification')?.classList.remove('hidden');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-text-secondary">Error al cargar el mayor</td></tr>';
  }
}

function renderMayorTable() {
  const tbody = document.getElementById('mayorTableBody');
  if (!tbody) return;

  const asientos = mayorData.asientos;
  if (!asientos || asientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-text-secondary">No hay asientos registrados</td></tr>';
    updateMayorTotals(0, 0, 0, 0);
    updateMayorPagination(0, 0);
    return;
  }

  const start = (mayorPage - 1) * mayorPageSize;
  const end = Math.min(start + mayorPageSize, asientos.length);
  const pageData = asientos.slice(start, end);

  let totalDebeCab = 0, totalHaberCab = 0, totalDebeKg = 0, totalHaberKg = 0;
  asientos.forEach(a => {
    if (a.tipo === 'DEBE') {
      totalDebeCab += parseFloat(a.cabezas) || 0;
      totalDebeKg += parseFloat(a.kg) || 0;
    } else {
      totalHaberCab += parseFloat(a.cabezas) || 0;
      totalHaberKg += parseFloat(a.kg) || 0;
    }
  });

  let html = '';
  pageData.forEach(a => {
    const debeCab = a.tipo === 'DEBE' ? a.cabezas : '';
    const haberCab = a.tipo === 'HABER' ? a.cabezas : '';
    const debeKg = a.tipo === 'DEBE' ? (a.kg || 0) : '';
    const haberKg = a.tipo === 'HABER' ? (a.kg || 0) : '';
    const kgCabeza = a.kg_cabeza ? parseFloat(a.kg_cabeza).toLocaleString('es-AR') : '-';
    const fecha = a.fecha ? a.fecha.split('T')[0].split('-').reverse().join('/') : '-';

    const isExistenciaHacienda = (a.cuenta_nombre || '').toLowerCase().includes('existencia') || 
                                  (a.cuenta_nombre || '').toLowerCase().includes('ganado');
    const cuentaClass = isExistenciaHacienda ? 'text-primary font-semibold' : 'text-text-secondary';
    const referencia = a.tipo_evento_codigo || a.tipo_evento_nombre || '-';

    html += `
      <tr class="hover:bg-[#271c1c]/50 transition-colors">
        <td class="px-4 py-3 text-sm text-white">${escapeHtml(fecha)}</td>
        <td class="px-4 py-3 text-sm text-white">${escapeHtml(a.campo_nombre || '-')}</td>
        <td class="px-4 py-3 text-sm ${cuentaClass}">${escapeHtml(a.cuenta_nombre || '-')}</td>
        <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(a.categoria_nombre || 'General')}</td>
        <td class="px-4 py-3 text-sm text-right font-mono font-medium text-green-500 border-l border-[#392828]">${debeCab !== '' ? formatNum(debeCab) : '-'}</td>
        <td class="px-4 py-3 text-sm text-right font-mono font-medium text-red-500">${haberCab !== '' ? formatNum(haberCab) : '-'}</td>
        <td class="px-4 py-3 text-sm text-right font-mono font-medium text-green-500 border-l border-[#392828]">${debeKg !== '' ? formatKg(debeKg) : '-'}</td>
        <td class="px-4 py-3 text-sm text-right font-mono font-medium text-red-500">${haberKg !== '' ? formatKg(haberKg) : '-'}</td>
        <td class="px-4 py-3 text-sm text-right font-mono text-text-secondary border-l border-[#392828]">${escapeHtml(kgCabeza)}</td>
        <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(referencia)}</td>
      </tr>`;
  });

  tbody.innerHTML = html;
  updateMayorTotals(totalDebeCab, totalHaberCab, totalDebeKg, totalHaberKg);
  updateMayorPagination(start + 1, end);
}

function updateMayorTotals(debeCab, haberCab, debeKg, haberKg) {
  const footer = document.getElementById('mayorTableFooter');
  if (!footer) return;

  footer.innerHTML = `
    <tr>
      <td colspan="5" class="px-4 py-4 text-right text-white font-bold uppercase">Totales del Período</td>
      <td class="px-4 py-4 text-right font-bold text-green-500 font-mono border-l border-[#392828]">${formatNum(debeCab)}</td>
      <td class="px-4 py-4 text-right font-bold text-red-500 font-mono">${formatNum(haberCab)}</td>
      <td class="px-4 py-4 text-right font-bold text-green-500 font-mono border-l border-[#392828]">${formatKg(debeKg)}</td>
      <td class="px-4 py-4 text-right font-bold text-red-500 font-mono">${formatKg(haberKg)}</td>
      <td colspan="2"></td>
    </tr>`;
}

function updateMayorPagination(start, end) {
  const total = mayorData.total;
  const info = document.getElementById('mayorPaginationInfo');
  if (info) info.textContent = `Mostrando ${start}-${end} de ${total} registros`;

  const totalPages = Math.ceil(total / mayorPageSize);
  const pageNums = document.getElementById('mayorPageNums');
  if (pageNums) {
    let html = '';
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      const active = i === mayorPage;
      html += `<button data-page="${i}" class="mayor-page-btn w-8 h-8 rounded-lg ${active ? 'bg-primary text-white' : 'bg-[#271c1c] border border-[#392828] text-text-secondary hover:text-white'} flex items-center justify-center text-sm font-medium">${i}</button>`;
    }
    if (totalPages > 5) {
      html += '<span class="text-text-secondary px-1">...</span>';
      html += `<button data-page="${totalPages}" class="mayor-page-btn w-8 h-8 rounded-lg bg-[#271c1c] border border-[#392828] text-text-secondary hover:text-white flex items-center justify-center text-sm font-medium">${totalPages}</button>`;
    }
    pageNums.innerHTML = html;
  }

  const prevBtn = document.getElementById('prevMayorPage');
  const nextBtn = document.getElementById('nextMayorPage');
  if (prevBtn) prevBtn.disabled = mayorPage <= 1;
  if (nextBtn) nextBtn.disabled = mayorPage >= totalPages;
}

window.irAPaginaMayor = function(page) {
  mayorPage = page;
  renderMayorTable();
};

window.cambiarPaginaMayor = function(delta) {
  const totalPages = Math.ceil(mayorData.total / mayorPageSize);
  const newPage = mayorPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    mayorPage = newPage;
    renderMayorTable();
  }
};

window.aplicarFiltrosMayor = function() {
  mayorPage = 1;
  loadLedger();
};

window.limpiarFiltrosMayor = function() {
  // Resetear todos los filtros visuales
  const mayorMes = document.getElementById('mayorMes');
  const mayorCampo = document.getElementById('mayorCampo');
  const mayorCategoria = document.getElementById('mayorCategoria');
  const mayorCuenta = document.getElementById('mayorCuenta');
  
  if (mayorMes) mayorMes.value = '';
  if (mayorCampo) mayorCampo.value = '';
  if (mayorCategoria) mayorCategoria.value = '';
  if (mayorCuenta) mayorCuenta.value = '';
  
  // Resetear página y variables de filtro
  mayorPage = 1;
  mayorData = { asientos: [], total: 0 };
  
  // Disparar nueva petición al servidor con filtros limpios
  console.log('[Mayor] Restableciendo filtros y recargando datos del servidor...');
  loadLedger();
  showNotification('Filtros restablecidos', 'info');
};

window.exportMayorCSV = function() {
  const asientos = mayorData.asientos;
  if (!asientos || asientos.length === 0) {
    showNotification('No hay datos para exportar', 'error');
    return;
  }

  const empresaNombre = currentUser?.active_tenant_nombre || 'Dolores_Herrera_Vegas_SRL';
  const fechaReporte = new Date().toISOString().split('T')[0];
  
  let csv = 'Fecha;Campo;Cuenta Contable;Categoria;Debe Cab;Haber Cab;Debe Kg;Haber Kg;Kg/Cab;Referencia\n';
  asientos.forEach(a => {
    const fecha = a.fecha ? a.fecha.split('T')[0] : '';
    const debeCab = a.tipo === 'DEBE' ? (a.cabezas || 0) : '';
    const haberCab = a.tipo === 'HABER' ? (a.cabezas || 0) : '';
    const debeKg = a.tipo === 'DEBE' ? (a.kg || '') : '';
    const haberKg = a.tipo === 'HABER' ? (a.kg || '') : '';
    const campo = (a.campo_nombre || '').replace(/;/g, ',');
    const cuenta = (a.cuenta_nombre || '').replace(/;/g, ',');
    const categoria = (a.categoria_nombre || '').replace(/;/g, ',');
    const referencia = (a.tipo_evento_nombre || '').replace(/;/g, ',');
    csv += `${fecha};${campo};${cuenta};${categoria};${debeCab};${haberCab};${debeKg};${haberKg};${a.kg_cabeza || ''};${referencia}\n`;
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const empresaSlug = empresaNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  link.download = `Mayor_${empresaSlug}_${fechaReporte}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  showNotification('Archivo CSV exportado correctamente');
};

window.nuevoAsiento = function() {
  showTab('eventos');
  showNotification('Registre un nuevo evento para generar asientos contables', 'info');
};

async function loadBalance() {
  const container = document.getElementById('balanceTree');
  const campoId = document.getElementById('balanceCampo')?.value;
  const mesId = document.getElementById('balanceMes')?.value;

  // Mostrar estado de carga
  if (container) {
    container.innerHTML = '<p class="p-8 text-center text-text-secondary"><span class="material-symbols-outlined animate-spin mr-2">sync</span>Cargando balance...</p>';
  }

  const params = [];
  if (campoId && campoId !== '') params.push('campo_id=' + campoId);
  
  // Si es modo "mes" y hay un mes seleccionado, calcular rango desde/hasta
  if (balanceMode === 'mes' && mesId && mesId !== '') {
    const [year, month] = mesId.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const lastDayFormatted = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    params.push('desde=' + firstDay);
    params.push('hasta=' + lastDayFormatted);
  }
  // Si es modo "acumulado", no se envían parámetros de fecha (trae todo el histórico)
  if (balanceCategoriaView === 'gestor') params.push('categoria_view=gestor');

  let endpoint = '/balance';
  if (params.length) endpoint += '?' + params.join('&');

  try {
    const data = await api(endpoint);

    if (data.error) {
      container.innerHTML = '<p class="p-8 text-center text-text-secondary">Seleccione un cliente para ver el balance</p>';
      return;
    }

    balanceData = data;

    if (data.meses && data.meses.length > 0) {
      const balanceMesSelect = document.getElementById('balanceMes');
      const currentValue = balanceMesSelect.value;
      balanceMesSelect.innerHTML = '<option value="">Todos los periodos</option>';

      data.meses.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = formatMes(m);
        balanceMesSelect.appendChild(opt);
      });

      if (currentValue && balanceMode === 'mes') {
        balanceMesSelect.value = currentValue;
      } else if (balanceMode === 'acumulado') {
        balanceMesSelect.value = '';
      }

      const mayorMesSelect = document.getElementById('mayorMes');
      if (mayorMesSelect) {
        mayorMesSelect.innerHTML = '<option value="">Todos</option>';
        data.meses.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          mayorMesSelect.appendChild(opt);
        });
      }
    }

    console.log('[Balance] Datos cargados:', data.balance?.length || 0, 'registros,', data.meses?.length || 0, 'meses');
    renderBalanceTree(data.balance || [], data.meses || []);
  } catch (err) {
    console.error('Error loading balance:', err);
    container.innerHTML = '<p class="p-8 text-center text-text-secondary">Error al cargar el balance</p>';
  }
}

function formatMes(mes) {
  const [year, month] = mes.split('-');
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return monthNames[parseInt(month) - 1] + ' ' + year;
}

window.setBalanceMode = function(mode, preserveMonth = false) {
  balanceMode = mode;
  const btnMes = document.getElementById('btnMovMes');
  const btnAcum = document.getElementById('btnAcumulado');
  const balanceMesSelect = document.getElementById('balanceMes');

  if (mode === 'mes') {
    btnMes.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnAcum.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
    if (balanceMesSelect && !preserveMonth) {
      if (!balanceMesSelect.value && balanceData.meses && balanceData.meses.length > 0) {
        balanceMesSelect.value = balanceData.meses[balanceData.meses.length - 1];
      }
    }
  } else {
    btnAcum.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnMes.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
    if (balanceMesSelect) {
      balanceMesSelect.value = '';
    }
  }

  console.log('[Balance] Modo cambiado a:', mode, 'Mes seleccionado:', balanceMesSelect?.value || 'ninguno');
  
  // Disparar nueva petición al servidor con los parámetros correctos según el modo
  loadBalance();
};

window.setMayorCategoriaView = function(view) {
  mayorCategoriaView = view;
  const btnCliente = document.getElementById('btnMayorVistaCliente');
  const btnGestor = document.getElementById('btnMayorVistaGestor');
  
  if (view === 'cliente') {
    btnCliente.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnGestor.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
  } else {
    btnGestor.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnCliente.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
  }
  
  console.log('[Mayor] Vista de categoría cambiada a:', view);
  loadLedger();
};

window.setBalanceCategoriaView = function(view) {
  balanceCategoriaView = view;
  const btnCliente = document.getElementById('btnBalanceVistaCliente');
  const btnGestor = document.getElementById('btnBalanceVistaGestor');
  
  if (view === 'cliente') {
    btnCliente.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnGestor.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
  } else {
    btnGestor.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-primary text-white';
    btnCliente.className = 'flex-1 px-3 py-2.5 text-sm font-medium bg-[#271c1c] text-text-secondary hover:text-white transition-colors';
  }
  
  console.log('[Balance] Vista de categoría cambiada a:', view);
  loadBalance();
};

window.printBalance = function() {
  const table = document.querySelector('#balanceTree table');
  if (!table) {
    showNotification('No hay datos para imprimir. Seleccione un cliente y verifique que existan datos de balance.', 'warning');
    return;
  }
  window.print();
};

window.exportBalanceCSV = function() {
  const data = balanceData.balance || [];
  if (!data || data.length === 0) {
    showNotification('No hay datos para exportar. Seleccione un cliente y verifique que existan datos de balance.', 'warning');
    return;
  }
  
  const modoTexto = balanceMode === 'mes' ? 
    'Movimientos ' + (document.getElementById('balanceMes')?.selectedOptions[0]?.text || '') :
    'Acumulado Total';
  const campoTexto = document.getElementById('balanceCampo')?.selectedOptions[0]?.text || 'Todos los campos';
  const fechaReporte = new Date().toLocaleDateString('es-AR');
  const selectedMes = document.getElementById('balanceMes')?.value || '';
  
  const hierarchy = {};
  let stockTotal = { cab: 0, kg: 0 };
  
  data.forEach(row => {
    const planCodigo = row.plan_codigo || 'ACT';
    const planNombre = row.plan_nombre || 'Activo';
    const campoId = row.campo_id || 0;
    const campoNombre = row.campo_nombre || 'Sin Campo';
    const cuentaCodigo = row.cuenta_codigo || '';
    const cuentaNombre = row.cuenta_nombre || 'Sin Cuenta';
    const categoriaNombre = row.categoria_nombre || 'Sin Categoria';
    const mes = row.mes || '';
    
    if (balanceMode === 'mes' && selectedMes && mes !== selectedMes) return;
    
    const saldo_cab = parseFloat(row.saldo_cabezas) || 0;
    const saldo_kg = parseFloat(row.saldo_kg) || 0;
    
    if (!hierarchy[planCodigo]) {
      hierarchy[planCodigo] = { nombre: planNombre, campos: {}, totals: { cab: 0, kg: 0 } };
    }
    if (!hierarchy[planCodigo].campos[campoId]) {
      hierarchy[planCodigo].campos[campoId] = { nombre: campoNombre, cuentas: {}, totals: { cab: 0, kg: 0 } };
    }
    const cuentaKey = cuentaCodigo + '_' + cuentaNombre;
    if (!hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey]) {
      hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey] = { 
        codigo: cuentaCodigo, nombre: cuentaNombre, categorias: {}, totals: { cab: 0, kg: 0 } 
      };
    }
    if (!hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre]) {
      hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre] = { cab: 0, kg: 0 };
    }
    
    const cat = hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre];
    cat.cab += saldo_cab;
    cat.kg += saldo_kg;
    hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].totals.cab += saldo_cab;
    hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].totals.kg += saldo_kg;
    hierarchy[planCodigo].campos[campoId].totals.cab += saldo_cab;
    hierarchy[planCodigo].campos[campoId].totals.kg += saldo_kg;
    hierarchy[planCodigo].totals.cab += saldo_cab;
    hierarchy[planCodigo].totals.kg += saldo_kg;
    
    if (planCodigo === 'ACT') {
      stockTotal.cab += saldo_cab;
      stockTotal.kg += saldo_kg;
    }
  });
  
  function formatNum(val) {
    if (val === 0) return 0;
    return Math.round(val * 100) / 100;
  }
  
  function calcKgCab(cab, kg) {
    if (Math.abs(cab) < 0.001) return 0;
    return Math.round(Math.abs(kg / cab));
  }
  
  const csvRows = [];
  csvRows.push('"BALANCE CONTABLE - GESTOR GANADERO"');
  csvRows.push(`"Empresa:","Dolores Herrera Vegas SRL"`);
  csvRows.push(`"Periodo:","${modoTexto}"`);
  csvRows.push(`"Campo:","${campoTexto}"`);
  csvRows.push(`"Fecha de Reporte:","${fechaReporte}"`);
  csvRows.push('');
  csvRows.push('"CONCEPTO / CUENTA","CABEZAS","TOTAL KG","KG/CAB"');
  
  const planOrder = ['ACT', 'PN', 'RES'];
  const sortedPlans = Object.entries(hierarchy).sort((a, b) => {
    return (planOrder.indexOf(a[0]) ?? 99) - (planOrder.indexOf(b[0]) ?? 99);
  });
  
  sortedPlans.forEach(([planCodigo, plan]) => {
    const planKgCab = planCodigo === 'ACT' ? calcKgCab(plan.totals.cab, plan.totals.kg) : 0;
    csvRows.push(`"${plan.nombre.toUpperCase()}",${formatNum(plan.totals.cab)},${formatNum(plan.totals.kg)},${planKgCab}`);
    
    Object.entries(plan.campos).forEach(([campoId, campo]) => {
      const campoKgCab = planCodigo === 'ACT' ? calcKgCab(campo.totals.cab, campo.totals.kg) : 0;
      csvRows.push(`"    ${campo.nombre}",${formatNum(campo.totals.cab)},${formatNum(campo.totals.kg)},${campoKgCab}`);
      
      Object.entries(campo.cuentas).forEach(([cuentaKey, cuenta]) => {
        const cuentaKgCab = planCodigo === 'ACT' ? calcKgCab(cuenta.totals.cab, cuenta.totals.kg) : 0;
        const cuentaDesc = cuenta.codigo ? `${cuenta.codigo} - ${cuenta.nombre}` : cuenta.nombre;
        csvRows.push(`"        ${cuentaDesc}",${formatNum(cuenta.totals.cab)},${formatNum(cuenta.totals.kg)},${cuentaKgCab}`);
        
        Object.entries(cuenta.categorias).forEach(([catNombre, cat]) => {
          const catKgCab = planCodigo === 'ACT' ? calcKgCab(cat.cab, cat.kg) : 0;
          csvRows.push(`"            ${catNombre}",${formatNum(cat.cab)},${formatNum(cat.kg)},${catKgCab}`);
        });
      });
    });
  });
  
  if (stockTotal.cab !== 0 || stockTotal.kg !== 0) {
    csvRows.push('');
    csvRows.push(`"TOTAL STOCK GANADERO",${formatNum(stockTotal.cab)},${formatNum(stockTotal.kg)},${calcKgCab(stockTotal.cab, stockTotal.kg)}`);
  }
  
  const csvContent = "\ufeff" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  
  const empresaNombre = currentUser?.active_tenant_nombre || 'Dolores_Herrera_Vegas_SRL';
  const empresaSlug = empresaNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  link.download = `Balance_${empresaSlug}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  
  showNotification('CSV generado correctamente');
};

function renderBalanceTree(data, meses) {
  const container = document.getElementById('balanceTree');
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="p-8 text-center text-text-secondary">Sin datos de balance</p>';
    return;
  }

  const searchTerm = (document.getElementById('balanceSearch')?.value || '').toLowerCase();
  const selectedMes = document.getElementById('balanceMes')?.value || '';

  console.log('[Balance] Renderizando - Modo:', balanceMode, 'Mes:', selectedMes, 'Registros:', data.length);

  if (balanceMode === 'mes' && !selectedMes) {
    container.innerHTML = `
      <div class="p-8 text-center">
        <span class="material-symbols-outlined text-4xl text-text-secondary mb-2">calendar_month</span>
        <p class="text-text-secondary">Seleccione un periodo para ver los movimientos del mes</p>
      </div>`;
    return;
  }

  // Jerarquía correcta: Plan → Campo → Cuenta → Categoría
  const hierarchy = {};
  let stockTotal = { cab: 0, kg: 0 }; // Solo Activo

  data.forEach(row => {
    const planCodigo = row.plan_codigo || 'ACT';
    const planNombre = row.plan_nombre || 'Activo';
    const campoId = row.campo_id || 0;
    const campoNombre = row.campo_nombre || 'Sin Campo';
    const cuentaId = row.cuenta_id || 0;
    const cuentaCodigo = row.cuenta_codigo || '';
    const cuentaNombre = row.cuenta_nombre || 'Sin Cuenta';
    const categoriaNombre = row.categoria_nombre || 'Sin Categoría';
    const mes = row.mes || '';

    // Búsqueda por campo, cuenta o categoría
    if (searchTerm && 
        !campoNombre.toLowerCase().includes(searchTerm) && 
        !cuentaNombre.toLowerCase().includes(searchTerm) &&
        !categoriaNombre.toLowerCase().includes(searchTerm)) {
      return;
    }

    // En modo Movimientos Mes: solo mostrar el mes seleccionado
    // Si no hay mes seleccionado, mostrar mensaje para que seleccione uno
    if (balanceMode === 'mes' && selectedMes) {
      if (mes !== selectedMes) return;
    }

    // Saldo neto = Debe - Haber (ya viene calculado del backend)
    const saldo_cab = parseFloat(row.saldo_cabezas) || 0;
    const saldo_kg = parseFloat(row.saldo_kg) || 0;

    // Construir jerarquía
    if (!hierarchy[planCodigo]) {
      hierarchy[planCodigo] = { nombre: planNombre, campos: {}, totals: { cab: 0, kg: 0 } };
    }

    if (!hierarchy[planCodigo].campos[campoId]) {
      hierarchy[planCodigo].campos[campoId] = { nombre: campoNombre, cuentas: {}, totals: { cab: 0, kg: 0 } };
    }

    const cuentaKey = cuentaId + '_' + cuentaCodigo;
    if (!hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey]) {
      hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey] = { 
        codigo: cuentaCodigo, 
        nombre: cuentaNombre, 
        categorias: {}, 
        totals: { cab: 0, kg: 0 } 
      };
    }

    if (!hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre]) {
      hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre] = { cab: 0, kg: 0 };
    }

    // Acumular valores
    const cat = hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].categorias[categoriaNombre];
    cat.cab += saldo_cab;
    cat.kg += saldo_kg;

    hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].totals.cab += saldo_cab;
    hierarchy[planCodigo].campos[campoId].cuentas[cuentaKey].totals.kg += saldo_kg;
    hierarchy[planCodigo].campos[campoId].totals.cab += saldo_cab;
    hierarchy[planCodigo].campos[campoId].totals.kg += saldo_kg;
    hierarchy[planCodigo].totals.cab += saldo_cab;
    hierarchy[planCodigo].totals.kg += saldo_kg;

    // Stock solo del Activo
    if (planCodigo === 'ACT') {
      stockTotal.cab += saldo_cab;
      stockTotal.kg += saldo_kg;
    }
  });

  function formatSaldo(val) {
    if (val === 0) return '-';
    const num = parseFloat(val);
    const formatted = Math.abs(num).toLocaleString('es-AR');
    return num < 0 ? '(' + formatted + ')' : formatted;
  }

  function formatSaldoKg(val) {
    if (val === 0) return '-';
    const num = parseFloat(val);
    const formatted = Math.abs(num).toLocaleString('es-AR') + ' kg';
    return num < 0 ? '(' + formatted + ')' : formatted;
  }

  function calcKgProm(cab, kg) {
    if (Math.abs(cab) < 0.001) return '-';
    return Math.round(Math.abs(kg / cab)) + ' kg';
  }

  function getPlanDescription(codigo) {
    if (codigo === 'ACT') return 'Stock ganadero (existencias)';
    if (codigo === 'PN') return 'Aportes de capital';
    if (codigo === 'RES') return 'Movimientos del período';
    return '';
  }

  let html = `<table class="w-full text-sm">
    <thead>
      <tr class="border-b border-[#392828]">
        <th class="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-secondary w-1/2">Jerarquía Contable</th>
        <th class="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Saldo Cabezas</th>
        <th class="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Saldo Kg</th>
        <th class="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Kg/Cab</th>
      </tr>
    </thead>
    <tbody>`;

  const planOrder = ['ACT', 'PN', 'RES'];
  const sortedPlans = Object.entries(hierarchy).sort((a, b) => {
    return (planOrder.indexOf(a[0]) ?? 99) - (planOrder.indexOf(b[0]) ?? 99);
  });

  let rowIndex = 0;

  sortedPlans.forEach(([planCodigo, plan]) => {
    const planKgProm = planCodigo === 'ACT' ? calcKgProm(plan.totals.cab, plan.totals.kg) : '-';
    const planDesc = getPlanDescription(planCodigo);
    const isActivo = planCodigo === 'ACT';

    html += `
      <tr class="bg-[#271c1c] hover:bg-[#322424] cursor-pointer balance-row" data-level="0" data-index="${rowIndex}" data-expanded="true">
        <td class="px-4 py-3 font-bold text-white">
          <span class="inline-flex items-center gap-2">
            <span class="material-symbols-outlined text-lg toggle-icon">expand_more</span>
            <span>${escapeHtml(plan.nombre)}</span>
          </span>
          <span class="text-text-secondary text-xs ml-2">${escapeHtml(planDesc)}</span>
        </td>
        <td class="px-4 py-3 text-right font-bold ${isActivo ? 'text-white' : 'text-text-secondary'} font-mono">${formatSaldo(plan.totals.cab)}</td>
        <td class="px-4 py-3 text-right font-bold ${isActivo ? 'text-white' : 'text-text-secondary'} font-mono">${formatSaldoKg(plan.totals.kg)}</td>
        <td class="px-4 py-3 text-right font-bold ${isActivo ? 'text-white' : 'text-text-secondary'} font-mono">${planKgProm}</td>
      </tr>`;

    const planIdx = rowIndex++;

    const sortedCampos = Object.entries(plan.campos).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
    sortedCampos.forEach(([campoId, campo]) => {
      const campoKgProm = isActivo ? calcKgProm(campo.totals.cab, campo.totals.kg) : '-';
      html += `
        <tr class="hover:bg-[#1E1818] cursor-pointer balance-row child-of-${planIdx}" data-level="1" data-index="${rowIndex}" data-expanded="true" data-parent="${planIdx}">
          <td class="px-4 py-3 text-white">
            <span class="inline-flex items-center gap-2 pl-6">
              <span class="material-symbols-outlined text-lg toggle-icon">expand_more</span>
              <span>${escapeHtml(campo.nombre)}</span>
              <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-[#392828] text-text-secondary">Centro Costo</span>
            </span>
          </td>
          <td class="px-4 py-3 text-right text-white font-mono">${formatSaldo(campo.totals.cab)}</td>
          <td class="px-4 py-3 text-right text-white font-mono">${formatSaldoKg(campo.totals.kg)}</td>
          <td class="px-4 py-3 text-right text-white font-mono">${campoKgProm}</td>
        </tr>`;

      const campoIdx = rowIndex++;

      // Nivel de CUENTA CONTABLE (en lugar de actividad)
      const sortedCuentas = Object.entries(campo.cuentas).sort((a, b) => (a[1].codigo || '').localeCompare(b[1].codigo || ''));
      sortedCuentas.forEach(([cuentaKey, cuenta]) => {
        const cuentaKgProm = isActivo ? calcKgProm(cuenta.totals.cab, cuenta.totals.kg) : '-';
        const cuentaLabel = cuenta.codigo ? `${escapeHtml(cuenta.codigo)} - ${escapeHtml(cuenta.nombre)}` : escapeHtml(cuenta.nombre);
        html += `
          <tr class="hover:bg-[#1E1818] cursor-pointer balance-row child-of-${campoIdx}" data-level="2" data-index="${rowIndex}" data-expanded="true" data-parent="${campoIdx}">
            <td class="px-4 py-2.5 text-text-secondary">
              <span class="inline-flex items-center gap-2 pl-12">
                <span class="material-symbols-outlined text-lg toggle-icon">expand_more</span>
                <span class="material-symbols-outlined text-base text-primary">account_balance</span>
                <span>${cuentaLabel}</span>
              </span>
            </td>
            <td class="px-4 py-2.5 text-right text-text-secondary font-mono">${formatSaldo(cuenta.totals.cab)}</td>
            <td class="px-4 py-2.5 text-right text-text-secondary font-mono">${formatSaldoKg(cuenta.totals.kg)}</td>
            <td class="px-4 py-2.5 text-right text-text-secondary font-mono">${cuentaKgProm}</td>
          </tr>`;

        const cuentaIdx = rowIndex++;

        // Nivel de CATEGORÍA
        const sortedCats = Object.entries(cuenta.categorias).sort((a, b) => a[0].localeCompare(b[0]));
        sortedCats.forEach(([catNombre, cat]) => {
          const catKgProm = isActivo ? calcKgProm(cat.cab, cat.kg) : '-';
          html += `
            <tr class="hover:bg-[#1E1818] balance-row child-of-${cuentaIdx}" data-level="3" data-index="${rowIndex}" data-parent="${cuentaIdx}">
              <td class="px-4 py-2 text-text-secondary">
                <span class="inline-flex items-center gap-2 pl-[72px]">
                  <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  <span>${escapeHtml(catNombre)}</span>
                </span>
              </td>
              <td class="px-4 py-2 text-right text-text-secondary font-mono">${formatSaldo(cat.cab)}</td>
              <td class="px-4 py-2 text-right text-text-secondary font-mono">${formatSaldoKg(cat.kg)}</td>
              <td class="px-4 py-2 text-right text-text-secondary font-mono">${catKgProm}</td>
            </tr>`;
          rowIndex++;
        });
      });
    });
  });

  // Totales solo del ACTIVO (stock real)
  const stockKgProm = calcKgProm(stockTotal.cab, stockTotal.kg);
  let mesLabel = 'Acumulado Total';
  if (balanceMode === 'mes') {
    mesLabel = selectedMes ? formatMes(selectedMes) + ' - Movimientos' : 'Seleccione un mes';
  }

  const hasData = stockTotal.cab !== 0 || stockTotal.kg !== 0 || Object.keys(hierarchy).length > 0;
  if (!hasData && balanceMode === 'mes' && !selectedMes) {
    container.innerHTML = '<p class="p-8 text-center text-text-secondary">Seleccione un período para ver los movimientos del mes</p>';
    return;
  }

  html += `
    <tr class="bg-green-900/30 border-t-2 border-green-600">
      <td class="px-4 py-4">
        <span class="font-bold text-white">STOCK TOTAL (Activo)</span>
        <span class="text-text-secondary text-xs block">${mesLabel} - Solo existencias del plan Activo</span>
      </td>
      <td class="px-4 py-4 text-right font-bold text-green-400 font-mono text-lg">${formatSaldo(stockTotal.cab)}</td>
      <td class="px-4 py-4 text-right font-bold text-green-400 font-mono">${formatSaldoKg(stockTotal.kg)}</td>
      <td class="px-4 py-4 text-right font-bold text-green-400 font-mono">${stockKgProm}</td>
    </tr>`;

  html += '</tbody></table>';
  container.innerHTML = html;

  function collapseAllChildren(parentIdx) {
    const children = container.querySelectorAll('.child-of-' + parentIdx);
    children.forEach(child => {
      child.classList.add('hidden');
      child.dataset.expanded = 'false';
      const childIcon = child.querySelector('.toggle-icon');
      if (childIcon) childIcon.textContent = 'chevron_right';

      const childIdx = child.dataset.index;
      if (childIdx) collapseAllChildren(childIdx);
    });
  }

  container.onclick = function(e) {
    const row = e.target.closest('.balance-row[data-level="0"], .balance-row[data-level="1"], .balance-row[data-level="2"]');
    if (!row) return;
    e.stopPropagation();
    
    const idx = row.dataset.index;
    const isExpanded = row.dataset.expanded === 'true';
    row.dataset.expanded = !isExpanded;

    const icon = row.querySelector('.toggle-icon');
    if (icon) icon.textContent = isExpanded ? 'chevron_right' : 'expand_more';

    if (isExpanded) {
      collapseAllChildren(idx);
    } else {
      const children = container.querySelectorAll('.child-of-' + idx);
      children.forEach(child => {
        child.classList.remove('hidden');
      });
    }
  };
}

async function loadClientes() {
  try {
    const data = await api('/admin/clientes');

    const rows = (data.clientes || []).map(c => {
      const gestorDbText = c.gestor_database_id ? `<span class="font-mono text-xs">${c.gestor_database_id}</span>` : '<span class="text-text-secondary">-</span>';
      const gestorKeyText = c.gestor_api_key_last4 ? `<span class="font-mono text-xs">****${escapeHtml(c.gestor_api_key_last4)}</span>` : '<span class="text-text-secondary">No config</span>';
      const lastTestText = c.last_test_at ? `<span class="text-xs ${c.last_test_ok ? 'text-green-400' : 'text-red-400'}">${new Date(c.last_test_at).toLocaleDateString()}</span>` : '<span class="text-text-secondary">-</span>';
      
      const gestorButtons = `
        <div class="flex gap-1 mt-1">
          <button type="button" data-action="gestor-config" data-type="clientes" data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}" data-db-id="${c.gestor_database_id || 0}" data-base-url="${c.gestor_base_url || ''}" data-auth-scheme="${c.auth_scheme || 'bearer'}" class="px-2 py-1 text-xs bg-[#271c1c] border border-[#392828] rounded text-text-secondary hover:text-white hover:border-primary transition-colors cursor-pointer" title="Configurar Gestor">
            <span class="material-symbols-outlined text-sm">settings</span>
          </button>
          <button type="button" data-action="gestor-test" data-type="clientes" data-id="${c.id}" class="px-2 py-1 text-xs bg-[#271c1c] border border-[#392828] rounded text-text-secondary hover:text-white hover:border-primary transition-colors cursor-pointer ${!c.gestor_configured ? 'opacity-50 cursor-not-allowed' : ''}" ${!c.gestor_configured ? 'disabled' : ''} title="Probar conexión">
            <span class="material-symbols-outlined text-sm">network_check</span>
          </button>
          <button type="button" data-action="gestor-sync" data-type="clientes" data-id="${c.id}" class="px-2 py-1 text-xs bg-[#271c1c] border border-[#392828] rounded text-text-secondary hover:text-white hover:border-primary transition-colors cursor-pointer ${!c.gestor_configured ? 'opacity-50 cursor-not-allowed' : ''}" ${!c.gestor_configured ? 'disabled' : ''} title="Sincronizar">
            <span class="material-symbols-outlined text-sm">sync</span>
          </button>
        </div>
      `;
      
      return renderTableRow([
        `<span class="font-semibold">${escapeHtml(c.nombre)}</span>`,
        escapeHtml(c.descripcion || '-'),
        `<span class="font-mono text-text-secondary">${c.usuarios_count || 0}</span>`,
        `<span class="font-mono text-text-secondary">${c.campos_count || 0}</span>`,
        gestorDbText,
        gestorKeyText,
        lastTestText,
        renderActionButtons('clientes', c.id, false) + gestorButtons
      ]);
    });

    const listEl = document.getElementById('clientesList');
    if (listEl) {
      listEl.innerHTML = renderAdminTable(
        ['Nombre', 'Descripción', 'Usuarios', 'Campos', 'Gestor DB', 'Gestor Key', 'Último Test', 'Acciones'],
        rows, 'No hay empresas registradas'
      );
    }

    const campoClienteSelect = document.getElementById('nuevoCampoCliente');
    if (campoClienteSelect) {
      campoClienteSelect.innerHTML = '<option value="">Sin asignar</option>';
      (data.clientes || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        campoClienteSelect.appendChild(opt);
      });
    }

    return data.clientes || [];
  } catch (err) {
    console.error('Error loading clientes:', err);
    return [];
  }
}

window._editClienteImpl = async function(id) {
  try {
    const data = await api('/admin/clientes');
    const empresa = (data.clientes || []).find(c => c.id === id);
    if (!empresa) {
      showNotification('Empresa no encontrada', 'error');
      return;
    }
    
    document.getElementById('editarEmpresaId').value = id;
    document.getElementById('editarEmpresaNombre').value = empresa.nombre || '';
    document.getElementById('editarEmpresaDescripcion').value = empresa.descripcion || '';
    document.getElementById('editarEmpresaActivo').value = empresa.activo !== false ? 'true' : 'false';
    
    document.getElementById('editarEmpresaModal').classList.remove('hidden');
  } catch (err) {
    showNotification(err.message || 'Error al cargar empresa', 'error');
  }
};

window._deleteClienteImpl = async function(id) {
  if (!confirm('¿Está seguro que desea eliminar esta empresa? Los campos y usuarios asociados quedarán sin asignar.')) return;
  try {
    await api('/admin/clientes/' + id, { method: 'DELETE' });
    showNotification('Empresa eliminada');
    loadClientes();
    loadReplitUsers();
  } catch (err) {
    showNotification(err.message || 'Error al eliminar empresa', 'error');
  }
};

window._configGestorImpl = function(id, nombre, dbId, baseUrl, authScheme) {
  document.getElementById('gestorConfigClienteId').value = id;
  document.getElementById('gestorConfigEmpresaNombre').textContent = 'Empresa: ' + nombre;
  document.getElementById('gestorDatabaseId').value = dbId || '';
  document.getElementById('gestorApiKey').value = '';
  document.getElementById('gestorBaseUrl').value = baseUrl || 'https://api.gestormax.com';
  document.getElementById('gestorAuthScheme').value = authScheme || 'bearer';
  
  document.getElementById('gestorConfigModal').classList.remove('hidden');
};

window._testGestorImpl = async function(id) {
  try {
    showNotification('Probando conexión...', 'warning');
    const result = await api('/admin/clientes/' + id + '/gestor-test', { method: 'POST' });
    if (result.ok) {
      showNotification('Conexión OK - Total: ' + result.total + ', HACIENDA: ' + result.hacienda_total, 'success');
    } else {
      showNotification('Fallo: ' + (result.message || 'Error desconocido'), 'error');
      console.error('Test error:', result);
    }
    loadClientes();
  } catch (err) {
    showNotification(err.message || 'Error al probar conexión', 'error');
    console.error('Test exception:', err);
  }
};

window._syncGestorImpl = async function(id) {
  try {
    showNotification('Sincronizando conceptos HACIENDA...', 'warning');
    const result = await api('/admin/clientes/' + id + '/gestor/sync-conceptos', {
      method: 'POST'
    });
    if (result.ok) {
      showNotification('Sincronización exitosa: ' + result.synced + ' conceptos', 'success');
      loadClientes();
    } else {
      showNotification('Error: ' + (result.message || result.error || 'Error desconocido'), 'error');
      console.error('Sync error:', result);
    }
  } catch (err) {
    showNotification(err.message || 'Error al sincronizar', 'error');
    console.error('Sync exception:', err);
  }
};

async function loadAdminData() {
  try {
    const [campos, categorias, actividades, tiposEvento, cuentas, planesCuenta, clientesData] = await Promise.all([
      api('/admin/campos').catch(() => ({ campos: [] })),
      api('/admin/categorias').catch(() => ({ categorias: [] })),
      api('/admin/actividades').catch(() => ({ actividades: catalogs.actividades || [] })),
      api('/admin/tipos-evento').catch(() => ({ tipos_evento: [] })),
      api('/admin/cuentas').catch(() => ({ cuentas: [] })),
      api('/admin/planes-cuenta').catch(() => ({ planes_cuenta: [] })),
      api('/admin/clientes').catch(() => ({ clientes: [] }))
    ]);

    adminData = { campos: campos.campos, categorias: categorias.categorias, actividades: actividades.actividades || [], tiposEvento: tiposEvento.tipos_evento || [], cuentas: cuentas.cuentas || [], planesCuenta: planesCuenta.planes_cuenta || [], clientes: clientesData.clientes || [] };

    const camposRows = campos.campos.map(c => {
      return renderTableRow([
        `<span class="font-semibold">${escapeHtml(c.nombre)}</span>`,
        escapeHtml(c.descripcion || '-'),
        escapeHtml(c.tenant_nombre || '-'),
        renderBadge(c.activo),
        renderActionButtons('campos', c.id)
      ]);
    });
    document.getElementById('camposList').innerHTML = renderAdminTable(
      ['Nombre', 'Descripción', 'Cliente', 'Estado', 'Acciones'],
      camposRows, 'No hay campos registrados'
    );

    const actividadesContainer = document.getElementById('nuevoCampoActividades');
    if (actividadesContainer) {
      actividadesContainer.style.display = 'none';
    }

    const campoClienteSelect = document.getElementById('nuevoCampoCliente');
    if (campoClienteSelect) {
      campoClienteSelect.innerHTML = '<option value="">Sin asignar</option>';
      (clientesData.clientes || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        campoClienteSelect.appendChild(opt);
      });
    }

    // Empresas: NO renderizar aquí, usar loadClientes() como único renderer
    // para evitar doble render y mantener botones de Gestor Max

    const actividadesRows = (actividades.actividades || []).map(a => renderTableRow([
      `<span class="font-semibold">${escapeHtml(a.nombre)}</span>`,
      escapeHtml(a.descripcion || '-'),
      renderActionButtons('actividades', a.id)
    ]));
    const actividadesListEl = document.getElementById('actividadesList');
    if (actividadesListEl) {
      actividadesListEl.innerHTML = renderAdminTable(
        ['Nombre', 'Descripción', 'Acciones'],
        actividadesRows, 'No hay actividades registradas'
      );
    }

    const isAdmin = currentUser && currentUser.rol === 'administrador';
    const isAuditor = currentUser && currentUser.rol === 'auditor';
    
    const categoriasRows = categorias.categorias.map(c => {
      const esEstandar = c.es_estandar;
      const estaActivo = c.activo !== false;
      
      const nombreCell = `
        <span class="font-semibold ${!estaActivo ? 'text-text-secondary line-through' : ''}">${escapeHtml(c.nombre)}</span>
        ${esEstandar ? '<span class="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-amber-600 text-white">ESTANDAR</span>' : ''}
        ${!estaActivo ? '<span class="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-gray-600 text-white">INACTIVA</span>' : ''}
      `;
      
      let accionesCell = '';
      if (esEstandar) {
        // Categorías estándar: solo Admin puede editar
        if (isAdmin) {
          accionesCell = renderActionButtons('categorias', c.id, true);
        } else {
          accionesCell = '<span class="text-text-secondary text-sm italic">Solo lectura</span>';
        }
      } else {
        // Categorías personalizadas: solo Auditor puede gestionar
        if (isAuditor) {
          const toggleBtn = estaActivo 
            ? `<button data-action="toggle-activo" data-type="categorias" data-id="${c.id}" data-activo="false" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-500 rounded transition-colors cursor-pointer" title="Desactivar"><span class="material-symbols-outlined text-sm">visibility_off</span></button>`
            : `<button data-action="toggle-activo" data-type="categorias" data-id="${c.id}" data-activo="true" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded transition-colors cursor-pointer" title="Activar"><span class="material-symbols-outlined text-sm">visibility</span></button>`;
          accionesCell = renderActionButtons('categorias', c.id, true) + toggleBtn;
        } else if (isAdmin) {
          // Admin ve categorías personalizadas pero sin acciones (no debería verlas en el filtro)
          accionesCell = '<span class="text-text-secondary text-sm italic">Gestiona auditor</span>';
        }
      }
      
      return renderTableRow([
        nombreCell,
        escapeHtml(c.actividad_nombre),
        `<span class="font-mono">${c.peso_estandar ? parseFloat(c.peso_estandar).toLocaleString('es-AR') : '-'}</span>`,
        accionesCell
      ]);
    });
    document.getElementById('categoriasList').innerHTML = renderAdminTable(
      ['Nombre', 'Actividad', 'Peso Std', 'Acciones'],
      categoriasRows, 'No hay categorías registradas'
    );

    const catActSelect = document.getElementById('nuevaCategoriaActividad');
    if (catActSelect) {
      catActSelect.innerHTML = '<option value="">Seleccionar actividad...</option>';
      (actividades.actividades || catalogs.actividades || []).forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.nombre;
        catActSelect.appendChild(opt);
      });
    }

    const tiposEventoRows = (tiposEvento.tipos_evento || []).map(te => renderTableRow([
      `<span class="font-mono font-bold text-primary">${escapeHtml(te.codigo)}</span>`,
      escapeHtml(te.nombre),
      te.requiere_origen_destino ? '<span class="text-green-400">Sí</span>' : '<span class="text-text-secondary">No</span>',
      te.requiere_campo_destino ? '<span class="text-green-400">Sí</span>' : '<span class="text-text-secondary">No</span>',
      renderActionButtons('tipos-evento', te.id)
    ]));
    const tiposEventoListEl = document.getElementById('tiposEventoList');
    if (tiposEventoListEl) {
      tiposEventoListEl.innerHTML = renderAdminTable(
        ['Código', 'Nombre', 'Origen/Destino', 'Campo Destino', 'Acciones'],
        tiposEventoRows, 'No hay tipos de evento registrados'
      );
    }

    const cuentaDebeSelect = document.getElementById('nuevoTipoEventoCuentaDebe');
    const cuentaHaberSelect = document.getElementById('nuevoTipoEventoCuentaHaber');
    if (cuentaDebeSelect && cuentaHaberSelect) {
      cuentaDebeSelect.innerHTML = '<option value="">Cuenta DEBE...</option>';
      cuentaHaberSelect.innerHTML = '<option value="">Cuenta HABER...</option>';
      (cuentas.cuentas || []).forEach(c => {
        const optText = c.codigo + ' - ' + c.nombre + ' (' + c.plan_codigo + ')';
        const optDebe = document.createElement('option');
        optDebe.value = c.id;
        optDebe.textContent = optText;
        cuentaDebeSelect.appendChild(optDebe);
        const optHaber = document.createElement('option');
        optHaber.value = c.id;
        optHaber.textContent = optText;
        cuentaHaberSelect.appendChild(optHaber);
      });
    }

    const cuentasRows = (cuentas.cuentas || []).map(c => renderTableRow([
      `<span class="font-mono font-bold text-primary">${escapeHtml(c.codigo)}</span>`,
      escapeHtml(c.nombre),
      `<span class="px-2 py-0.5 text-xs font-bold rounded bg-[#392828] text-white">${escapeHtml(c.plan_nombre)}</span>`,
      `<span class="text-text-secondary">${escapeHtml(c.tipo_normal)}</span>`,
      renderActionButtons('cuentas', c.id)
    ]));
    const cuentasListEl = document.getElementById('cuentasList');
    if (cuentasListEl) {
      cuentasListEl.innerHTML = renderAdminTable(
        ['Código', 'Nombre', 'Plan', 'Tipo Normal', 'Acciones'],
        cuentasRows, 'No hay cuentas registradas'
      );
    }

    const cuentaPlanSelect = document.getElementById('nuevaCuentaPlan');
    if (cuentaPlanSelect) {
      cuentaPlanSelect.innerHTML = '<option value="">Seleccionar plan...</option>';
      (planesCuenta.planes_cuenta || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.codigo + ' - ' + p.nombre;
        cuentaPlanSelect.appendChild(opt);
      });
    }

    const planesRows = (planesCuenta.planes_cuenta || []).map(p => renderTableRow([
      `<span class="font-mono font-bold text-primary">${escapeHtml(p.codigo)}</span>`,
      escapeHtml(p.nombre),
      renderActionButtons('planes-cuenta', p.id)
    ]));
    const planesCuentaListEl = document.getElementById('planesCuentaList');
    if (planesCuentaListEl) {
      planesCuentaListEl.innerHTML = renderAdminTable(
        ['Código', 'Nombre', 'Acciones'],
        planesRows, 'No hay planes de cuenta registrados'
      );
    }

    if (currentUser && currentUser.rol === 'administrador') {
      await loadAuditorClientes();
      await loadReplitUsers();
    }

    // Cargar datos de mapeo de categorías (solo para admin/auditor con tenant activo)
    await loadCategoriasMapeo();

  } catch (err) {
    console.error('Error loading admin data:', err);
  }
}

// ============================================================
// CATEGORIAS MAPEO (Fase 3)
// ============================================================

async function loadCategoriasMapeo() {
  try {
    const [mapeos, status, listas] = await Promise.all([
      api('/admin/categorias-mapeo').catch(() => []),
      api('/admin/categorias-mapeo/status').catch(() => ({ total_cliente: 0, mapeadas: 0, sin_mapear: 0 })),
      api('/admin/categorias-mapeo/listas').catch(() => ({ categoriasCliente: [], categoriasGestor: [], mapeos: [] }))
    ]);
    
    const totalEl = document.getElementById('mapTotalCliente');
    const mapeadasEl = document.getElementById('mapMapeadas');
    const sinMapearEl = document.getElementById('mapSinMapear');
    
    if (totalEl) totalEl.textContent = status.total_cliente || 0;
    if (mapeadasEl) mapeadasEl.textContent = status.mapeadas || 0;
    if (sinMapearEl) sinMapearEl.textContent = status.sin_mapear || 0;
    
    const mapeoRows = (mapeos || []).map(m => renderTableRow([
      `<span class="font-semibold">${escapeHtml(m.categoria_cliente_nombre)}</span>`,
      `<span class="text-primary font-semibold">${escapeHtml(m.categoria_gestor_nombre)}</span>`,
      m.activo ? '<span class="text-green-400">Activo</span>' : '<span class="text-text-secondary">Inactivo</span>',
      `<button data-action="quitar-mapeo" data-categoria-cliente-id="${m.categoria_cliente_id}" class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-600 rounded transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-sm">link_off</span>
        Quitar
      </button>`
    ]));
    
    const mapeoListEl = document.getElementById('categoriasMapeoList');
    if (mapeoListEl) {
      mapeoListEl.innerHTML = renderAdminTable(
        ['Categoría Cliente', 'Categoría Gestor', 'Estado', 'Acción'],
        mapeoRows, 'No hay mapeos configurados. Asigne categorías cliente a categorías gestor.'
      );
    }
    
    const clienteSelect = document.getElementById('mapClienteCategoria');
    const gestorSelect = document.getElementById('mapGestorCategoria');
    
    if (clienteSelect) {
      clienteSelect.innerHTML = '<option value="">-- Categoría Cliente --</option>';
      (listas.categoriasCliente || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        clienteSelect.appendChild(opt);
      });
    }
    
    if (gestorSelect) {
      gestorSelect.innerHTML = '<option value="">-- Categoría Gestor --</option>';
      (listas.categoriasGestor || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre + (c.external_id ? ` [${c.external_id}]` : '');
        gestorSelect.appendChild(opt);
      });
    }
    
  } catch (err) {
    console.error('Error loading categorias mapeo:', err);
  }
}

async function quitarMapeoAction(categoriaClienteId) {
  if (!confirm('¿Está seguro que desea quitar este mapeo?')) return;
  try {
    await api('/admin/categorias-mapeo/' + categoriaClienteId, { method: 'DELETE' });
    showNotification('Mapeo eliminado');
    await loadCategoriasMapeo();
  } catch (err) {
    showNotification(err.message || 'Error al eliminar mapeo', 'error');
  }
}

window.asignarMapeo = async function() {
  const clienteId = document.getElementById('mapClienteCategoria')?.value;
  const gestorId = document.getElementById('mapGestorCategoria')?.value;
  
  if (!clienteId || !gestorId) {
    showNotification('Seleccione ambas categorías', 'warning');
    return;
  }
  
  try {
    await api('/admin/categorias-mapeo', {
      method: 'POST',
      body: JSON.stringify({
        categoria_cliente_id: parseInt(clienteId),
        categoria_gestor_id: parseInt(gestorId)
      })
    });
    showNotification('Mapeo asignado correctamente');
    await loadCategoriasMapeo();
    document.getElementById('mapClienteCategoria').value = '';
    document.getElementById('mapGestorCategoria').value = '';
  } catch (err) {
    showNotification(err.message || 'Error al asignar mapeo', 'error');
  }
};

async function previewCategoriasClienteImport() {
  const fileInput = document.getElementById('fileCategoriasCliente');
  const summaryContainer = document.getElementById('importCategoriasClienteSummary');
  const errorsContainer = document.getElementById('importCategoriasClienteErrors');
  
  if (!fileInput?.files?.length) {
    showNotification('Seleccione un archivo CSV o Excel', 'warning');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  summaryContainer.classList.remove('hidden');
  summaryContainer.innerHTML = '<p class="text-text-secondary p-4"><span class="material-symbols-outlined animate-spin mr-2">sync</span>Analizando archivo...</p>';
  errorsContainer.classList.add('hidden');
  
  try {
    const response = await fetch('/api/admin/categorias-cliente/import?dryRun=true', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.status === 'error') {
      summaryContainer.innerHTML = `<div class="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">${escapeHtml(data.error)}</div>`;
      return;
    }
    
    const s = data.summary;
    summaryContainer.innerHTML = `
      <div class="bg-[#271c1c] rounded-xl p-4 border border-[#392828]">
        <h4 class="text-white font-bold mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">preview</span>
          Vista Previa (sin cambios)
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Total Filas</div>
            <div class="text-white text-lg font-bold">${s.total_rows}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">A Insertar</div>
            <div class="text-green-400 text-lg font-bold">${s.inserted}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">A Actualizar</div>
            <div class="text-amber-400 text-lg font-bold">${s.updated}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Omitidas/Errores</div>
            <div class="text-red-400 text-lg font-bold">${s.skipped + s.errors}</div>
          </div>
        </div>
        ${data.preview && data.preview.length > 0 ? `
          <div class="max-h-48 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="text-text-secondary">
                <tr><th class="text-left px-2 py-1">Fila</th><th class="text-left px-2 py-1">Nombre</th><th class="text-left px-2 py-1">Actividad</th><th class="text-right px-2 py-1">Peso Est.</th><th class="text-left px-2 py-1">Acción</th></tr>
              </thead>
              <tbody class="text-white">
                ${data.preview.map(p => `
                  <tr class="border-t border-[#392828]">
                    <td class="px-2 py-1">${p.row}</td>
                    <td class="px-2 py-1">${escapeHtml(p.nombre)}</td>
                    <td class="px-2 py-1">${escapeHtml(p.actividad || '')}</td>
                    <td class="px-2 py-1 text-right">${p.peso_estandar != null ? p.peso_estandar : '-'}</td>
                    <td class="px-2 py-1"><span class="${p.action === 'inserted' ? 'text-green-400' : 'text-amber-400'}">${p.action === 'inserted' ? 'Nuevo' : 'Actualizar'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
    
    if (data.errors_detail && data.errors_detail.length > 0) {
      errorsContainer.classList.remove('hidden');
      errorsContainer.innerHTML = `
        <div class="bg-red-900/20 border border-red-500 rounded-xl p-4 mt-4">
          <h4 class="text-red-400 font-bold mb-2">Errores encontrados (${data.errors_detail.length})</h4>
          <ul class="text-red-300 text-sm max-h-32 overflow-y-auto">
            ${data.errors_detail.map(e => `<li>Fila ${e.row}: ${escapeHtml(e.message)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
  } catch (err) {
    summaryContainer.innerHTML = `<div class="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function runCategoriasClienteImport() {
  const fileInput = document.getElementById('fileCategoriasCliente');
  const summaryContainer = document.getElementById('importCategoriasClienteSummary');
  const errorsContainer = document.getElementById('importCategoriasClienteErrors');
  
  if (!fileInput?.files?.length) {
    showNotification('Seleccione un archivo CSV o Excel', 'warning');
    return;
  }
  
  if (!confirm('¿Está seguro de importar las categorías? Esta acción insertará o actualizará registros.')) {
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  summaryContainer.classList.remove('hidden');
  summaryContainer.innerHTML = '<p class="text-text-secondary p-4"><span class="material-symbols-outlined animate-spin mr-2">sync</span>Importando categorías...</p>';
  errorsContainer.classList.add('hidden');
  
  try {
    const response = await fetch('/api/admin/categorias-cliente/import?dryRun=false', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.status === 'error') {
      summaryContainer.innerHTML = `<div class="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">${escapeHtml(data.error)}</div>`;
      return;
    }
    
    const s = data.summary;
    summaryContainer.innerHTML = `
      <div class="bg-green-900/20 border border-green-500 rounded-xl p-4">
        <h4 class="text-green-400 font-bold mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined">check_circle</span>
          Importación Completada
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Total Filas</div>
            <div class="text-white text-lg font-bold">${s.total_rows}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Insertadas</div>
            <div class="text-green-400 text-lg font-bold">${s.inserted}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Actualizadas</div>
            <div class="text-amber-400 text-lg font-bold">${s.updated}</div>
          </div>
          <div class="text-center p-2 bg-[#1a1313] rounded-lg">
            <div class="text-text-secondary text-xs">Omitidas</div>
            <div class="text-red-400 text-lg font-bold">${s.skipped + s.errors}</div>
          </div>
        </div>
      </div>
    `;
    
    showNotification(`Importación completada: ${s.inserted} nuevas, ${s.updated} actualizadas`, 'success');
    fileInput.value = '';
    
    loadCatalogs();
    loadAdminData();
    
  } catch (err) {
    summaryContainer.innerHTML = `<div class="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadAuditorClientes() {
  try {
    auditorClientesData = await api('/admin/auditor-clientes');
    const { auditores, clientes, asignaciones } = auditorClientesData;

    const auditorSelect = document.getElementById('auditorSelector');
    if (auditorSelect) {
      auditorSelect.innerHTML = '<option value="">Buscar auditor...</option>';
      (auditores || []).forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = `${a.nombre} (${a.email})`;
        auditorSelect.appendChild(option);
      });
    }

    if (selectedAuditorId) {
      renderAuditorDetails(selectedAuditorId);
      renderClientesAsignacion();
    }
  } catch (err) {
    console.error('Error loading auditor-clientes:', err);
  }
}

function renderAuditorDetails(auditorId) {
  const aId = parseInt(auditorId);
  const auditor = auditorClientesData.auditores.find(a => parseInt(a.id) === aId);
  if (!auditor) return;

  const initials = (auditor.nombre || 'AU').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('auditorInitials').textContent = initials;
  document.getElementById('auditorNombre').textContent = auditor.nombre || 'Auditor';
  document.getElementById('auditorRol').textContent = 'Auditor';
  document.getElementById('auditorEmail').textContent = auditor.email || '-';
  document.getElementById('auditorNombreFooter').textContent = auditor.nombre || 'Auditor';

  const assignedCount = auditorClientesData.asignaciones.filter(a => parseInt(a.auditor_id) === aId).length;
  document.getElementById('clientesAsignadosCount').textContent = assignedCount;

  document.getElementById('auditorDetails').classList.remove('hidden');
  document.getElementById('auditorStats').classList.remove('hidden');
}

function renderClientesAsignacion() {
  const container = document.getElementById('clientesAsignacionList');
  if (!container || !selectedAuditorId) return;

  const searchTerm = (document.getElementById('buscarClienteAuditor')?.value || '').toLowerCase();
  const clientes = auditorClientesData.clientes || [];
  const asignaciones = auditorClientesData.asignaciones || [];

  const auditorId = parseInt(selectedAuditorId);
  const asignados = new Set(asignaciones.filter(a => parseInt(a.auditor_id) === auditorId).map(a => parseInt(a.cliente_id)));

  const filtered = clientes.filter(c => {
    if (!searchTerm) return true;
    return (c.nombre || '').toLowerCase().includes(searchTerm) || 
           (c.descripcion || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="p-8 text-center text-text-secondary">No se encontraron clientes</p>';
    return;
  }

  let html = '';
  filtered.forEach(cliente => {
    const cId = parseInt(cliente.id);
    const isAssigned = asignados.has(cId);
    const isSelected = clienteSelections[cId] !== undefined ? clienteSelections[cId] : isAssigned;
    const camposCount = cliente.campos_count || 0;
    const statusBadge = cliente.activo !== false 
      ? '<span class="px-2 py-0.5 text-xs rounded-full bg-green-900/50 text-green-400 border border-green-800">Activo</span>'
      : '<span class="px-2 py-0.5 text-xs rounded-full bg-red-900/50 text-red-400 border border-red-800">Inactivo</span>';

    html += `
      <div class="flex items-center gap-4 px-5 py-4 hover:bg-[#271c1c] transition-colors cursor-pointer cliente-asignacion-row" data-cliente-id="${cId}">
        <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-5 h-5 rounded bg-[#271c1c] border-[#543b3b] text-primary focus:ring-primary focus:ring-offset-0 pointer-events-none" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-1">
            <span class="text-white font-semibold">${escapeHtml(cliente.nombre)}</span>
            <span class="text-text-secondary text-xs">#TEN-${String(cliente.id).padStart(4, '0')}</span>
          </div>
          <div class="flex items-center gap-4 text-text-secondary text-sm">
            ${cliente.descripcion ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">info</span>${escapeHtml(cliente.descripcion)}</span>` : ''}
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">pets</span>${camposCount} Campos</span>
          </div>
        </div>
        ${statusBadge}
      </div>`;
  });

  container.innerHTML = html;
  updateClientesPaginationInfo(filtered.length, clientes.length);
  updateAsignacionFooter();
  
  // Adjuntar event listeners a las filas de clientes
  container.querySelectorAll('.cliente-asignacion-row').forEach(row => {
    row.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const clienteId = parseInt(this.dataset.clienteId);
      if (clienteId) toggleClienteSelection(clienteId);
    });
  });
}

function updateClientesPaginationInfo(showing, total) {
  const info = document.getElementById('clientesPaginationInfo');
  if (info) info.textContent = `Mostrando ${showing} de ${total} clientes`;
}

function updateAsignacionFooter() {
  const asignaciones = auditorClientesData.asignaciones || [];
  const auditorId = parseInt(selectedAuditorId);
  const asignados = new Set(asignaciones.filter(a => parseInt(a.auditor_id) === auditorId).map(a => parseInt(a.cliente_id)));

  let pendingChanges = 0;
  Object.keys(clienteSelections).forEach(clienteId => {
    const wasAssigned = asignados.has(parseInt(clienteId));
    const isNowSelected = clienteSelections[clienteId];
    if (wasAssigned !== isNowSelected) pendingChanges++;
  });

  const footer = document.getElementById('asignacionFooter');
  const pendingEl = document.getElementById('clientesPendientes');

  if (pendingChanges > 0) {
    footer?.classList.remove('hidden');
    if (pendingEl) pendingEl.textContent = `${pendingChanges} cambios`;
  } else {
    footer?.classList.add('hidden');
  }
}

window.toggleClienteSelection = function(clienteId) {
  const cId = parseInt(clienteId);
  const asignaciones = auditorClientesData.asignaciones || [];
  const wasAssigned = asignaciones.some(a => parseInt(a.auditor_id) === parseInt(selectedAuditorId) && parseInt(a.cliente_id) === cId);

  if (clienteSelections[cId] === undefined) {
    clienteSelections[cId] = !wasAssigned;
  } else {
    clienteSelections[cId] = !clienteSelections[cId];
  }

  renderClientesAsignacion();
};

window.guardarAsignacionesAuditor = async function() {
  if (!selectedAuditorId) return;

  const asignaciones = auditorClientesData.asignaciones || [];
  const auditorId = parseInt(selectedAuditorId);
  const asignados = new Set(asignaciones.filter(a => parseInt(a.auditor_id) === auditorId).map(a => parseInt(a.cliente_id)));

  const toAdd = [];
  const toRemove = [];

  Object.keys(clienteSelections).forEach(clienteId => {
    const cId = parseInt(clienteId);
    const wasAssigned = asignados.has(cId);
    const isNowSelected = clienteSelections[clienteId];

    if (!wasAssigned && isNowSelected) {
      toAdd.push(cId);
    } else if (wasAssigned && !isNowSelected) {
      const asignacion = asignaciones.find(a => parseInt(a.auditor_id) === auditorId && parseInt(a.cliente_id) === cId);
      if (asignacion) toRemove.push(asignacion.id);
    }
  });

  try {
    for (const tenantId of toAdd) {
      await api('/admin/auditor-clientes', {
        method: 'POST',
        body: JSON.stringify({ auditor_id: parseInt(selectedAuditorId), tenant_id: tenantId })
      });
    }

    for (const asignacionId of toRemove) {
      await api('/admin/auditor-clientes/' + asignacionId, { method: 'DELETE' });
    }

    showNotification(`Asignaciones actualizadas: ${toAdd.length} agregadas, ${toRemove.length} eliminadas`);
    clienteSelections = {};
    await loadAuditorClientes();
  } catch (err) {
    showNotification(err.message || 'Error al guardar asignaciones', 'error');
  }
};

window._deleteAuditorClienteImpl = async function(id) {
  if (!confirm('Esta seguro que desea eliminar esta asignacion?')) return;
  try {
    await api('/admin/auditor-clientes/' + id, { method: 'DELETE' });
    showNotification('Asignacion eliminada');
    loadAuditorClientes();
  } catch (err) {
    showNotification(err.message || 'Error al eliminar asignacion', 'error');
  }
};

let replitUsersData = { usuarios: [], roles: [], clientes: [] };

async function loadReplitUsers() {
  try {
    replitUsersData = await api('/admin/replit-users');
    renderUsuariosTable();
    populateVincularSelects();
  } catch (err) {
    console.error('Error loading replit-users:', err);
    const tbody = document.getElementById('usuariosTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-red-400">Error al cargar usuarios: ' + escapeHtml(err.message || 'Sin acceso') + '</td></tr>';
    }
  }
}

function renderUsuariosTable() {
  const { usuarios, roles, clientes } = replitUsersData;
  const tbody = document.getElementById('usuariosTableBody');
  if (!tbody) return;

  const searchLower = usuariosSearch.toLowerCase();
  const filtered = (usuarios || []).filter(u => {
    const nombre = [u.first_name, u.last_name].filter(Boolean).join(' ') || '';
    const matchSearch = !searchLower || 
      (u.email || '').toLowerCase().includes(searchLower) ||
      nombre.toLowerCase().includes(searchLower) ||
      (u.tenant_nombre || '').toLowerCase().includes(searchLower);

    const matchFilter = usuariosFilter === 'todos' || 
      (u.rol || '').toLowerCase() === usuariosFilter.toLowerCase();

    return matchSearch && matchFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-text-secondary">No se encontraron usuarios</td></tr>';
    updateUsuariosPagination(0, usuarios?.length || 0);
    return;
  }

  let html = '';
  filtered.forEach(u => {
    const nombreRaw = [u.first_name, u.last_name].filter(Boolean).join(' ') || '-';
    const nombre = escapeHtml(nombreRaw);
    const initials = nombreRaw !== '-' ? nombreRaw.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    const initialsEscaped = escapeHtml(initials);
    const vinculado = u.usuario_id ? true : false;
    const emailEscaped = escapeHtml(u.email || '-');
    const replitIdEscaped = escapeHtml(u.replit_id);

    const rolBadge = getRolBadge(u.rol);
    const tenantBadge = u.tenant_nombre 
      ? `<span class="text-text-secondary text-xs">#TEN-${escapeHtml(String(u.tenant_id).padStart(4, '0'))}</span>`
      : '<span class="text-text-secondary italic">- Global -</span>';

    let estadoBadge;
    if (u.origen === 'invitado') {
      estadoBadge = '<span class="px-2 py-1 text-xs rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-800">Invitado</span>';
    } else if (vinculado) {
      estadoBadge = '<span class="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-400 border border-green-800">Activo</span>';
    } else {
      estadoBadge = '<span class="px-2 py-1 text-xs rounded-full bg-gray-800 text-gray-400 border border-gray-700">Sin vincular</span>';
    }

    const ultimoAcceso = u.ultimo_acceso 
      ? formatTimeAgo(u.ultimo_acceso)
      : '<span class="text-text-secondary">-</span>';

    let acciones = '';
    const usuarioIdNum = parseInt(u.usuario_id, 10) || 0;
    const esInvitado = u.origen === 'invitado';
    
    if (usuarioIdNum > 0) {
      acciones = `
        <button data-action="editar-usuario" data-id="${usuarioIdNum}" class="p-2 hover:bg-[#271c1c] rounded-lg transition-colors text-text-secondary hover:text-white" title="Editar">
          <span class="material-symbols-outlined text-base">edit</span>
        </button>
        <button data-action="eliminar-usuario" data-id="${usuarioIdNum}" class="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-text-secondary hover:text-red-400" title="Eliminar usuario">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>`;
    } else if (u.replit_id) {
      acciones = `
        <button data-action="vincular-usuario" data-replit-id="${escapeHtml(u.replit_id)}" data-email="${emailEscaped}" data-nombre="${nombre}" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-red-700 rounded-lg transition-colors">
          <span class="material-symbols-outlined text-base">link</span>Vincular
        </button>
        <button data-action="eliminar-replit-user" data-replit-id="${escapeHtml(u.replit_id)}" class="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-text-secondary hover:text-red-400" title="Eliminar usuario no vinculado">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>`;
    }

    html += `
      <tr class="hover:bg-[#271c1c]/50 transition-colors">
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-[#271c1c] flex items-center justify-center text-white font-semibold text-sm border border-[#392828]">${initialsEscaped}</div>
            <div>
              <div class="text-white font-medium">${nombre}</div>
              <div class="text-text-secondary text-sm">${emailEscaped}</div>
            </div>
          </div>
        </td>
        <td class="px-5 py-4">${rolBadge}</td>
        <td class="px-5 py-4">${tenantBadge}</td>
        <td class="px-5 py-4">${estadoBadge}</td>
        <td class="px-5 py-4 text-text-secondary text-sm">${ultimoAcceso}</td>
        <td class="px-5 py-4 text-right">
          <div class="flex items-center justify-end gap-1">${acciones}</div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
  updateUsuariosPagination(filtered.length, usuarios?.length || 0);
}

function getRolBadge(rol) {
  const badges = {
    'administrador': '<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-400 border border-blue-800"><span class="w-2 h-2 rounded-full bg-blue-400"></span>Administrador</span>',
    'auditor': '<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-purple-900/50 text-purple-400 border border-purple-800"><span class="w-2 h-2 rounded-full bg-purple-400"></span>Auditor</span>',
    'cliente': '<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-green-900/50 text-green-400 border border-green-800"><span class="w-2 h-2 rounded-full bg-green-400"></span>Cliente</span>'
  };
  return badges[rol?.toLowerCase()] || '<span class="text-text-secondary">-</span>';
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `Hace ${diffMins} mins`;
  if (diffHours < 24) return `Hace ${diffHours} horas`;
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function updateUsuariosPagination(showing, total) {
  const info = document.getElementById('usuariosPaginationInfo');
  if (info) info.textContent = `Mostrando ${showing} de ${total} usuarios`;
}

function populateVincularSelects() {
  const { roles, clientes } = replitUsersData;

  const vincularRolSelect = document.getElementById('vincularRol');
  if (vincularRolSelect) {
    vincularRolSelect.innerHTML = '<option value="">Seleccionar rol...</option>';
    roles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.nombre;
      vincularRolSelect.appendChild(opt);
    });
  }

  const vincularTenantSelect = document.getElementById('vincularTenant');
  if (vincularTenantSelect) {
    vincularTenantSelect.innerHTML = '<option value="">Sin tenant (para admin/auditor)</option>';
    clientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      vincularTenantSelect.appendChild(opt);
    });
  }
}

window.mostrarFormVincular = function(replitId, email, nombre) {
  document.getElementById('vincularReplitId').value = replitId;
  document.getElementById('vincularEmail').value = email;
  document.getElementById('vincularNombre').value = nombre === '-' ? '' : nombre;
  document.getElementById('vincularUsuarioModal').classList.remove('hidden');
};

window.abrirEditarUsuario = function(usuarioId) {
  const uId = parseInt(usuarioId);
  const usuario = replitUsersData.usuarios.find(u => parseInt(u.usuario_id) === uId);
  if (!usuario) return;
  
  const { roles, clientes } = replitUsersData;
  
  document.getElementById('editarUsuarioId').value = usuarioId;
  document.getElementById('editarEmail').value = usuario.email || '';
  document.getElementById('editarNombre').value = [usuario.first_name, usuario.last_name].filter(Boolean).join(' ') || '';
  
  const rolSelect = document.getElementById('editarRol');
  rolSelect.innerHTML = '<option value="">Seleccionar rol...</option>';
  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nombre;
    if (usuario.rol_id === r.id) opt.selected = true;
    rolSelect.appendChild(opt);
  });
  
  const tenantSelect = document.getElementById('editarTenant');
  tenantSelect.innerHTML = '<option value="">Sin tenant (para admin/auditor)</option>';
  clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    if (usuario.tenant_id === c.id) opt.selected = true;
    tenantSelect.appendChild(opt);
  });
  
  document.getElementById('editarActivo').value = usuario.activo !== false ? 'true' : 'false';
  
  document.getElementById('editarUsuarioModal').classList.remove('hidden');
};

window.cambiarRol = async function(usuarioId, rolId, tenantId) {
  try {
    await api('/admin/usuarios/' + usuarioId + '/rol', {
      method: 'PUT',
      body: JSON.stringify({ rol_id: parseInt(rolId), tenant_id: tenantId ? parseInt(tenantId) : null })
    });
    showNotification('Rol actualizado');
    loadReplitUsers();
    loadAuditorClientes();
  } catch (err) {
    showNotification(err.message || 'Error al cambiar rol', 'error');
  }
};

window.cambiarTenant = async function(usuarioId, tenantId) {
  try {
    await api('/admin/usuarios/' + usuarioId + '/tenant', {
      method: 'PUT',
      body: JSON.stringify({ tenant_id: tenantId ? parseInt(tenantId) : null })
    });
    showNotification('Tenant actualizado');
    loadReplitUsers();
  } catch (err) {
    showNotification(err.message || 'Error al cambiar tenant', 'error');
  }
};

window.eliminarUsuario = async function(usuarioId) {
  if (!confirm('¿Está seguro que desea eliminar este usuario? Esta acción no se puede deshacer y se eliminarán sus asignaciones.')) return;
  try {
    await api('/admin/usuarios/' + usuarioId, { method: 'DELETE' });
    showNotification('Usuario eliminado correctamente');
    loadReplitUsers();
    loadAuditorClientes();
  } catch (err) {
    showNotification(err.message || 'Error al eliminar usuario', 'error');
  }
};

window.toggleUserActive = async function(userId, active) {
  try {
    await api('/admin/usuarios/' + userId, {
      method: 'PUT',
      body: JSON.stringify({ activo: active })
    });
    showNotification('Usuario actualizado');
    loadAdminData();
  } catch (err) {
    showNotification(err.message, 'error');
  }
};

window._deleteItemImpl = async function(type, id) {
  if (!confirm('Esta seguro que desea eliminar este registro?')) return;
  try {
    await api('/admin/' + type + '/' + id, { method: 'DELETE' });
    showNotification('Registro eliminado');
    loadAdminData();
    loadCatalogs();
  } catch (err) {
    showNotification(err.message || 'Error al eliminar. Verifique que no tenga registros asociados.', 'error');
  }
};

window._editItemImpl = function(type, id) {
  editingItem = { type, id };
  let item;

  const sectionMap = {
    'campos': 'adminCampos',
    'categorias': 'adminCategorias',
    'actividades': 'adminActividades',
    'tipos-evento': 'adminTiposEvento',
    'cuentas': 'adminCuentas',
    'planes-cuenta': 'adminPlanescuenta'
  };

  switch(type) {
    case 'campos':
      item = adminData.campos.find(c => c.id === id);
      if (item) {
        document.getElementById('nuevoCampoNombre').value = item.nombre;
        const descEl = document.getElementById('nuevoCampoDescripcion') || document.getElementById('nuevoCampoDesc');
        if (descEl) descEl.value = item.descripcion || '';
        const clienteEl = document.getElementById('nuevoCampoCliente');
        if (clienteEl) clienteEl.value = item.tenant_id || '';
      }
      break;
    case 'actividades':
      item = adminData.actividades.find(a => a.id === id);
      if (item) {
        document.getElementById('nuevaActividadNombre').value = item.nombre;
        const descEl = document.getElementById('nuevaActividadDescripcion') || document.getElementById('nuevaActividadDesc');
        if (descEl) descEl.value = item.descripcion || '';
      }
      break;
    case 'categorias':
      item = adminData.categorias.find(c => c.id === id);
      if (item) {
        document.getElementById('nuevaCategoriaNombre').value = item.nombre;
        document.getElementById('nuevaCategoriaActividad').value = item.actividad_id;
        const pesoEl = document.getElementById('nuevaCategoriaPesoEstandar') || document.getElementById('nuevaCategoriaPeso');
        if (pesoEl) pesoEl.value = item.peso_estandar || '';
      }
      break;
    case 'tipos-evento':
      item = adminData.tiposEvento.find(t => t.id === id);
      if (item) {
        document.getElementById('nuevoTipoEventoCodigo').value = item.codigo;
        document.getElementById('nuevoTipoEventoNombre').value = item.nombre;
        const origenDestinoEl = document.getElementById('nuevoTipoEventoOrigenDestino');
        const campoDestinoEl = document.getElementById('nuevoTipoEventoCampoDestino');
        const cuentaDebeEl = document.getElementById('nuevoTipoEventoCuentaDebe');
        const cuentaHaberEl = document.getElementById('nuevoTipoEventoCuentaHaber');
        if (origenDestinoEl) origenDestinoEl.checked = item.requiere_origen_destino;
        if (campoDestinoEl) campoDestinoEl.checked = item.requiere_campo_destino;
        if (cuentaDebeEl) cuentaDebeEl.value = item.cuenta_debe_id || '';
        if (cuentaHaberEl) cuentaHaberEl.value = item.cuenta_haber_id || '';
      }
      break;
    case 'cuentas':
      item = adminData.cuentas.find(c => c.id === id);
      if (item) {
        document.getElementById('nuevaCuentaCodigo').value = item.codigo;
        document.getElementById('nuevaCuentaNombre').value = item.nombre;
        document.getElementById('nuevaCuentaPlan').value = item.plan_cuenta_id;
        const tipoNormalEl = document.getElementById('nuevaCuentaTipoNormal');
        if (tipoNormalEl) tipoNormalEl.value = item.tipo_normal || '';
      }
      break;
    case 'planes-cuenta':
      item = adminData.planesCuenta.find(p => p.id === id);
      if (item) {
        const codigoEl = document.getElementById('nuevoPlanCuentaCodigo') || document.getElementById('nuevoPlanCodigo');
        const nombreEl = document.getElementById('nuevoPlanCuentaNombre') || document.getElementById('nuevoPlanNombre');
        if (codigoEl) codigoEl.value = item.codigo;
        if (nombreEl) nombreEl.value = item.nombre;
      }
      break;
  }

  if (item) {
    const sectionId = sectionMap[type];
    const btn = document.querySelector('#' + sectionId + ' .admin-form button[type="submit"]');
    if (btn) btn.textContent = 'Guardar Cambios';
  }
};

window.cancelEdit = function(type) {
  const typeToReset = type || editingItem.type;
  editingItem = { type: null, id: null };

  const sectionMap = {
    'campos': 'adminCampos',
    'categorias': 'adminCategorias',
    'actividades': 'adminActividades',
    'tipos-evento': 'adminTiposEvento',
    'cuentas': 'adminCuentas',
    'planes-cuenta': 'adminPlanescuenta'
  };

  const buttonTextMap = {
    'campos': 'Crear Campo',
    'categorias': 'Crear Categoria',
    'actividades': 'Crear Actividad',
    'tipos-evento': 'Crear Tipo de Evento',
    'cuentas': 'Crear Cuenta',
    'planes-cuenta': 'Crear Plan de Cuenta'
  };

  function resetForm(t) {
    const form = document.querySelector('#' + sectionMap[t] + ' .admin-form');
    if (form) {
      form.reset();
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.textContent = buttonTextMap[t] || 'Agregar';
      form.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      form.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
    }
  }

  if (typeToReset && sectionMap[typeToReset]) {
    resetForm(typeToReset);
  } else {
    Object.keys(sectionMap).forEach(resetForm);
  }
};

async function checkSession() {
  // Helper con retry y backoff exponencial para evitar race de sesión post-login
  async function fetchMeWithRetry(maxRetries, initialDelayMs) {
    let delay = initialDelayMs;
    let lastData = { user: null };
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const data = await api('/me');
        if (data.user && data.user.rol) {
          return data;
        }
        lastData = data;
      } catch (e) {
        console.warn(`[checkSession] Retry ${i + 1}/${maxRetries} failed:`, e.message);
      }
      
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    return lastData;
  }

  try {
    const data = await fetchMeWithRetry(4, 200);
    
    // Acceso libre - siempre mostrar main
    if (!data.user || !data.user.rol) {
        showSection('main');
        return;
    }
    
    currentUser = data.user;

    // LÓGICA CLIENTE (Simplificada y robusta)
    if (currentUser.rol === 'cliente') {
        if (currentUser.active_tenant_id) {
            // Actualizar UI de header
            const userDisplayName = document.getElementById('userDisplayName');
            const userDisplayRole = document.getElementById('userDisplayRole');
            if (userDisplayName) userDisplayName.textContent = currentUser.nombre;
            if (userDisplayRole) userDisplayRole.textContent = currentUser.rol;
            
            updateActiveTenantDisplay();
            
            showSection('main');
            try { 
                await loadCatalogs(); 
                loadEventos();
            } catch(e) {
                console.error("Error no fatal cargando datos:", e);
            }
        } else {
            // Mostrar error estático, NO redirigir
            document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#181111;color:white;flex-direction:column;gap:20px;text-align:center;padding:20px;"><h1>Cuenta sin Asignar</h1><p>Tu usuario no tiene una empresa asignada.<br>Contacte al administrador.</p><a href="/api/logout" style="padding:12px 24px;background:#ec1313;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Cerrar Sesión</a></div>';
        }
        return;
    }

    // --- LÓGICA DE AUDITOR / ADMIN ---
    if (currentUser.rol === 'auditor' && currentUser.tenants_disponibles?.length === 1 && !currentUser.active_tenant_id) {
        await selectTenant(currentUser.tenants_disponibles[0].id);
    }

    // Solo mostrar selector si es auditor/admin sin tenant activo y con tenants disponibles
    const isAuditorOrAdmin = (currentUser.rol === 'auditor' || currentUser.rol === 'administrador');
    const hasNoActiveTenant = !currentUser.active_tenant_id;
    const hasTenants = Array.isArray(currentUser.tenants_disponibles) && currentUser.tenants_disponibles.length > 0;

    if (isAuditorOrAdmin && hasNoActiveTenant && hasTenants) {
        showClientSelector(currentUser.tenants_disponibles);
        updateActiveTenantDisplay();
        return;
    }

    // UI Updates
    const userDisplayName = document.getElementById('userDisplayName');
    const userDisplayRole = document.getElementById('userDisplayRole');
    if (userDisplayName) userDisplayName.textContent = currentUser.nombre;
    if (userDisplayRole) userDisplayRole.textContent = currentUser.rol;
    
    updateActiveTenantDisplay();

    // Tabs Admin
    if (currentUser.rol === 'administrador' || currentUser.rol === 'auditor') {
        document.getElementById('adminTabBtn')?.classList.remove('hidden');
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    if (currentUser.rol === 'administrador') {
        document.querySelectorAll('.superadmin-only').forEach(el => el.classList.remove('hidden'));
    }

    showSection('main');
    
    try {
        await loadCatalogs();
        loadEventos();
    } catch(e) {}

  } catch (err) {
    console.error("Error fatal auth:", err);
    
    // Usuario inactivo o pendiente - mostrar pantalla estática
    if (err.message && err.message.includes('Usuario inactivo o pendiente')) {
        document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#181111;color:white;flex-direction:column;gap:20px;text-align:center;padding:20px;"><h1>Acceso Pendiente</h1><p>Tu usuario está pendiente de activación o no fue invitado.<br>Contacte al administrador para obtener acceso.</p><a href="/api/logout" style="padding:12px 24px;background:#ec1313;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Cerrar Sesión</a></div>';
        return;
    }
    
    // Acceso libre - siempre mostrar main
    if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
        showSection('main');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded - script.js iniciado');
  
  // Verificar si el usuario NO fue invitado (redirigido desde /api/callback)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error') === 'not_invited') {
    document.body.innerHTML = `
      <div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#181111;color:white;flex-direction:column;gap:20px;text-align:center;padding:20px;">
        <div style="font-size:48px;">🚫</div>
        <h1 style="margin:0;font-size:24px;">Acceso No Autorizado</h1>
        <p style="margin:0;color:#999;max-width:400px;">Tu usuario no fue invitado al sistema.<br>Contacte al administrador para obtener acceso.</p>
        <a href="/api/logout" style="padding:12px 24px;background:#ec1313;color:white;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:10px;">Cerrar Sesión</a>
      </div>`;
    // Limpiar la URL para evitar loops
    window.history.replaceState({}, document.title, '/');
    return;
  }
  
  // Event delegation global para botones de editar/eliminar en administracion
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const type = btn.dataset.type;
    const id = parseInt(btn.dataset.id);
    
    if (!type || !id) return;
    
    console.log('[DEBUG] Action button clicked:', action, type, id);
    
    // Validar permisos por acción
    if (action === 'edit') {
      // Solo auditor y admin pueden editar
      if (!currentUser || (currentUser.rol !== 'auditor' && currentUser.rol !== 'administrador')) {
        showNotification('Acceso Denegado: No tiene permisos para editar', 'error');
        return;
      }
      if (type === 'clientes') {
        if (typeof window._editClienteImpl === 'function') {
          window._editClienteImpl(id);
        }
      } else {
        if (typeof window._editItemImpl === 'function') {
          window._editItemImpl(type, id);
        }
      }
    } else if (action === 'delete') {
      // Solo admin puede eliminar
      if (!currentUser || currentUser.rol !== 'administrador') {
        showNotification('Acceso Denegado: Solo el Administrador puede eliminar registros', 'error');
        return;
      }
      if (type === 'clientes') {
        if (typeof window._deleteClienteImpl === 'function') {
          await window._deleteClienteImpl(id);
        }
      } else if (type === 'auditor-clientes') {
        if (typeof window.deleteAuditorCliente === 'function') {
          await window.deleteAuditorCliente(id);
        }
      } else {
        if (typeof window._deleteItemImpl === 'function') {
          await window._deleteItemImpl(type, id);
        }
      }
    } else if (action === 'toggle-activo') {
      // Auditor puede activar/desactivar categorías personalizadas
      if (!currentUser || (currentUser.rol !== 'auditor' && currentUser.rol !== 'administrador')) {
        showNotification('Acceso Denegado: No tiene permisos', 'error');
        return;
      }
      if (type === 'categorias') {
        const nuevoEstado = btn.dataset.activo === 'true';
        try {
          const categoria = adminData.categorias.find(c => c.id === id);
          if (!categoria) {
            showNotification('Categoria no encontrada', 'error');
            return;
          }
          await api('/admin/categorias/' + id, {
            method: 'PUT',
            body: JSON.stringify({
              nombre: categoria.nombre,
              actividad_id: categoria.actividad_id,
              peso_estandar: categoria.peso_estandar,
              activo: nuevoEstado
            })
          });
          showNotification(nuevoEstado ? 'Categoria activada' : 'Categoria desactivada', 'success');
          await loadAdminData();
        } catch (err) {
          showNotification('Error: ' + err.message, 'error');
        }
      }
    }
  });
  
  checkSession();

  // Selector de cliente (para auditor/admin)
  const clienteSelector = document.getElementById('clienteSelector');
  const selectClientBtn = document.getElementById('selectClientBtn');

  clienteSelector?.addEventListener('change', () => {
    if (selectClientBtn) selectClientBtn.disabled = !clienteSelector.value;
  });

  selectClientBtn?.addEventListener('click', async () => {
    const tenantId = parseInt(clienteSelector.value);
    if (!tenantId || tenantId === 0) {
      showNotification('Por favor seleccione un cliente', 'warning');
      return;
    }
    
    selectClientBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Seleccionando...';
    selectClientBtn.disabled = true;
    
    const success = await selectTenant(tenantId);
    if (success) {
      await checkSession(); // Recargar sesion con el tenant activo
    } else {
      selectClientBtn.innerHTML = '<span>Entrar</span><span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>';
      selectClientBtn.disabled = false;
    }
  });

  document.getElementById('logoutFromSelectBtn')?.addEventListener('click', () => {
    window.location.href = '/api/logout';
  });

  document.getElementById('refreshClientList')?.addEventListener('click', async () => {
    if (currentUser && currentUser.tenants_disponibles) {
      showClientSelector(currentUser.tenants_disponibles);
      showNotification('Lista de clientes actualizada');
    }
  });

  // Selector de cliente para Administrador
  document.getElementById('adminClienteSelector')?.addEventListener('change', handleAdminClienteChange);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    window.location.href = '/api/logout';
  });

  // Event form toggle
  document.getElementById('showEventFormBtn')?.addEventListener('click', () => {
    document.getElementById('eventFormContainer')?.classList.remove('hidden');
    document.getElementById('showEventFormBtn')?.classList.add('hidden');
  });

  document.getElementById('closeEventFormBtn')?.addEventListener('click', () => {
    document.getElementById('eventFormContainer')?.classList.add('hidden');
    document.getElementById('showEventFormBtn')?.classList.remove('hidden');
  });

  document.getElementById('cancelEventBtn')?.addEventListener('click', () => {
    document.getElementById('eventFormContainer')?.classList.add('hidden');
    document.getElementById('showEventFormBtn')?.classList.remove('hidden');
    document.getElementById('eventForm')?.reset();
  });

  document.querySelectorAll('#navTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Validar acceso a pestaña Administración - solo auditor y admin
      if (tab.dataset.tab === 'admin') {
        if (!currentUser || (currentUser.rol !== 'auditor' && currentUser.rol !== 'administrador')) {
          showNotification('Acceso Denegado: No tiene permisos para acceder a Administracion', 'error');
          return;
        }
      }
      
      document.querySelectorAll('#navTabs .tab').forEach(t => {
        t.classList.remove('border-b-primary', 'text-white');
        t.classList.add('border-b-transparent', 'text-text-secondary');
      });
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
      });

      tab.classList.remove('border-b-transparent', 'text-text-secondary');
      tab.classList.add('border-b-primary', 'text-white');
      const tabId = tab.dataset.tab + 'Tab';
      const tabContent = document.getElementById(tabId);
      tabContent.classList.remove('hidden');

      if (tab.dataset.tab === 'mayor') {
        loadLedger();
      } else if (tab.dataset.tab === 'balance') {
        loadBalance();
      } else if (tab.dataset.tab === 'admin') {
        loadAdminData();
      }
    });
  });

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Validar acceso a secciones restringidas - Usuarios y Auditores solo para admin
      const restrictedSections = ['usuarios', 'auditores'];
      if (restrictedSections.includes(tab.dataset.admin)) {
        if (!currentUser || currentUser.rol !== 'administrador') {
          showNotification('Acceso Denegado: Solo el Administrador puede gestionar usuarios y auditores', 'error');
          return;
        }
      }
      
      document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.remove('bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
        t.classList.add('bg-[#271c1c]', 'border', 'border-[#392828]', 'text-text-secondary');
      });
      document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));

      tab.classList.remove('bg-[#271c1c]', 'border', 'border-[#392828]', 'text-text-secondary');
      tab.classList.add('bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
      const sectionId = 'admin' + tab.dataset.admin.charAt(0).toUpperCase() + tab.dataset.admin.slice(1);
      document.getElementById(sectionId)?.classList.remove('hidden');

      if (tab.dataset.admin === 'usuarios') {
        loadReplitUsers();
      }
      if (tab.dataset.admin === 'auditores') {
        loadAuditorClientes();
      }
      if (tab.dataset.admin === 'clientes') {
        loadClientes();
      }
    });
  });

  document.getElementById('mayorMes').addEventListener('change', loadLedger);
  document.getElementById('mayorCampo').addEventListener('change', loadLedger);
  document.getElementById('mayorCategoria').addEventListener('change', loadLedger);
  document.getElementById('balanceCampo').addEventListener('change', loadBalance);
  document.getElementById('balanceMes').addEventListener('change', function() {
    const selectedValue = this.value;
    console.log('[Balance] Periodo seleccionado:', selectedValue);
    if (selectedValue) {
      if (balanceMode !== 'mes') {
        setBalanceMode('mes', true);
      } else {
        // Disparar nueva petición al servidor con el nuevo periodo
        loadBalance();
      }
    } else {
      setBalanceMode('acumulado');
    }
  });
  document.getElementById('balanceSearch').addEventListener('input', debounce(function() {
    renderBalanceTree(balanceData.balance || [], balanceData.meses || []);
  }, 300));

  document.getElementById('tipoEvento').addEventListener('change', updateDynamicFields);
  document.getElementById('tipoEvento').addEventListener('change', updateCabezasValidation);

  document.getElementById('cabezas').addEventListener('input', calculateKgTotales);
  document.getElementById('kgCabeza').addEventListener('input', calculateKgTotales);

  document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitEventBtn');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
    btn.disabled = true;

    try {
      const tipoSelect = document.getElementById('tipoEvento');
      const requiereOrigenDestino = tipoSelect.options[tipoSelect.selectedIndex]?.dataset.requiereOrigenDestino === 'true';

      const formData = {
        fecha: document.getElementById('fecha').value,
        tipo_evento_id: parseInt(document.getElementById('tipoEvento').value),
        campo_id: parseInt(document.getElementById('campo').value),
        cabezas: parseInt(document.getElementById('cabezas').value),
        kg_cabeza: document.getElementById('kgCabeza').value ? parseFloat(document.getElementById('kgCabeza').value) : null,
        kg_totales: document.getElementById('kgTotales').value ? parseFloat(document.getElementById('kgTotales').value) : null,
        observaciones: document.getElementById('observaciones').value || null
      };

      if (requiereOrigenDestino) {
        formData.actividad_origen_id = document.getElementById('actividadOrigen').value ? parseInt(document.getElementById('actividadOrigen').value) : null;
        formData.actividad_destino_id = document.getElementById('actividadDestino').value ? parseInt(document.getElementById('actividadDestino').value) : null;
        formData.categoria_origen_id = parseInt(document.getElementById('categoriaOrigen').value);
        formData.categoria_destino_id = parseInt(document.getElementById('categoriaDestino').value);
      } else {
        formData.categoria_id = parseInt(document.getElementById('categoria').value);
      }

      const requiereCampoDestino = tipoSelect.options[tipoSelect.selectedIndex]?.dataset.requiereCampoDestino === 'true';
      if (requiereCampoDestino) {
        formData.campo_destino_id = parseInt(document.getElementById('campoDestino').value);
      }

      console.log('[EVENT FETCH]', { action: 'create', url: '/api/eventos', method: 'POST', body: formData });
      
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      console.log('[EVENT FETCH RESULT]', { status: res.status, ok: res.ok });
      
      if (!res.ok) {
        const txt = await res.text();
        console.log('[EVENT FETCH ERROR]', txt);
        alert('Error al crear evento: ' + txt);
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Guardar Evento';
        btn.disabled = false;
        return;
      }

      showNotification('Evento registrado correctamente');
      e.target.reset();
      document.getElementById('fecha').valueAsDate = new Date();
      updateDynamicFields();
      document.getElementById('eventFormContainer')?.classList.add('hidden');
      document.getElementById('showEventFormBtn')?.classList.remove('hidden');
      loadEventos();
    } catch (err) {
      alert('Error al crear evento: ' + (err.message || err));
    } finally {
      btn.innerHTML = '<span class="material-symbols-outlined">save</span> Guardar Evento';
      btn.disabled = false;
    }
  });

  document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('nuevoNombre').value,
          email: document.getElementById('nuevoEmail').value,
          password: document.getElementById('nuevoPassword').value,
          rol: document.getElementById('nuevoRol').value
        })
      });
      showNotification('Usuario creado');
      e.target.reset();
      loadAdminData();
    } catch (err) {
      showNotification(err.message || 'Error al crear usuario', 'error');
    }
  });

  document.getElementById('createClienteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/admin/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('nuevoClienteNombre').value,
          descripcion: document.getElementById('nuevoClienteDescripcion')?.value || ''
        })
      });
      showNotification('Cliente creado');
      e.target.reset();
      loadClientes();
      loadAdminData();
      loadReplitUsers();
    } catch (err) {
      showNotification(err.message || 'Error al crear cliente', 'error');
    }
  });

  document.getElementById('createCampoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingItem.type === 'campos' && editingItem.id;

      await api('/admin/campos' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('nuevoCampoNombre').value,
          descripcion: document.getElementById('nuevoCampoDescripcion')?.value || document.getElementById('nuevoCampoDesc')?.value || ''
        })
      });
      showNotification(isEditing ? 'Campo actualizado' : 'Campo creado');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Campo';
      loadAdminData();
      loadCatalogs();
    } catch (err) {
      showNotification(err.message || 'Error al guardar campo', 'error');
    }
  });

  document.getElementById('createCategoriaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const pesoVal = document.getElementById('nuevaCategoriaPesoEstandar')?.value || document.getElementById('nuevaCategoriaPeso')?.value;
      const isEditing = editingItem.type === 'categorias' && editingItem.id;

      await api('/admin/categorias' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('nuevaCategoriaNombre').value,
          actividad_id: parseInt(document.getElementById('nuevaCategoriaActividad').value),
          peso_estandar: pesoVal ? parseFloat(pesoVal) : null
        })
      });
      showNotification(isEditing ? 'Categoria actualizada' : 'Categoria creada');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Categoria';
      loadAdminData();
      loadCatalogs();
    } catch (err) {
      showNotification(err.message || 'Error al guardar categoria', 'error');
    }
  });

  // Botón Asignar Mapeo de Categorías
  document.getElementById('btnAsignarMapeo')?.addEventListener('click', () => {
    asignarMapeo();
  });

  // Importación de Categorías Cliente
  document.getElementById('btnPreviewCategoriasCliente')?.addEventListener('click', () => {
    previewCategoriasClienteImport();
  });
  document.getElementById('btnImportCategoriasCliente')?.addEventListener('click', () => {
    runCategoriasClienteImport();
  });

  document.getElementById('createActividadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingItem.type === 'actividades' && editingItem.id;

      await api('/admin/actividades' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          nombre: document.getElementById('nuevaActividadNombre').value,
          descripcion: document.getElementById('nuevaActividadDescripcion')?.value || document.getElementById('nuevaActividadDesc')?.value || null
        })
      });
      showNotification(isEditing ? 'Actividad actualizada' : 'Actividad creada');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Actividad';
      loadAdminData();
      loadCatalogs();
    } catch (err) {
      showNotification(err.message || 'Error al guardar actividad', 'error');
    }
  });

  document.getElementById('createTipoEventoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const cuentaDebeVal = document.getElementById('nuevoTipoEventoCuentaDebe')?.value;
      const cuentaHaberVal = document.getElementById('nuevoTipoEventoCuentaHaber')?.value;
      const isEditing = editingItem.type === 'tipos-evento' && editingItem.id;

      await api('/admin/tipos-evento' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          codigo: document.getElementById('nuevoTipoEventoCodigo').value,
          nombre: document.getElementById('nuevoTipoEventoNombre').value,
          cuenta_debe_id: cuentaDebeVal ? parseInt(cuentaDebeVal) : null,
          cuenta_haber_id: cuentaHaberVal ? parseInt(cuentaHaberVal) : null,
          requiere_origen_destino: document.getElementById('nuevoTipoEventoOrigenDestino')?.checked || false,
          requiere_campo_destino: document.getElementById('nuevoTipoEventoCampoDestino')?.checked || false
        })
      });
      showNotification(isEditing ? 'Tipo de evento actualizado' : 'Tipo de evento creado');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Tipo de Evento';
      loadAdminData();
      loadCatalogs();
    } catch (err) {
      showNotification(err.message || 'Error al guardar tipo de evento', 'error');
    }
  });

  document.getElementById('createCuentaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingItem.type === 'cuentas' && editingItem.id;

      await api('/admin/cuentas' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          codigo: document.getElementById('nuevaCuentaCodigo').value,
          nombre: document.getElementById('nuevaCuentaNombre').value,
          plan_cuenta_id: parseInt(document.getElementById('nuevaCuentaPlan').value),
          tipo_normal: document.getElementById('nuevaCuentaTipoNormal').value
        })
      });
      showNotification(isEditing ? 'Cuenta actualizada' : 'Cuenta creada');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Cuenta';
      loadAdminData();
    } catch (err) {
      showNotification(err.message || 'Error al guardar cuenta', 'error');
    }
  });

  document.getElementById('createPlanCuentaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingItem.type === 'planes-cuenta' && editingItem.id;

      await api('/admin/planes-cuenta' + (isEditing ? '/' + editingItem.id : ''), {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          codigo: document.getElementById('nuevoPlanCuentaCodigo')?.value || document.getElementById('nuevoPlanCodigo')?.value,
          nombre: document.getElementById('nuevoPlanCuentaNombre')?.value || document.getElementById('nuevoPlanNombre')?.value
        })
      });
      showNotification(isEditing ? 'Plan de cuenta actualizado' : 'Plan de cuenta creado');
      e.target.reset();
      editingItem = { type: null, id: null };
      e.target.querySelector('button[type="submit"]').textContent = 'Crear Plan de Cuenta';
      loadAdminData();
    } catch (err) {
      showNotification(err.message || 'Error al guardar plan de cuenta', 'error');
    }
  });

  document.getElementById('createAuditorClienteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/admin/auditor-clientes', {
        method: 'POST',
        body: JSON.stringify({
          auditor_id: parseInt(document.getElementById('nuevoAuditorId').value),
          tenant_id: parseInt(document.getElementById('nuevoClienteId').value)
        })
      });
      showNotification('Auditor asignado correctamente');
      e.target.reset();
      loadAuditorClientes();
    } catch (err) {
      showNotification(err.message || 'Error al asignar auditor', 'error');
    }
  });

  document.getElementById('vincularUsuarioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const tenantValue = document.getElementById('vincularTenant')?.value;
      await api('/admin/vincular-usuario', {
        method: 'POST',
        body: JSON.stringify({
          replit_user_id: document.getElementById('vincularReplitId').value,
          nombre: document.getElementById('vincularNombre').value,
          rol_id: parseInt(document.getElementById('vincularRol').value),
          tenant_id: tenantValue ? parseInt(tenantValue) : null
        })
      });
      showNotification('Usuario vinculado correctamente');
      e.target.reset();
      document.getElementById('vincularUsuarioModal')?.classList.add('hidden');
      loadReplitUsers();
    } catch (err) {
      showNotification(err.message || 'Error al vincular usuario', 'error');
    }
  });

  document.getElementById('cancelarVincular')?.addEventListener('click', () => {
    document.getElementById('vincularUsuarioModal')?.classList.add('hidden');
    document.getElementById('vincularUsuarioForm')?.reset();
  });

  document.getElementById('cerrarVincularModal')?.addEventListener('click', () => {
    document.getElementById('vincularUsuarioModal')?.classList.add('hidden');
    document.getElementById('vincularUsuarioForm')?.reset();
  });

  document.getElementById('editarUsuarioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const usuarioId = document.getElementById('editarUsuarioId').value;
      const tenantValue = document.getElementById('editarTenant')?.value;
      await api('/admin/usuarios/' + usuarioId, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: document.getElementById('editarNombre').value,
          rol_id: parseInt(document.getElementById('editarRol').value),
          tenant_id: tenantValue ? parseInt(tenantValue) : null,
          activo: document.getElementById('editarActivo').value === 'true'
        })
      });
      showNotification('Usuario actualizado correctamente');
      e.target.reset();
      document.getElementById('editarUsuarioModal')?.classList.add('hidden');
      loadReplitUsers();
      loadAuditorClientes();
    } catch (err) {
      showNotification(err.message || 'Error al actualizar usuario', 'error');
    }
  });

  document.getElementById('cancelarEditar')?.addEventListener('click', () => {
    document.getElementById('editarUsuarioModal')?.classList.add('hidden');
    document.getElementById('editarUsuarioForm')?.reset();
  });

  document.getElementById('cerrarEditarModal')?.addEventListener('click', () => {
    document.getElementById('editarUsuarioModal')?.classList.add('hidden');
    document.getElementById('editarUsuarioForm')?.reset();
  });

  // Auditor selector
  document.getElementById('auditorSelector')?.addEventListener('change', function() {
    selectedAuditorId = this.value;
    clienteSelections = {};
    if (selectedAuditorId) {
      renderAuditorDetails(selectedAuditorId);
      renderClientesAsignacion();
    } else {
      document.getElementById('auditorDetails')?.classList.add('hidden');
      document.getElementById('auditorStats')?.classList.add('hidden');
      document.getElementById('asignacionFooter')?.classList.add('hidden');
      document.getElementById('clientesAsignacionList').innerHTML = '<p class="p-8 text-center text-text-secondary">Seleccione un auditor para ver los clientes disponibles</p>';
    }
  });

  document.getElementById('buscarClienteAuditor')?.addEventListener('input', debounce(function() {
    if (selectedAuditorId) renderClientesAsignacion();
  }, 300));

  document.getElementById('selectAllClientes')?.addEventListener('change', function() {
    const checked = this.checked;
    const clientes = auditorClientesData.clientes || [];
    clientes.forEach(c => {
      clienteSelections[c.id] = checked;
    });
    renderClientesAsignacion();
  });

  document.getElementById('guardarAsignaciones')?.addEventListener('click', guardarAsignacionesAuditor);

  document.getElementById('cancelarAsignacion')?.addEventListener('click', () => {
    clienteSelections = {};
    renderClientesAsignacion();
    document.getElementById('asignacionFooter')?.classList.add('hidden');
  });

  // Usuarios filters
  document.getElementById('buscarUsuario')?.addEventListener('input', debounce(function() {
    usuariosSearch = this.value;
    renderUsuariosTable();
  }, 300));

  document.querySelectorAll('.usuario-filter').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.usuario-filter').forEach(b => {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('bg-[#271c1c]', 'border', 'border-[#392828]', 'text-text-secondary');
      });
      this.classList.remove('bg-[#271c1c]', 'border', 'border-[#392828]', 'text-text-secondary');
      this.classList.add('bg-primary', 'text-white');
      usuariosFilter = this.dataset.filter;
      renderUsuariosTable();
    });
  });

  document.getElementById('nuevoUsuarioBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('invitarUsuarioModal');
    const tenantSelect = document.getElementById('invitarTenant');
    
    if (tenantSelect && adminData.clientes) {
      tenantSelect.innerHTML = '<option value="">Sin asignar</option>';
      adminData.clientes.forEach(c => {
        tenantSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`;
      });
    }
    
    modal?.classList.remove('hidden');
  });
  
  document.getElementById('cerrarInvitarModal')?.addEventListener('click', () => {
    document.getElementById('invitarUsuarioModal')?.classList.add('hidden');
    document.getElementById('invitarUsuarioForm')?.reset();
  });
  
  document.getElementById('cancelarInvitar')?.addEventListener('click', () => {
    document.getElementById('invitarUsuarioModal')?.classList.add('hidden');
    document.getElementById('invitarUsuarioForm')?.reset();
  });
  
  document.getElementById('invitarUsuarioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('invitarEmail').value;
      const nombre = document.getElementById('invitarNombre').value;
      const rol_id = parseInt(document.getElementById('invitarRol').value);
      const tenant_id = document.getElementById('invitarTenant').value;
      
      await api('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          email,
          nombre,
          rol_id,
          tenant_id: tenant_id ? parseInt(tenant_id) : null
        })
      });
      
      showNotification('Usuario invitado correctamente. Se vinculará cuando inicie sesión.');
      document.getElementById('invitarUsuarioModal')?.classList.add('hidden');
      document.getElementById('invitarUsuarioForm')?.reset();
      loadReplitUsers();
    } catch (err) {
      showNotification(err.message || 'Error al invitar usuario', 'error');
    }
  });

  document.getElementById('asignarCampoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const campoId = document.getElementById('asignarCampoId').value;
      const clienteId = document.getElementById('asignarClienteId').value;
      await api('/admin/campos/' + campoId + '/cliente', {
        method: 'PUT',
        body: JSON.stringify({ cliente_id: clienteId ? parseInt(clienteId) : null })
      });
      showNotification('Campo asignado correctamente');
      e.target.reset();
      loadReplitUsers();
    } catch (err) {
      showNotification(err.message || 'Error al asignar campo', 'error');
    }
  });

  // User dropdown menu
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  
  userMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!userDropdown?.contains(e.target) && !userMenuBtn?.contains(e.target)) {
      userDropdown?.classList.add('hidden');
    }
    
    // Event delegation para botones de usuario
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      console.log('[DEBUG] Action clicked:', action, actionBtn.dataset);
      if (action === 'editar-usuario') {
        const id = parseInt(actionBtn.dataset.id);
        console.log('[DEBUG] Editar usuario ID:', id);
        if (id) abrirEditarUsuario(id);
      } else if (action === 'eliminar-usuario') {
        const id = parseInt(actionBtn.dataset.id);
        console.log('[DEBUG] Eliminar usuario ID:', id);
        if (id) eliminarUsuario(id);
      } else if (action === 'vincular-usuario') {
        const replitId = actionBtn.dataset.replitId;
        const email = actionBtn.dataset.email;
        const nombre = actionBtn.dataset.nombre;
        console.log('[DEBUG] Vincular usuario:', replitId, email, nombre);
        mostrarFormVincular(replitId, email, nombre);
      } else if (action === 'gestor-config') {
        const id = parseInt(actionBtn.dataset.id);
        const nombre = actionBtn.dataset.nombre || '';
        const dbId = parseInt(actionBtn.dataset.dbId) || 0;
        const baseUrl = actionBtn.dataset.baseUrl || '';
        const authScheme = actionBtn.dataset.authScheme || 'bearer';
        console.log('[DEBUG] Gestor config:', id, nombre);
        window._configGestorImpl(id, nombre, dbId, baseUrl, authScheme);
      } else if (action === 'gestor-test') {
        const id = parseInt(actionBtn.dataset.id);
        console.log('[DEBUG] Gestor test:', id);
        window._testGestorImpl(id);
      } else if (action === 'gestor-sync') {
        const id = parseInt(actionBtn.dataset.id);
        console.log('[DEBUG] Gestor sync:', id);
        window._syncGestorImpl(id);
      } else if (action === 'delete-evento') {
        const id = actionBtn.dataset.id;
        console.log('[DEBUG] Delete evento ID:', id);
        if (id) deleteEvento(id);
      } else if (action === 'edit-evento') {
        const id = actionBtn.dataset.id;
        console.log('[DEBUG] Edit evento ID:', id);
        if (id) editEvento(id);
      } else if (action === 'quitar-mapeo') {
        const categoriaClienteId = actionBtn.dataset.categoriaClienteId;
        console.log('[DEBUG] Quitar mapeo categoria_cliente_id:', categoriaClienteId);
        if (categoriaClienteId) quitarMapeoAction(categoriaClienteId);
      }
      return;
    }
    
    // Event delegation para asignación de clientes a auditor
    const clienteRow = e.target.closest('.cliente-asignacion-row');
    if (clienteRow) {
      e.preventDefault();
      e.stopPropagation();
      const clienteId = parseInt(clienteRow.dataset.clienteId);
      console.log('[DEBUG] Cliente row clicked, ID:', clienteId);
      if (clienteId) toggleClienteSelection(clienteId);
      return;
    }
  });

  // Profile modal
  document.getElementById('openProfileBtn')?.addEventListener('click', async () => {
    userDropdown?.classList.add('hidden');
    await openProfileModal();
  });

  document.getElementById('cerrarProfileModal')?.addEventListener('click', () => {
    document.getElementById('profileModal')?.classList.add('hidden');
  });

  document.getElementById('cancelarProfile')?.addEventListener('click', () => {
    document.getElementById('profileModal')?.classList.add('hidden');
  });

  document.getElementById('profilePhotoInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = document.getElementById('profileAvatarImgPreview');
        const icon = document.getElementById('profileAvatarIcon');
        img.src = e.target.result;
        img.classList.remove('hidden');
        icon.classList.add('hidden');
        document.getElementById('removePhotoBtn')?.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('removePhotoBtn')?.addEventListener('click', () => {
    const img = document.getElementById('profileAvatarImgPreview');
    const icon = document.getElementById('profileAvatarIcon');
    img.src = '';
    img.classList.add('hidden');
    icon.classList.remove('hidden');
    document.getElementById('removePhotoBtn')?.classList.add('hidden');
    document.getElementById('profilePhotoInput').value = '';
  });

  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('first_name', document.getElementById('profileFirstName').value);
      formData.append('last_name', document.getElementById('profileLastName').value);
      formData.append('phone', document.getElementById('profilePhone').value);
      
      const photoInput = document.getElementById('profilePhotoInput');
      if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
      }
      
      const imgPreview = document.getElementById('profileAvatarImgPreview');
      if (imgPreview.classList.contains('hidden') && !photoInput.files[0]) {
        formData.append('remove_photo', 'true');
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        body: formData
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al guardar perfil');
      }
      
      showNotification('Perfil actualizado correctamente');
      document.getElementById('profileModal')?.classList.add('hidden');
      checkSession();
    } catch (err) {
      showNotification(err.message || 'Error al guardar perfil', 'error');
    }
  });

  // ==========================================
  // EVENT LISTENERS - GESTOR MAX CONFIG MODAL
  // ==========================================
  document.getElementById('cerrarGestorConfigModal')?.addEventListener('click', () => {
    document.getElementById('gestorConfigModal')?.classList.add('hidden');
  });

  document.getElementById('cancelarGestorConfig')?.addEventListener('click', () => {
    document.getElementById('gestorConfigModal')?.classList.add('hidden');
  });

  document.getElementById('gestorConfigForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const baseUrlInput = document.getElementById('gestorBaseUrl');
    const baseUrlError = document.getElementById('gestorBaseUrlError');
    const secretWarning = document.getElementById('gestorSecretWarning');
    let baseUrl = baseUrlInput.value.trim() || 'https://api.gestormax.com';
    
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    try {
      const parsedUrl = new URL(baseUrl);
      if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
        baseUrlError?.classList.remove('hidden');
        baseUrlInput.focus();
        return;
      }
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch (urlErr) {
      baseUrlError?.classList.remove('hidden');
      baseUrlInput.focus();
      return;
    }
    baseUrlError?.classList.add('hidden');
    
    try {
      const clienteId = document.getElementById('gestorConfigClienteId').value;
      const payload = {
        gestor_database_id: parseInt(document.getElementById('gestorDatabaseId').value),
        gestor_api_key: document.getElementById('gestorApiKey').value,
        gestor_base_url: baseUrl,
        auth_scheme: document.getElementById('gestorAuthScheme').value
      };

      await api('/admin/clientes/' + clienteId + '/gestor-config', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      secretWarning?.classList.add('hidden');
      showNotification('Configuración guardada correctamente');
      document.getElementById('gestorConfigModal')?.classList.add('hidden');
      loadClientes();
    } catch (err) {
      if (err.status === 503 || (err.message && err.message.includes('APP_ENCRYPTION_KEY_B64'))) {
        secretWarning?.classList.remove('hidden');
      }
      showNotification(err.message || 'Error al guardar configuración', 'error');
    }
  });

  // ==========================================
  // EVENT LISTENERS - EDITAR EMPRESA MODAL
  // ==========================================
  document.getElementById('cerrarEditarEmpresaModal')?.addEventListener('click', () => {
    document.getElementById('editarEmpresaModal')?.classList.add('hidden');
  });

  document.getElementById('cancelarEditarEmpresa')?.addEventListener('click', () => {
    document.getElementById('editarEmpresaModal')?.classList.add('hidden');
  });

  document.getElementById('editarEmpresaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const id = document.getElementById('editarEmpresaId').value;
      const payload = {
        nombre: document.getElementById('editarEmpresaNombre').value,
        descripcion: document.getElementById('editarEmpresaDescripcion').value,
        activo: document.getElementById('editarEmpresaActivo').value === 'true'
      };

      await api('/admin/clientes/' + id, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      showNotification('Empresa actualizada correctamente');
      document.getElementById('editarEmpresaModal')?.classList.add('hidden');
      loadClientes();
    } catch (err) {
      showNotification(err.message || 'Error al actualizar empresa', 'error');
    }
  });

  // ==========================================
  // EVENT LISTENERS - MAYOR TAB (CSP compliant)
  // ==========================================
  document.getElementById('exportMayorCSVBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: exportMayorCSV');
    window.exportMayorCSV();
  });

  document.getElementById('nuevoAsientoBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: nuevoAsiento');
    window.nuevoAsiento();
  });

  document.getElementById('aplicarFiltrosMayorBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: aplicarFiltrosMayor');
    window.aplicarFiltrosMayor();
  });

  document.getElementById('limpiarFiltrosMayorBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: limpiarFiltrosMayor');
    window.limpiarFiltrosMayor();
  });

  document.getElementById('prevMayorPage')?.addEventListener('click', () => {
    console.log('Acción iniciada: cambiarPaginaMayor -1');
    window.cambiarPaginaMayor(-1);
  });

  document.getElementById('nextMayorPage')?.addEventListener('click', () => {
    console.log('Acción iniciada: cambiarPaginaMayor +1');
    window.cambiarPaginaMayor(1);
  });

  document.getElementById('closeAuditNotificationBtn')?.addEventListener('click', () => {
    document.getElementById('auditNotification')?.classList.add('hidden');
  });

  // Event delegation for dynamic Mayor pagination buttons
  document.getElementById('mayorPageNums')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.mayor-page-btn');
    if (btn && btn.dataset.page) {
      console.log('Acción iniciada: irAPaginaMayor', btn.dataset.page);
      window.irAPaginaMayor(parseInt(btn.dataset.page));
    }
  });

  // ==========================================
  // EVENT LISTENERS - BALANCE TAB (CSP compliant)
  // ==========================================
  document.getElementById('printBalanceBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: printBalance');
    window.printBalance();
  });

  document.getElementById('exportBalanceCSVBtn')?.addEventListener('click', () => {
    console.log('Acción iniciada: exportBalanceCSV');
    window.exportBalanceCSV();
  });

  document.getElementById('btnMovMes')?.addEventListener('click', () => {
    console.log('Acción iniciada: setBalanceMode mes');
    window.setBalanceMode('mes');
  });

  document.getElementById('btnAcumulado')?.addEventListener('click', () => {
    console.log('Acción iniciada: setBalanceMode acumulado');
    window.setBalanceMode('acumulado');
  });

  // ==========================================
  // EVENT LISTENERS - CATEGORY VIEW TOGGLES
  // ==========================================
  document.getElementById('btnMayorVistaCliente')?.addEventListener('click', () => {
    window.setMayorCategoriaView('cliente');
  });
  document.getElementById('btnMayorVistaGestor')?.addEventListener('click', () => {
    window.setMayorCategoriaView('gestor');
  });
  document.getElementById('btnBalanceVistaCliente')?.addEventListener('click', () => {
    window.setBalanceCategoriaView('cliente');
  });
  document.getElementById('btnBalanceVistaGestor')?.addEventListener('click', () => {
    window.setBalanceCategoriaView('gestor');
  });
});

async function openProfileModal() {
  try {
    const profile = await api('/profile');
    document.getElementById('profileFirstName').value = profile.first_name || '';
    document.getElementById('profileLastName').value = profile.last_name || '';
    document.getElementById('profileEmail').value = profile.email || '';
    document.getElementById('profilePhone').value = profile.phone || '';
    
    const img = document.getElementById('profileAvatarImgPreview');
    const icon = document.getElementById('profileAvatarIcon');
    const removeBtn = document.getElementById('removePhotoBtn');
    
    if (profile.profile_image_url) {
      img.src = profile.profile_image_url;
      img.classList.remove('hidden');
      icon.classList.add('hidden');
      removeBtn?.classList.remove('hidden');
    } else {
      img.src = '';
      img.classList.add('hidden');
      icon.classList.remove('hidden');
      removeBtn?.classList.add('hidden');
    }
    
    document.getElementById('profileModal')?.classList.remove('hidden');
  } catch (err) {
    showNotification(err.message || 'Error al cargar perfil', 'error');
  }
}