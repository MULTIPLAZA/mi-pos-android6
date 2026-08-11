-- Las 11 tablas MVP estan CONFIRMADAS contra information_schema.columns real de
-- Supabase (CSV entregado por el usuario, confirmado 2026-08-10). Sin borrador.
--
-- Nota: uniqueness (UNIQUE, FK reales) no se puede leer de information_schema.columns
-- -- son constraints, no columnas. `clave` UNIQUE y `(licencia_email,clave)` UNIQUE en
-- pos_config quedan como supuestos de negocio (coinciden con como los usa el codigo:
-- clave de activacion / upsert por on_conflict), no confirmados columna por columna.

CREATE TABLE licencias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clave           TEXT NOT NULL UNIQUE,
  plan_id         INTEGER,
  nombre_cliente  TEXT,
  email_cliente   TEXT,
  fecha_vence     TEXT NOT NULL,
  activa          INTEGER DEFAULT 1,
  notas           TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  rubro           TEXT DEFAULT '',
  tipo_pago       TEXT DEFAULT 'anual',
  monto           REAL,
  monto_soporte   INTEGER,
  precio_terminal INTEGER,
  tipo_negocio    TEXT DEFAULT 'gastronomia',
  capacidades     TEXT
);

CREATE TABLE activaciones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id      INTEGER REFERENCES licencias(id),
  device_id        TEXT NOT NULL,
  email            TEXT NOT NULL,
  nombre_negocio   TEXT,
  direccion        TEXT,
  fecha_activacion TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ultima_consulta  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  activa           INTEGER DEFAULT 1,
  ip_activacion    TEXT,
  sucursal         TEXT DEFAULT 'Principal',
  nombre_terminal  TEXT,
  deleted_at       TEXT,
  modo             TEXT NOT NULL DEFAULT 'caja'
);
CREATE UNIQUE INDEX ix_activaciones_device ON activaciones(device_id);
CREATE INDEX ix_activaciones_licencia ON activaciones(licencia_id);

CREATE TABLE pos_config (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_email TEXT NOT NULL,
  clave          TEXT NOT NULL,
  valor          TEXT,
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(licencia_email, clave) -- supuesto de negocio, ver nota arriba
);

CREATE TABLE pos_categorias (
  id             INTEGER PRIMARY KEY,
  nombre         TEXT NOT NULL,
  color          TEXT,
  licencia_email TEXT,
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_pos_categorias_tenant ON pos_categorias(licencia_email);

CREATE TABLE pos_productos (
  id              INTEGER PRIMARY KEY,
  nombre          TEXT NOT NULL,
  precio          REAL DEFAULT 0,
  precio_variable INTEGER DEFAULT 0,
  costo           REAL DEFAULT 0,
  codigo          TEXT,
  categoria       TEXT,
  iva             TEXT DEFAULT '10',
  color           TEXT,
  color_propio    INTEGER DEFAULT 0,
  mitad           INTEGER DEFAULT 0,
  inventario      INTEGER DEFAULT 0,
  comanda         INTEGER DEFAULT 0,
  item_libre      INTEGER DEFAULT 0,
  activo          INTEGER DEFAULT 1,
  terminal        TEXT,
  licencia_email  TEXT,
  updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT,
  es_descuento    INTEGER DEFAULT 0,
  desc_tipo       TEXT,
  desc_valor      REAL,
  imagen          TEXT,
  es_insumo       INTEGER NOT NULL DEFAULT 0,
  foto_url        TEXT,
  codigos         TEXT DEFAULT '[]',
  es_kilo         INTEGER NOT NULL DEFAULT 0,
  es_favorito     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_pos_productos_tenant ON pos_productos(licencia_email);

CREATE TABLE pos_mesas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id     INTEGER NOT NULL,
  licencia_id  INTEGER NOT NULL,
  sucursal_id  INTEGER,
  nombre       TEXT NOT NULL,
  capacidad    INTEGER DEFAULT 4,
  activo       INTEGER DEFAULT 1,
  orden        INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_pos_mesas_tenant ON pos_mesas(licencia_id);
CREATE INDEX ix_pos_mesas_salon ON pos_mesas(salon_id);

CREATE TABLE pos_salones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id  INTEGER NOT NULL,
  sucursal_id  INTEGER,
  nombre       TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#1565c0',
  activo       INTEGER DEFAULT 1,
  orden        INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_pos_salones_tenant ON pos_salones(licencia_id);

CREATE TABLE sucursales (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id INTEGER REFERENCES licencias(id),
  nombre      TEXT NOT NULL,
  direccion   TEXT,
  telefono    TEXT,
  activa      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_sucursales_tenant ON sucursales(licencia_id);

CREATE TABLE pos_turno (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_apertura        TEXT NOT NULL,
  fecha_cierre          TEXT,
  efectivo_inicial      REAL DEFAULT 0,
  estado                TEXT DEFAULT 'abierto',
  terminal              TEXT NOT NULL,
  total_contado         REAL,
  diferencia            REAL,
  licencia_email        TEXT NOT NULL,
  created_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  total_vendido         REAL DEFAULT 0,
  total_egresos         REAL DEFAULT 0,
  cantidad_ventas       INTEGER DEFAULT 0,
  resumen_pagos         TEXT,
  efectivo_inicial_brl  REAL DEFAULT 0
);
CREATE INDEX ix_pos_turno_tenant ON pos_turno(licencia_email);

CREATE TABLE pos_ventas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha             TEXT NOT NULL,
  turno_id          INTEGER REFERENCES pos_turno(id),
  terminal          TEXT,
  total             REAL NOT NULL,
  metodo_pago       TEXT,
  comprobante       TEXT,
  items             TEXT,
  tiene_factura     INTEGER DEFAULT 0,
  factura_ruc       TEXT,
  factura_nombre    TEXT,
  licencia_email    TEXT NOT NULL,
  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sucursal          TEXT,
  id_transaccion    TEXT,
  anulada           INTEGER NOT NULL DEFAULT 0,
  fecha_anulacion   TEXT,
  motivo_anulacion  TEXT,
  div_pagos         TEXT,
  cliente_nombre    TEXT,
  fe_cdc            TEXT,
  fe_estado         TEXT,
  fe_numero         TEXT,
  fe_qr             TEXT,
  fe_lote_id        TEXT,
  fe_error          TEXT,
  fe_respuesta      TEXT,
  fe_fecha_emision  TEXT,
  fe_nc_cdc         TEXT,
  fe_nc_numero      TEXT,
  fe_nc_estado      TEXT,
  mm_pagos          TEXT,
  pix_mp_pagos      TEXT
);
CREATE INDEX ix_pos_ventas_tenant ON pos_ventas(licencia_email);
CREATE INDEX ix_pos_ventas_turno ON pos_ventas(turno_id);

-- uuid en Postgres (gen_random_uuid()) -> TEXT en D1, generado por el Worker con
-- crypto.randomUUID() antes del INSERT (ver src/postgrestShim.js:runInsert).
CREATE TABLE pos_pedidos (
  id                TEXT PRIMARY KEY,
  licencia_email    TEXT NOT NULL,
  licencia_id       INTEGER,
  sucursal          TEXT NOT NULL DEFAULT 'Principal',
  terminal_origen   TEXT NOT NULL,
  mesero_id         TEXT,
  numero_orden      INTEGER,
  mesa              TEXT,
  tipo_pedido       TEXT NOT NULL DEFAULT 'llevar',
  estado            TEXT NOT NULL DEFAULT 'abierto',
  items             TEXT NOT NULL,
  total             INTEGER NOT NULL DEFAULT 0,
  observaciones     TEXT,
  venta_id          TEXT REFERENCES pos_ventas(id),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  descuento_ticket  REAL NOT NULL DEFAULT 0
);
CREATE INDEX ix_pos_pedidos_licencia_estado ON pos_pedidos(licencia_email, estado, created_at DESC);
