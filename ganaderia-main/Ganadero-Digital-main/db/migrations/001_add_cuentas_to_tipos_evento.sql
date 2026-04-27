-- =============================================================
-- MIGRACIÓN 001: Agregar cuentas contables configurables a tipos_evento
-- Fecha: 2026-04-24
-- Revertir:
--   ALTER TABLE tipos_evento DROP COLUMN IF EXISTS cuenta_debe_id;
--   ALTER TABLE tipos_evento DROP COLUMN IF EXISTS cuenta_haber_id;
-- =============================================================

ALTER TABLE tipos_evento
  ADD COLUMN IF NOT EXISTS cuenta_debe_id INTEGER REFERENCES cuentas(id),
  ADD COLUMN IF NOT EXISTS cuenta_haber_id INTEGER REFERENCES cuentas(id);

-- Migrar imputaciones desde lógica hardcodeada original
UPDATE tipos_evento te
SET
  cuenta_debe_id = (
    SELECT id FROM cuentas WHERE codigo = CASE te.codigo
      WHEN 'APERTURA'          THEN 'ACT001'
      WHEN 'NACIMIENTO'        THEN 'ACT001'
      WHEN 'DESTETE'           THEN 'ACT001'
      WHEN 'COMPRA'            THEN 'ACT001'
      WHEN 'VENTA'             THEN 'RES001'
      WHEN 'MORTANDAD'         THEN 'RES003'
      WHEN 'CONSUMO'           THEN 'RES004'
      WHEN 'CAMBIO_ACTIVIDAD'  THEN 'ACT001'
      WHEN 'CAMBIO_CATEGORIA'  THEN 'ACT001'
      WHEN 'TRANSFERENCIA'     THEN 'ACT001'
      WHEN 'TRASLADO'          THEN 'ACT001'
      WHEN 'AJUSTE_KG'         THEN 'ACT001'
      -- RECUENTO queda NULL (no genera asientos)
      ELSE NULL
    END
  ),
  cuenta_haber_id = (
    SELECT id FROM cuentas WHERE codigo = CASE te.codigo
      WHEN 'APERTURA'          THEN 'PN001'
      WHEN 'NACIMIENTO'        THEN 'PN001'
      WHEN 'DESTETE'           THEN 'PN001'
      WHEN 'COMPRA'            THEN 'RES002'
      WHEN 'VENTA'             THEN 'ACT001'
      WHEN 'MORTANDAD'         THEN 'ACT001'
      WHEN 'CONSUMO'           THEN 'ACT001'
      WHEN 'CAMBIO_ACTIVIDAD'  THEN 'ACT001'
      WHEN 'CAMBIO_CATEGORIA'  THEN 'ACT001'
      WHEN 'TRANSFERENCIA'     THEN 'ACT001'
      WHEN 'TRASLADO'          THEN 'ACT001'
      WHEN 'AJUSTE_KG'         THEN 'RES008'
      -- RECUENTO queda NULL (no genera asientos)
      ELSE NULL
    END
  );
