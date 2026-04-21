-- =============================================================
-- SCHEMA: Sistema de Registro de Eventos Ganaderos
-- Generado: 2026-01-27
-- Sin lotes (eliminados del modelo)
-- =============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- TABLAS PRINCIPALES
-- =============================================================

-- ROLES
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

-- CLIENTES (Tenants)
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USUARIOS
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    nombre VARCHAR(255) NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES roles(id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replit_user_id VARCHAR(255) UNIQUE,
    tenant_id INTEGER REFERENCES clientes(id)
);

-- REPLIT_USERS (usuarios autenticados via Replit Auth)
CREATE TABLE replit_users (
    id VARCHAR PRIMARY KEY,
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AUDITOR_CLIENTES (relación auditor-tenant)
CREATE TABLE auditor_clientes (
    id SERIAL PRIMARY KEY,
    auditor_id INTEGER NOT NULL REFERENCES usuarios(id),
    tenant_id INTEGER NOT NULL REFERENCES clientes(id),
    UNIQUE(auditor_id, tenant_id)
);

-- ACTIVIDADES
CREATE TABLE actividades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    tenant_id INTEGER REFERENCES clientes(id),
    UNIQUE(nombre)
);

-- CAMPOS
CREATE TABLE campos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    cliente_id INTEGER REFERENCES usuarios(id),
    tenant_id INTEGER REFERENCES clientes(id)
);

-- CAMPO_ACTIVIDADES (relación campo-actividad)
CREATE TABLE campo_actividades (
    campo_id INTEGER NOT NULL REFERENCES campos(id),
    actividad_id INTEGER NOT NULL REFERENCES actividades(id),
    PRIMARY KEY (campo_id, actividad_id)
);

-- PLANES_CUENTA
CREATE TABLE planes_cuenta (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL
);

-- CUENTAS
CREATE TABLE cuentas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    plan_cuenta_id INTEGER NOT NULL REFERENCES planes_cuenta(id),
    tipo_normal VARCHAR(10) CHECK (tipo_normal IN ('DEBE', 'HABER'))
);

-- TIPOS_EVENTO
CREATE TABLE tipos_evento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    plan_cuenta_id INTEGER REFERENCES planes_cuenta(id),
    requiere_origen_destino BOOLEAN DEFAULT FALSE,
    requiere_campo_destino BOOLEAN DEFAULT FALSE
);

-- CATEGORIAS (tipo CLIENTE y GESTOR)
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    actividad_id INTEGER REFERENCES actividades(id),
    agrup1 VARCHAR(100),
    agrup2 VARCHAR(100),
    peso_estandar NUMERIC(10,2),
    tenant_id INTEGER REFERENCES clientes(id),
    es_estandar BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    tipo TEXT NOT NULL DEFAULT 'CLIENTE' CHECK (tipo IN ('CLIENTE', 'GESTOR')),
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    last_synced_at TIMESTAMPTZ
);

-- CATEGORIAS_MAPEO (mapeo entre CLIENTE y GESTOR)
CREATE TABLE categorias_mapeo (
    tenant_id INTEGER NOT NULL REFERENCES clientes(id),
    categoria_cliente_id INTEGER NOT NULL REFERENCES categorias(id),
    categoria_gestor_id INTEGER NOT NULL REFERENCES categorias(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_replit_id TEXT,
    PRIMARY KEY (tenant_id, categoria_cliente_id)
);

-- EVENTOS (sin lotes - sistema opera a nivel Campo)
CREATE TABLE eventos (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo_evento_id INTEGER NOT NULL REFERENCES tipos_evento(id),
    campo_id INTEGER NOT NULL REFERENCES campos(id),
    campo_destino_id INTEGER REFERENCES campos(id),
    actividad_origen_id INTEGER REFERENCES actividades(id),
    actividad_destino_id INTEGER REFERENCES actividades(id),
    categoria_id INTEGER REFERENCES categorias(id),
    categoria_origen_id INTEGER REFERENCES categorias(id),
    categoria_destino_id INTEGER REFERENCES categorias(id),
    categoria_gestor_id INTEGER REFERENCES categorias(id),
    cabezas INTEGER NOT NULL,
    kg_totales NUMERIC(12,2),
    kg_cabeza NUMERIC(10,2),
    observaciones TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    validado BOOLEAN DEFAULT FALSE,
    validado_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ASIENTOS (sin lotes - sistema opera a nivel Campo)
CREATE TABLE asientos (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES eventos(id),
    fecha DATE NOT NULL,
    cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('DEBE', 'HABER')),
    cabezas INTEGER NOT NULL,
    kg NUMERIC(12,2),
    kg_cabeza NUMERIC(10,2),
    campo_id INTEGER REFERENCES campos(id),
    actividad_id INTEGER REFERENCES actividades(id),
    categoria_id INTEGER REFERENCES categorias(id),
    categoria_gestor_id INTEGER REFERENCES categorias(id)
);

-- EMPRESA_GESTOR_CONFIG (configuración Gestor Max por tenant)
CREATE TABLE empresa_gestor_config (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL UNIQUE REFERENCES clientes(id),
    gestor_database_id INTEGER NOT NULL,
    gestor_api_key_enc TEXT NOT NULL,
    gestor_api_key_last4 TEXT NOT NULL,
    gestor_base_url TEXT NOT NULL DEFAULT 'https://api.gestormax.com',
    auth_scheme TEXT NOT NULL DEFAULT 'bearer',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_test_at TIMESTAMPTZ,
    last_test_ok BOOLEAN,
    last_test_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GESTOR_CONCEPTOS (cache de conceptos de Gestor Max)
CREATE TABLE gestor_conceptos (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES clientes(id),
    cod_concepto TEXT NOT NULL,
    codigo_concepto TEXT,
    descripcion TEXT,
    grupo_conceptos TEXT,
    subgrupo_conceptos TEXT,
    clasificacion_conceptos TEXT,
    tipo_concepto TEXT,
    habilitado BOOLEAN,
    raw JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, cod_concepto)
);

-- SESSIONS (express-session store)
CREATE TABLE sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- USER_SESSIONS_LEGACY (sesiones legacy - puede eliminarse en futuro)
CREATE TABLE user_sessions_legacy (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- ÍNDICES
-- =============================================================

CREATE INDEX idx_asientos_fecha ON asientos(fecha);
CREATE INDEX idx_asientos_filtros ON asientos(campo_id, categoria_id);
CREATE INDEX idx_campos_tenant_activo ON campos(tenant_id) WHERE activo = TRUE;
CREATE INDEX idx_usuarios_replit_activo ON usuarios(replit_user_id) WHERE activo = TRUE;
CREATE INDEX idx_eventos_campo ON eventos(campo_id);
CREATE INDEX idx_session_expire ON sessions(expire);
CREATE INDEX idx_empresa_gestor_config_cliente_id ON empresa_gestor_config(cliente_id);
CREATE INDEX ix_categorias_mapeo_tenant_gestor ON categorias_mapeo(tenant_id, categoria_gestor_id);

CREATE UNIQUE INDEX ux_cat_gestor_external ON categorias(tenant_id, external_id) WHERE tipo = 'GESTOR';
CREATE UNIQUE INDEX ux_cat_tenant_tipo_nombre_lower ON categorias(tenant_id, tipo, LOWER(nombre));
CREATE UNIQUE INDEX categorias_mapeo_unique_cliente ON categorias_mapeo(tenant_id, categoria_cliente_id) WHERE activo = TRUE;
CREATE UNIQUE INDEX uq_categorias_mapeo_tenant_cliente ON categorias_mapeo(tenant_id, categoria_cliente_id);
