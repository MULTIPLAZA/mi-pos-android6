-- BORRADOR — columnas inferidas del uso en js/*.js, NO del schema real de Supabase.
-- Ver workers/mipos-gateway/docs/columnas-inferidas-core.md para el detalle y las
-- marcas "-- validar". NO aplicar contra un D1 de produccion sin antes correr la
-- query de docs/fase0-inventario.md en Supabase SQL Editor y corregir esto.
--
-- Solo cubre las 10 tablas MVP necesarias para que un cliente nuevo funcione:
-- licencias, activaciones, pos_config, pos_categorias, pos_productos, pos_ventas,
-- pos_turno, pos_mesas, pos_salones, sucursales. Modulos opcionales (hospedaje,
-- factura-electronica avanzada, stock, gastos, creditos, timbrados) se agregan
-- en migraciones posteriores segun lo que necesite el primer cliente piloto.

CREATE TABLE licencias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clave           TEXT NOT NULL UNIQUE,
  plan_id         INTEGER NOT NULL DEFAULT 2,
  nombre_cliente  TEXT,
  email_cliente   TEXT NOT NULL UNIQUE,
  fecha_vence     TEXT NOT NULL,
  notas           TEXT,
  rubro           TEXT,
  tipo_pago       TEXT NOT NULL DEFAULT 'anual',
  tipo_negocio    TEXT NOT NULL DEFAULT 'gastronomia',
  capacidades     TEXT,
  monto           REAL,
  monto_soporte   REAL,
  precio_terminal REAL,
  activa          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE activaciones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id        TEXT NOT NULL,
  email            TEXT NOT NULL,
  licencia_id      INTEGER NOT NULL REFERENCES licencias(id),
  nombre_negocio   TEXT,
  nombre_terminal  TEXT DEFAULT 'Terminal 1',
  sucursal         TEXT,
  modo             TEXT NOT NULL DEFAULT 'caja',
  activa           INTEGER NOT NULL DEFAULT 1,
  fecha_activacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ultima_consulta  TEXT,
  deleted_at       TEXT
);
CREATE UNIQUE INDEX ix_activaciones_device ON activaciones(device_id);
CREATE INDEX ix_activaciones_licencia ON activaciones(licencia_id);

CREATE TABLE pos_config (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_email TEXT NOT NULL,
  clave          TEXT NOT NULL,
  valor          TEXT NOT NULL,
  UNIQUE(licencia_email, clave)
);

CREATE TABLE pos_categorias (
  id             INTEGER PRIMARY KEY,
  nombre         TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#546e7a',
  licencia_email TEXT NOT NULL,
  activa         INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT
);
CREATE INDEX ix_pos_categorias_tenant ON pos_categorias(licencia_email);

CREATE TABLE pos_productos (
  id              INTEGER PRIMARY KEY,
  nombre          TEXT NOT NULL,
  precio          REAL NOT NULL DEFAULT 0,
  precio_variable INTEGER NOT NULL DEFAULT 0,
  costo           REAL NOT NULL DEFAULT 0,
  codigo          TEXT,
  codigos         TEXT,
  categoria       TEXT NOT NULL DEFAULT 'Sin categoría',
  iva             TEXT NOT NULL DEFAULT '10',
  color           TEXT NOT NULL DEFAULT '#546e7a',
  color_propio    INTEGER NOT NULL DEFAULT 0,
  mitad           INTEGER NOT NULL DEFAULT 0,
  inventario      INTEGER NOT NULL DEFAULT 0,
  comanda         INTEGER NOT NULL DEFAULT 0,
  es_kilo         INTEGER NOT NULL DEFAULT 0,
  es_favorito     INTEGER NOT NULL DEFAULT 0,
  es_insumo       INTEGER NOT NULL DEFAULT 0,
  activo          INTEGER NOT NULL DEFAULT 1,
  imagen          TEXT, -- validar: puede ser el mismo campo que foto_url
  foto_url        TEXT, -- validar
  licencia_email  TEXT NOT NULL,
  updated_at      TEXT,
  stock           REAL,     -- validar (confianza baja, solo lectura en el codigo actual)
  stock_min       REAL      -- validar (confianza baja)
);
CREATE INDEX ix_pos_productos_tenant ON pos_productos(licencia_email);

CREATE TABLE pos_ventas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha             TEXT NOT NULL,
  turno_id          INTEGER,
  terminal          TEXT,
  sucursal          TEXT NOT NULL DEFAULT 'Principal',
  licencia_email    TEXT NOT NULL,
  total             REAL NOT NULL DEFAULT 0,
  metodo_pago       TEXT NOT NULL,
  comprobante       TEXT,
  items             TEXT NOT NULL,
  div_pagos         TEXT,
  mm_pagos          TEXT,
  pix_mp_pagos      TEXT,
  cliente_nombre    TEXT,
  tiene_factura     INTEGER NOT NULL DEFAULT 0,
  factura_ruc       TEXT NOT NULL DEFAULT '',
  factura_nombre    TEXT NOT NULL DEFAULT '',
  anulada           INTEGER NOT NULL DEFAULT 0,
  fecha_anulacion   TEXT,
  motivo_anulacion  TEXT,
  fe_numero         TEXT,
  fe_cdc            TEXT,
  fe_qr             TEXT,
  fe_estado         TEXT,
  fe_respuesta      TEXT,
  fe_error          TEXT,
  fe_fecha_emision  TEXT, -- validar (confianza baja)
  fe_nc_cdc         TEXT,
  fe_nc_numero      TEXT,
  fe_nc_estado      TEXT,
  FOREIGN KEY (turno_id) REFERENCES pos_turno(id)
);
CREATE INDEX ix_pos_ventas_tenant ON pos_ventas(licencia_email);
CREATE INDEX ix_pos_ventas_turno ON pos_ventas(turno_id);

CREATE TABLE pos_turno (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_apertura        TEXT NOT NULL,
  fecha_cierre          TEXT,
  efectivo_inicial      REAL NOT NULL DEFAULT 0,
  efectivo_inicial_brl  REAL NOT NULL DEFAULT 0,
  estado                TEXT NOT NULL,
  terminal              TEXT NOT NULL,
  licencia_email        TEXT NOT NULL,
  total_contado         REAL,
  diferencia            REAL,
  total_vendido         REAL,
  total_egresos         REAL,
  cantidad_ventas       REAL,
  resumen_pagos         TEXT
);
CREATE INDEX ix_pos_turno_tenant ON pos_turno(licencia_email);

CREATE TABLE pos_salones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id  INTEGER NOT NULL REFERENCES licencias(id),
  sucursal_id  INTEGER,
  nombre       TEXT NOT NULL,
  color        TEXT,
  activo       INTEGER NOT NULL DEFAULT 1,
  orden        INTEGER
);
CREATE INDEX ix_pos_salones_tenant ON pos_salones(licencia_id);

CREATE TABLE pos_mesas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id     INTEGER NOT NULL REFERENCES pos_salones(id),
  licencia_id  INTEGER NOT NULL REFERENCES licencias(id),
  sucursal_id  INTEGER,
  nombre       TEXT NOT NULL,
  capacidad    INTEGER NOT NULL DEFAULT 4,
  activo       INTEGER NOT NULL DEFAULT 1,
  orden        INTEGER
);
CREATE INDEX ix_pos_mesas_tenant ON pos_mesas(licencia_id);
CREATE INDEX ix_pos_mesas_salon ON pos_mesas(salon_id);

CREATE TABLE sucursales (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id INTEGER NOT NULL REFERENCES licencias(id),
  nombre      TEXT NOT NULL,
  direccion   TEXT, -- validar
  activa      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT -- validar
);
CREATE INDEX ix_sucursales_tenant ON sucursales(licencia_id);

-- Fuente confiable (no borrador): supabase-migrations/pos_pedidos_setup.sql.
-- id es UUID en Postgres (gen_random_uuid()) -> TEXT en D1, generado por el Worker
-- con crypto.randomUUID() antes del INSERT (ver src/postgrestShim.js:runInsert).
CREATE TABLE pos_pedidos (
  id                TEXT PRIMARY KEY,
  licencia_email    TEXT NOT NULL,
  licencia_id       INTEGER,
  terminal_origen   TEXT NOT NULL DEFAULT 'Satelite',
  numero_orden      INTEGER,
  mesa              TEXT,
  sucursal          TEXT NOT NULL DEFAULT 'Principal',
  tipo_pedido       TEXT NOT NULL DEFAULT 'llevar',
  estado            TEXT NOT NULL DEFAULT 'abierto',
  items             TEXT NOT NULL DEFAULT '[]',
  total             REAL NOT NULL DEFAULT 0,
  descuento_ticket  REAL NOT NULL DEFAULT 0,
  mesero_id         TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_pos_pedidos_licencia_estado ON pos_pedidos(licencia_email, estado, created_at DESC);
