-- Completa Finanzas (Gastos Fijos/Plan de Gastos, Liquidación IVA) y
-- Facturación Electrónica (Timbrados) en D1. Columnas confirmadas contra
-- filas reales de Supabase (GET .../tabla?select=*&limit=1).
--
-- OJO timbrados/timbrado_terminales: admin-finanzas.js:guardarTim()/
-- abrirModalAsignar() hacen UPSERT con on_conflict='licencia_email,nro' y
-- 'licencia_email,terminal' respectivamente -- mismo patron que ya rompio
-- pos_productos (ver d1-migrations/0006_fix_productos_categorias_pk_compuesta.sql):
-- sin una UNIQUE que matchee EXACTO esas columnas, SQLite tira "ON CONFLICT
-- clause does not match any PRIMARY KEY or UNIQUE constraint". Por eso estas
-- dos tablas declaran la UNIQUE desde el vamos, en vez de agregarla despues
-- como parche.

CREATE TABLE IF NOT EXISTS gasto_categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id INTEGER NOT NULL,
  nombre      TEXT NOT NULL,
  orden       INTEGER DEFAULT 0,
  activa      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_gasto_categorias_tenant ON gasto_categorias(licencia_id);

CREATE TABLE IF NOT EXISTS gasto_conceptos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id  INTEGER NOT NULL,
  categoria_id INTEGER,
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  orden        INTEGER DEFAULT 0,
  activo       INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_gasto_conceptos_tenant ON gasto_conceptos(licencia_id);

CREATE TABLE IF NOT EXISTS gastos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id  INTEGER NOT NULL,
  fecha        TEXT,
  concepto     TEXT,
  categoria    TEXT,
  monto        REAL DEFAULT 0,
  observacion  TEXT,
  sucursal     TEXT,
  usuario      TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  concepto_id  INTEGER,
  categoria_id INTEGER,
  tiene_factura INTEGER DEFAULT 0,
  factura_nro  TEXT,
  factura_ruc  TEXT
);
CREATE INDEX IF NOT EXISTS ix_gastos_tenant ON gastos(licencia_id);

CREATE TABLE IF NOT EXISTS iva_liquidaciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id     INTEGER NOT NULL,
  periodo         TEXT NOT NULL,
  venta_10        REAL DEFAULT 0,
  venta_5         REAL DEFAULT 0,
  venta_exenta    REAL DEFAULT 0,
  debito_10       REAL DEFAULT 0,
  debito_5        REAL DEFAULT 0,
  debito_total    REAL DEFAULT 0,
  compra_10       REAL DEFAULT 0,
  compra_5        REAL DEFAULT 0,
  credito_compras REAL DEFAULT 0,
  gasto_10        REAL DEFAULT 0,
  gasto_5         REAL DEFAULT 0,
  credito_gastos  REAL DEFAULT 0,
  credito_total   REAL DEFAULT 0,
  iva_pagar       REAL DEFAULT 0,
  iva_favor       REAL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'borrador',
  notas           TEXT,
  usuario         TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS ix_iva_liquidaciones_tenant ON iva_liquidaciones(licencia_id);

CREATE TABLE IF NOT EXISTS timbrados (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_email TEXT NOT NULL,
  nro            TEXT NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'autoimpresor',
  vig_ini        TEXT,
  vig_fin        TEXT,
  sucursal       TEXT,
  nombre_suc     TEXT,
  desde          INTEGER DEFAULT 1,
  hasta          INTEGER DEFAULT 5000,
  cert_venc      TEXT,
  cert_emis      TEXT,
  activo         INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(licencia_email, nro)
);
CREATE INDEX IF NOT EXISTS ix_timbrados_tenant ON timbrados(licencia_email);

CREATE TABLE IF NOT EXISTS timbrado_terminales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  timbrado_id    INTEGER NOT NULL,
  licencia_email TEXT NOT NULL,
  terminal       TEXT NOT NULL,
  sucursal       TEXT,
  punto_exp      TEXT,
  nro_actual     INTEGER DEFAULT 1,
  activo         INTEGER DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(licencia_email, terminal)
);
CREATE INDEX IF NOT EXISTS ix_timbrado_terminales_tenant ON timbrado_terminales(licencia_email);
