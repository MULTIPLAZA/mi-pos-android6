-- Faltaban en D1: Hospedaje (habitaciones/estadias/huespedes), Barberia/
-- Citas (citas/profesionales) y Modificadores de producto (aplican a
-- cualquier rubro, ej. "extra queso") -- confirmado por auditoria 2026-09-02
-- (docs/fase0-inventario.md ya lo habia detectado en la planificacion
-- inicial, nunca se completo). Sin esto, un tenant Cloudflare-nativo
-- (incluido cualquier cliente de Distrisoft) que elija rubro hospedaje o
-- barberia, o simplemente use modificadores de producto, se rompe con
-- "tabla no soportada en D1".
--
-- Hospedaje/Citas/Profesionales: traducidos 1:1 desde los CREATE TABLE
-- reales versionados en supabase-migrations/ (pos_habitaciones_setup.sql,
-- pos_estadias_setup.sql + sus 5 ALTER TABLE incrementales, hospedaje_huespedes.sql,
-- pos_citas_setup.sql, pos_profesionales_setup.sql) -- fuente confiable,
-- no inferida del uso en JS. UUID -> TEXT (el Worker genera con
-- crypto.randomUUID(), mismo patron que pos_pedidos/runInsert). BOOLEAN ->
-- INTEGER, TIMESTAMPTZ -> TEXT, JSONB -> TEXT, NUMERIC -> REAL.
--
-- Modificadores de producto: SIN CREATE TABLE versionado en Supabase (creadas
-- a mano en el dashboard, ver fase0-inventario.md) -- estas 3 son
-- BEST-EFFORT, inferidas de los payloads reales en js/productos.js
-- (cargarModificadores/guardarModificador/eliminarModificador). Si Supabase
-- tiene columnas extra no usadas hoy por el JS, no van a estar acá.
-- pos_modificador_opciones y pos_producto_modificadores NO tienen columna de
-- tenant propia en Supabase (confirmado por comentario explicito en
-- productos.js) -- mismo criterio en schema.js (tenant: null).

CREATE TABLE IF NOT EXISTS pos_habitaciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id    INTEGER,
  licencia_email TEXT NOT NULL,
  sucursal       TEXT,
  numero         TEXT NOT NULL,
  tipo           TEXT DEFAULT 'simple',
  piso           TEXT,
  capacidad      INTEGER DEFAULT 2,
  precio_noche   REAL DEFAULT 0,
  estado         TEXT NOT NULL DEFAULT 'libre',
  orden          INTEGER DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_habitaciones_tenant ON pos_habitaciones(licencia_email, activo, orden);

-- id: TEXT (UUID), generado server-side por el Worker (uuidPk, ver schema.js).
CREATE TABLE IF NOT EXISTS pos_estadias (
  id                    TEXT PRIMARY KEY,
  licencia_id           INTEGER,
  licencia_email        TEXT NOT NULL,
  sucursal              TEXT,
  habitacion_id         INTEGER,
  huesped_nombre        TEXT NOT NULL,
  huesped_documento     TEXT,
  huesped_tel           TEXT,
  huesped_nacionalidad  TEXT,
  cantidad_huespedes    INTEGER DEFAULT 1,
  checkin               TEXT NOT NULL,
  checkout_previsto     TEXT,
  checkout_real         TEXT,
  tarifa_noche          REAL DEFAULT 0,
  tarifa_personalizada  INTEGER DEFAULT 0,
  modalidad             TEXT DEFAULT 'noche',
  cargos                TEXT DEFAULT '[]',
  abonos                TEXT DEFAULT '[]',
  total                 REAL DEFAULT 0,
  estado                TEXT NOT NULL DEFAULT 'en_estadia',
  comprobante_venta     TEXT,
  pago_anulado          INTEGER DEFAULT 0,
  pago_anulado_fecha    TEXT,
  nota                  TEXT,
  created_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_estadias_activas ON pos_estadias(licencia_email, estado, habitacion_id);
CREATE INDEX IF NOT EXISTS ix_pos_estadias_habitacion ON pos_estadias(habitacion_id, estado);

CREATE TABLE IF NOT EXISTS pos_huespedes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_email TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  documento      TEXT,
  telefono       TEXT,
  nacionalidad   TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_huespedes_tenant ON pos_huespedes(licencia_email);
CREATE INDEX IF NOT EXISTS ix_pos_huespedes_doc ON pos_huespedes(licencia_email, documento);

-- id: TEXT (UUID), generado server-side por el Worker (uuidPk, ver schema.js).
CREATE TABLE IF NOT EXISTS pos_citas (
  id             TEXT PRIMARY KEY,
  licencia_id    INTEGER,
  licencia_email TEXT NOT NULL,
  sucursal       TEXT,
  profesional_id INTEGER,
  cliente_id     INTEGER,
  cliente_nombre TEXT,
  cliente_tel    TEXT,
  inicio         TEXT NOT NULL,
  fin            TEXT,
  duracion_min   INTEGER DEFAULT 30,
  servicios      TEXT,
  total          REAL DEFAULT 0,
  estado         TEXT NOT NULL DEFAULT 'reservado',
  venta_id       INTEGER,
  nota           TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_citas_agenda ON pos_citas(licencia_email, profesional_id, inicio);
CREATE INDEX IF NOT EXISTS ix_pos_citas_estado ON pos_citas(licencia_email, estado, inicio);

CREATE TABLE IF NOT EXISTS pos_profesionales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id    INTEGER,
  licencia_email TEXT NOT NULL,
  sucursal       TEXT,
  nombre         TEXT NOT NULL,
  color          TEXT DEFAULT '#4caf50',
  avatar_url     TEXT,
  orden          INTEGER DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_profesionales_tenant ON pos_profesionales(licencia_email, activo, orden);

-- Best-effort (sin CREATE TABLE real en Supabase, ver comentario arriba).
CREATE TABLE IF NOT EXISTS pos_modificadores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_email TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  tipo           TEXT,
  obligatorio    INTEGER DEFAULT 0,
  orden          INTEGER DEFAULT 0,
  activo         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_pos_modificadores_tenant ON pos_modificadores(licencia_email, activo, orden);

-- Sin columna de tenant propia (confirmado en productos.js) -- se protege
-- solo verificando el dueño del modificador padre desde la app.
CREATE TABLE IF NOT EXISTS pos_modificador_opciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  modificador_id  INTEGER NOT NULL,
  nombre          TEXT NOT NULL,
  precio_adicional REAL DEFAULT 0,
  orden           INTEGER DEFAULT 0,
  activo          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_pos_modificador_opciones_mod ON pos_modificador_opciones(modificador_id);

-- Sin columna de tenant propia (idem arriba). Tabla puente producto<->modificador.
CREATE TABLE IF NOT EXISTS pos_producto_modificadores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id    INTEGER NOT NULL,
  modificador_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pos_producto_modificadores_prod ON pos_producto_modificadores(producto_id);
CREATE INDEX IF NOT EXISTS ix_pos_producto_modificadores_mod ON pos_producto_modificadores(modificador_id);
