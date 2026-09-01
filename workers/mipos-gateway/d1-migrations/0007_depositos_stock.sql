-- Agrega `depositos` y `stock` a D1 -- primer par de tablas del back-office de
-- Inventario (ver docs faltantes en fase0-inventario.md/RUNBOOK.md). Columnas
-- confirmadas contra filas reales de Supabase (GET .../stock?select=*&limit=1
-- y .../depositos?select=*&limit=1), no inferidas del uso en JS.
--
-- Disparador: cliente real (licencia_id=6, ultima@gmail.com, rubro kiosco) ya
-- activo en Cloudflare necesita cargar el stock inicial de sus productos --
-- admin-inventario.js:renderInventarios() hace Promise.all([sucursales, depositos])
-- y sin `depositos` esa pantalla entera tiraba 501 (no solo el ajuste de cantidad).
--
-- Deliberadamente NO incluye descontar_stock_venta (rpc.js ya lo deja en 501 a
-- propósito) -- esto solo habilita ver/cargar stock manualmente desde el admin,
-- el descuento automático al vender es un problema aparte con su propia
-- necesidad de atomicidad (ver comentario en rpc.js:266).

CREATE TABLE IF NOT EXISTS depositos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id  INTEGER NOT NULL,
  sucursal_id  INTEGER,
  nombre       TEXT NOT NULL,
  es_principal INTEGER DEFAULT 0,
  activo       INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_depositos_tenant ON depositos(licencia_id);

CREATE TABLE IF NOT EXISTS stock (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id     INTEGER NOT NULL,
  deposito_id     INTEGER,
  sucursal_id     INTEGER,
  producto_id     INTEGER NOT NULL,
  nombre_producto TEXT,
  cantidad        REAL DEFAULT 0,
  cantidad_minima REAL DEFAULT 0,
  costo_unitario  REAL DEFAULT 0,
  updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_stock_tenant ON stock(licencia_id);
CREATE INDEX IF NOT EXISTS ix_stock_deposito_producto ON stock(deposito_id, producto_id);
