-- Faltaban del MVP inicial (ver docs/RUNBOOK.md "Pendiente conocido" y
-- docs/fase0-inventario.md) - confirmado en produccion 2026-08-11: egresos e
-- ingresos del turno no sincronizaban para tenants Cloudflare porque el Worker
-- respondia 501 "tabla no soportada" (pos_egresos/pos_ingresos no existian en D1).
-- Columnas inferidas del codigo cliente (js/sync.js:dbSaveEgreso/dbSaveIngreso,
-- js/credito.js), NO confirmadas contra information_schema real de Supabase como
-- las 11 tablas del MVP original - si difieren, ajustar con una migracion nueva.

CREATE TABLE pos_egresos (
  id              INTEGER PRIMARY KEY,
  turno_id        INTEGER,
  descripcion     TEXT,
  monto           REAL DEFAULT 0,
  monto_original  REAL,
  moneda_original TEXT,
  fecha           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  terminal        TEXT,
  licencia_email  TEXT
);
CREATE INDEX ix_pos_egresos_tenant ON pos_egresos(licencia_email);

CREATE TABLE pos_ingresos (
  id              INTEGER PRIMARY KEY,
  turno_id        INTEGER,
  descripcion     TEXT,
  monto           REAL DEFAULT 0,
  metodo          TEXT,
  monto_original  REAL,
  moneda_original TEXT,
  fecha           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  terminal        TEXT,
  licencia_email  TEXT
);
CREATE INDEX ix_pos_ingresos_tenant ON pos_ingresos(licencia_email);

-- Sistema de fiado/credito (js/credito.js) - mismo hueco, mismo motivo.
-- OJO: estas dos usan `email` como columna de tenant, no `licencia_email` (asi
-- las llama el codigo cliente, ver _credSupaUpsertCliente/_credSupaUpsertFiado).
CREATE TABLE pos_cred_clientes (
  id        INTEGER PRIMARY KEY,
  email     TEXT NOT NULL,
  nombre    TEXT,
  limite_gs REAL DEFAULT 0
);
CREATE INDEX ix_pos_cred_clientes_tenant ON pos_cred_clientes(email);

CREATE TABLE pos_cred_fiado (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL,
  cliente_id     INTEGER,
  cliente_nombre TEXT,
  nro_ticket     TEXT,
  total          REAL DEFAULT 0,
  fecha          TEXT,
  pagado         INTEGER DEFAULT 0,
  fecha_pago     TEXT,
  metodo_pago    TEXT
);
CREATE INDEX ix_pos_cred_fiado_tenant ON pos_cred_fiado(email);
