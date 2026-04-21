-- =============================================================
-- SEED: Datos iniciales del sistema
-- Generado: 2026-01-27
-- =============================================================

-- ROLES
INSERT INTO roles (nombre, descripcion) VALUES
    ('administrador', 'Acceso total al sistema'),
    ('auditor', 'Acceso de lectura y reportes a clientes asignados'),
    ('cliente', 'Usuario de un tenant específico')
ON CONFLICT (nombre) DO NOTHING;

-- PLANES DE CUENTA BASE
INSERT INTO planes_cuenta (codigo, nombre) VALUES
    ('ACT', 'Activo'),
    ('PN', 'Patrimonio Neto'),
    ('RES', 'Resultado')
ON CONFLICT (codigo) DO NOTHING;

-- CUENTAS BASE
-- Plan ACT (Activo)
INSERT INTO cuentas (codigo, nombre, plan_cuenta_id, tipo_normal)
SELECT v.codigo, v.nombre, pc.id, v.tipo_normal
FROM (VALUES
    ('ACT001', 'Stock Hacienda', 'DEBE')
) AS v(codigo, nombre, tipo_normal)
CROSS JOIN planes_cuenta pc WHERE pc.codigo = 'ACT'
ON CONFLICT (codigo) DO NOTHING;

-- Plan PN (Patrimonio Neto)
INSERT INTO cuentas (codigo, nombre, plan_cuenta_id, tipo_normal)
SELECT v.codigo, v.nombre, pc.id, v.tipo_normal
FROM (VALUES
    ('PN001', 'Capital Hacienda Apertura', 'HABER'),
    ('PN002', 'Nacimientos', 'HABER')
) AS v(codigo, nombre, tipo_normal)
CROSS JOIN planes_cuenta pc WHERE pc.codigo = 'PN'
ON CONFLICT (codigo) DO NOTHING;

-- Plan RES (Resultado)
INSERT INTO cuentas (codigo, nombre, plan_cuenta_id, tipo_normal)
SELECT v.codigo, v.nombre, pc.id, v.tipo_normal
FROM (VALUES
    ('RES001', 'Compras Hacienda', 'DEBE'),
    ('RES002', 'Ventas Hacienda', 'HABER'),
    ('RES003', 'Mortandad', 'DEBE'),
    ('RES004', 'Diferencia Recuento', 'DEBE'),
    ('RES005', 'Transferencia Entrada', 'DEBE'),
    ('RES006', 'Transferencia Salida', 'HABER'),
    ('RES007', 'Cambio Categoría', 'DEBE'),
    ('RES008', 'Ajuste Kilogramos', 'DEBE')
) AS v(codigo, nombre, tipo_normal)
CROSS JOIN planes_cuenta pc WHERE pc.codigo = 'RES'
ON CONFLICT (codigo) DO NOTHING;

-- TIPOS DE EVENTO BASE
INSERT INTO tipos_evento (codigo, nombre, plan_cuenta_id, requiere_origen_destino, requiere_campo_destino)
SELECT v.codigo, v.nombre, pc.id, v.req_od, v.req_cd
FROM (VALUES
    ('APERTURA', 'Apertura de Stock', FALSE, FALSE),
    ('COMPRA', 'Compra', FALSE, FALSE),
    ('VENTA', 'Venta', FALSE, FALSE),
    ('NACIMIENTO', 'Nacimiento', FALSE, FALSE),
    ('MORTANDAD', 'Mortandad', FALSE, FALSE),
    ('CAMBIO_CATEGORIA', 'Cambio de Categoría', TRUE, FALSE),
    ('CAMBIO_ACTIVIDAD', 'Cambio de Actividad', TRUE, FALSE),
    ('TRANSFERENCIA', 'Transferencia entre Campos', FALSE, TRUE),
    ('AJUSTE_KG', 'Ajuste de Kilogramos', FALSE, FALSE),
    ('RECUENTO', 'Recuento/Ajuste de Stock', FALSE, FALSE)
) AS v(codigo, nombre, req_od, req_cd)
CROSS JOIN planes_cuenta pc WHERE pc.codigo = 'ACT'
ON CONFLICT (codigo) DO NOTHING;

-- ACTIVIDADES BASE (globales, sin tenant)
INSERT INTO actividades (nombre, tenant_id) VALUES
    ('CRIA', NULL),
    ('RECRIA', NULL),
    ('INVERNADA', NULL),
    ('FEEDLOT', NULL),
    ('TAMBO', NULL)
ON CONFLICT (nombre) DO NOTHING;

-- Nota: El usuario administrador inicial debe crearse manualmente
-- o mediante el sistema de auto-provisioning con Replit Auth
