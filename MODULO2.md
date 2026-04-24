# Módulo 1 — Motor contable: eliminar cuentas hardcodeadas

## Criticidad

BLOQUEANTE

## Objetivo

Eliminar el uso de cuentas contables hardcodeadas dentro de `generateAsientos()` y reemplazarlo por imputaciones configurables por tipo de evento. Además, validar que todo asiento generado cumpla DEBE = HABER antes de persistirse.

## Diagnóstico

La función `generateAsientos()` en `index.js` contiene un mapa estático de cuentas con códigos literales como:

```js
'NACIMIENTO': [{ c: 'ACT001', t: 'DEBE' }, { c: 'PN001', t: 'HABER' }],
'COMPRA': [{ c: 'ACT001', t: 'DEBE' }, { c: 'RES002', t: 'HABER' }],
```

También existen tipos de evento especiales como `TRASLADO`, `CAMBIO_ACTIVIDAD`, `AJUSTE_KG` y otros que usan códigos como `ACT001`, `RES008` o `PN002` directamente.

El problema principal es que la generación contable ignora la configuración del tenant y queda atada a cuentas fijas.

## Alcance

Este módulo afecta principalmente:

- `index.js`
- Tabla `tipos_evento`
- Tabla `cuentas`
- Endpoints administrativos de tipos de evento
- Migración SQL
- Seed de cuentas, si corresponde

## Tareas

### 1. Crear migración SQL

Agregar columnas de imputación contable a `tipos_evento`:

```sql
ALTER TABLE tipos_evento
ADD COLUMN cuenta_debe_id INTEGER REFERENCES cuentas(id),
ADD COLUMN cuenta_haber_id INTEGER REFERENCES cuentas(id);
```

Luego migrar los datos existentes usando los códigos actuales:

```sql
UPDATE tipos_evento te
SET
  cuenta_debe_id = (
    SELECT id FROM cuentas WHERE codigo = CASE te.codigo
      WHEN 'NACIMIENTO' THEN 'ACT001'
      WHEN 'DESTETE' THEN 'ACT001'
      WHEN 'APERTURA' THEN 'ACT001'
      WHEN 'COMPRA' THEN 'ACT001'
      WHEN 'VENTA' THEN 'RES001'
      WHEN 'MORTANDAD' THEN 'RES003'
      WHEN 'CONSUMO' THEN 'RES004'
      ELSE NULL
    END
  ),
  cuenta_haber_id = (
    SELECT id FROM cuentas WHERE codigo = CASE te.codigo
      WHEN 'NACIMIENTO' THEN 'PN001'
      WHEN 'DESTETE' THEN 'PN001'
      WHEN 'APERTURA' THEN 'PN001'
      WHEN 'COMPRA' THEN 'RES002'
      WHEN 'VENTA' THEN 'ACT001'
      WHEN 'MORTANDAD' THEN 'ACT001'
      WHEN 'CONSUMO' THEN 'ACT001'
      ELSE NULL
    END
  );
```

Ajustar la migración si en el repositorio existen más tipos de evento cargados.

### 2. Refactorizar `generateAsientos()`

Reemplazar el mapa hardcodeado por consulta dinámica a `tipos_evento` y `cuentas`.

La función debe obtener:

- Código del tipo de evento
- Cuenta DEBE configurada
- Cuenta HABER configurada
- Flags existentes del tipo de evento, si aplican

Ejemplo de consulta esperada:

```js
const tipoRes = await client.query(
  `SELECT
      te.codigo,
      te.requiere_origen_destino,
      te.requiere_campo_destino,
      c_d.codigo AS cuenta_debe_codigo,
      c_d.id AS cuenta_debe_id,
      c_h.codigo AS cuenta_haber_codigo,
      c_h.id AS cuenta_haber_id
   FROM tipos_evento te
   LEFT JOIN cuentas c_d ON te.cuenta_debe_id = c_d.id
   LEFT JOIN cuentas c_h ON te.cuenta_haber_id = c_h.id
   WHERE te.id = $1`,
  [evento.tipo_evento_id]
);
```

### 3. Validar configuración contable

Si el tipo de evento no tiene cuenta DEBE o HABER configurada, bloquear el guardado del evento con un error claro:

```js
if (!tipo.cuenta_debe_id || !tipo.cuenta_haber_id) {
  throw new Error(
    `El tipo de evento "${tipo.codigo}" no tiene cuentas contables configuradas. ` +
    `Configure cuenta DEBE y HABER en Administración > Tipos de Evento.`
  );
}
```

### 4. Mantener lógica especial por tipo de evento

La función debe seguir contemplando diferencias entre tipos de evento:

- `TRASLADO`
- `CAMBIO_ACTIVIDAD`
- `AJUSTE_KG`
- `RECUENTO`
- Tipos estándar

Regla importante:

- `RECUENTO` debe ser informativo y no generar asientos.
- `AJUSTE_KG` debe invertir la imputación cuando el kg sea negativo, si esa es la lógica actual.
- Los demás tipos deben generar DEBE y HABER con las cuentas configuradas.

### 5. Validar DEBE = HABER antes de persistir

Después de generar los asientos y antes de insertarlos, validar que el asiento esté cuadrado.

Ejemplo:

```js
const totalDebe = asientosData
  .filter(a => a.tipo === 'DEBE')
  .reduce((s, a) => s + Number(a.kg || 0), 0);

const totalHaber = asientosData
  .filter(a => a.tipo === 'HABER')
  .reduce((s, a) => s + Number(a.kg || 0), 0);

const diff = Math.abs(totalDebe - totalHaber);

if (diff > 0.001) {
  throw new Error(
    `Asiento descuadrado: DEBE=${totalDebe} HABER=${totalHaber} diferencia=${diff.toFixed(3)}`
  );
}
```

Adaptar la base de comparación al modelo real si el asiento usa cabezas, kg o importes. No validar solo por cabezas si el movimiento relevante es kg.

### 6. Actualizar endpoints admin de tipos de evento

Agregar validaciones al `POST /api/admin/tipos-evento` y `PUT /api/admin/tipos-evento/:id`:

```js
body('cuenta_debe_id')
  .optional()
  .isInt({ min: 1 })
  .withMessage('Cuenta DEBE inválida'),

body('cuenta_haber_id')
  .optional()
  .isInt({ min: 1 })
  .withMessage('Cuenta HABER inválida')
```

Agregar ambas columnas al `INSERT` y `UPDATE`.

## Criterios de aceptación

- No quedan cuentas hardcodeadas dentro de `generateAsientos()`.
- Cada tipo de evento usa `cuenta_debe_id` y `cuenta_haber_id` configuradas en base de datos.
- Si faltan cuentas configuradas, el evento no se guarda.
- El error informa claramente qué tipo de evento no tiene cuentas configuradas.
- Ningún asiento descuadrado se persiste.
- `RECUENTO` no genera asientos.
- Se probaron manualmente: `NACIMIENTO`, `COMPRA`, `VENTA`, `MORTANDAD`, `TRASLADO`, `CAMBIO_ACTIVIDAD`, `AJUSTE_KG` y `RECUENTO`.

## Pruebas mínimas

1. Crear evento `NACIMIENTO` con cuentas configuradas.
2. Crear evento `COMPRA` con cuentas configuradas.
3. Crear evento `VENTA` con cuentas configuradas.
4. Crear evento `RECUENTO` y verificar que no genera asientos.
5. Quitar temporalmente cuenta DEBE o HABER a un tipo de evento y confirmar que el guardado se bloquea.
6. Forzar un asiento descuadrado y confirmar que se rechaza antes de persistir.

## Prompt sugerido para agente

Implementá el módulo 1 del plan de mejoras. Trabajá únicamente sobre el motor contable, la migración SQL y los endpoints administrativos de tipos de evento. Eliminá las cuentas hardcodeadas de `generateAsientos()` y reemplazalas por `cuenta_debe_id` y `cuenta_haber_id` desde `tipos_evento`. Agregá validación de cuentas configuradas y control DEBE = HABER antes de persistir. No introduzcas frameworks nuevos. Mantené compatibilidad con Node.js, Express, PostgreSQL y Vanilla JS. Entregá el diff con explicación breve y checklist de pruebas manuales.
