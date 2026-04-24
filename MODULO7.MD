# Módulo 6 — Integración Gestor Max: verificación de conexión y estado visible

## Criticidad

MEDIA

## Objetivo

Agregar una verificación de conectividad con Gestor Max y mostrar en administración si la integración está operativa.

## Diagnóstico

El endpoint o tabla `empresa_gestor_config` almacena credenciales cifradas con AES-256-GCM, lo cual es correcto. Sin embargo, no existe una prueba de conectividad visible para el operador. Esto impide saber si la integración está funcionando antes de registrar eventos o sincronizar información.

## Alcance

Este módulo afecta principalmente:

- `index.js`
- `public/script.js`
- `public/index.html`
- Tabla `empresa_gestor_config`, si faltan columnas de estado
- Función existente `decryptCredential()`
- Panel de administración de Empresa/Gestor Max

## Tareas

### 1. Verificar estructura de `empresa_gestor_config`

Confirmar que existan o agregar columnas para estado de último test:

```sql
ALTER TABLE empresa_gestor_config
ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_test_ok BOOLEAN,
ADD COLUMN IF NOT EXISTS last_test_error TEXT;
```

No guardar API keys desencriptadas.

### 2. Crear endpoint de test de conectividad

Agregar endpoint en `index.js`:

```js
app.post('/api/admin/gestor/test-connection', isAuthenticated, isAdminOnly, async (req, res) => {
  try {
    const config = await pool.query(
      'SELECT * FROM empresa_gestor_config WHERE cliente_id = $1',
      [req.activeTenantId]
    );

    if (!config.rows[0]) {
      return res.status(404).json({ error: 'No hay configuración de Gestor Max para este cliente.' });
    }

    const {
      gestor_api_key_enc,
      gestor_base_url,
      gestor_database_id
    } = config.rows[0];

    const apiKey = decryptCredential(gestor_api_key_enc);
    const start = Date.now();

    const testRes = await fetch(`${gestor_base_url}/api/v1/health`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Database-Id': gestor_database_id
      },
      signal: AbortSignal.timeout(5000)
    });

    const latencyMs = Date.now() - start;
    const success = testRes.ok;
    const message = success ? 'Conexión exitosa' : `Error HTTP ${testRes.status}`;

    await pool.query(
      `UPDATE empresa_gestor_config
       SET last_test_at = NOW(), last_test_ok = $1, last_test_error = $2
       WHERE cliente_id = $3`,
      [success, success ? null : message, req.activeTenantId]
    );

    res.json({
      success,
      message,
      latencyMs,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    await pool.query(
      `UPDATE empresa_gestor_config
       SET last_test_at = NOW(), last_test_ok = false, last_test_error = $1
       WHERE cliente_id = $2`,
      [err.message, req.activeTenantId]
    ).catch(() => {});

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
```

Ajustar la URL `/api/v1/health` si Gestor Max usa otro endpoint real de health check.

### 3. Crear endpoint de estado

Agregar un endpoint de consulta para pintar el badge sin ejecutar test cada vez:

```js
app.get('/api/admin/gestor/status', isAuthenticated, isAdminOnly, async (req, res) => {
  const result = await pool.query(
    `SELECT last_test_at, last_test_ok, last_test_error
     FROM empresa_gestor_config
     WHERE cliente_id = $1`,
    [req.activeTenantId]
  );

  if (!result.rows[0]) {
    return res.json({ configured: false });
  }

  res.json({
    configured: true,
    ...result.rows[0]
  });
});
```

### 4. Mostrar estado en administración

Agregar un badge en el panel de Empresa/Gestor Max:

```html
<span id="gestorStatusBadge" class="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
  Sin verificar
</span>
<button id="btnTestGestorConnection" type="button">
  Probar conexión
</button>
```

Adaptar clases al estilo real del proyecto.

### 5. Implementar carga de estado en JS

```js
async function loadGestorStatus() {
  const data = await api('/admin/gestor/status');
  const badge = document.getElementById('gestorStatusBadge');

  if (!badge) return;

  if (!data.configured) {
    badge.className = 'px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300';
    badge.textContent = 'Sin configuración';
    return;
  }

  badge.className = data.last_test_ok
    ? 'px-2 py-0.5 rounded text-xs bg-green-900/30 text-green-400'
    : 'px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400';

  badge.textContent = data.last_test_ok
    ? `Conectado — ${data.last_test_at ? new Date(data.last_test_at).toLocaleString('es-AR') : ''}`
    : `Sin conexión — ${data.last_test_error || 'No verificado'}`;
}
```

### 6. Implementar botón de prueba

```js
document.getElementById('btnTestGestorConnection')?.addEventListener('click', async () => {
  const badge = document.getElementById('gestorStatusBadge');

  try {
    if (badge) {
      badge.className = 'px-2 py-0.5 rounded text-xs bg-yellow-900/30 text-yellow-300';
      badge.textContent = 'Probando conexión...';
    }

    const result = await api('/admin/gestor/test-connection', {
      method: 'POST'
    });

    await loadGestorStatus();

    if (!result.success) {
      showToast?.(result.message || result.error || 'No se pudo conectar con Gestor Max', 'error');
    } else {
      showToast?.(`Conexión exitosa (${result.latencyMs} ms)`, 'success');
    }
  } catch (err) {
    if (badge) {
      badge.className = 'px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400';
      badge.textContent = `Error — ${err.message}`;
    }
  }
});
```

Si el proyecto no tiene `showToast`, usar el mecanismo de notificación existente.

## Criterios de aceptación

- Administración muestra si Gestor Max está configurado.
- El operador puede probar conexión manualmente.
- El resultado del test se guarda en `empresa_gestor_config`.
- El badge muestra conectado o sin conexión con último mensaje disponible.
- La API key nunca se expone al frontend.
- El test tiene timeout para no colgar la UI.
- Los errores son legibles.

## Pruebas mínimas

1. Cliente sin configuración: badge muestra `Sin configuración`.
2. Cliente con configuración válida: botón devuelve `Conexión exitosa`.
3. Cliente con URL inválida: badge muestra error.
4. Cliente con API key inválida: badge muestra error HTTP o mensaje equivalente.
5. Confirmar en consola/red que la API key no aparece en la respuesta.
6. Confirmar que `last_test_at`, `last_test_ok` y `last_test_error` se actualizan.

## Prompt sugerido para agente

Implementá el módulo 6 del plan de mejoras. Agregá verificación de conectividad con Gestor Max desde administración, usando la configuración cifrada existente de `empresa_gestor_config`. Creá endpoint POST para probar conexión, endpoint GET para estado, guardá último resultado y mostrá un badge en la UI. No expongas credenciales al frontend. Usá timeout y errores legibles. No modifiques la lógica de sincronización salvo que sea estrictamente necesario.
