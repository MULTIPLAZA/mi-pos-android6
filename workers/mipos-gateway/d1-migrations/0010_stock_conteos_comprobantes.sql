-- Completa el módulo de Inventario en D1: Conteo Físico (stock_conteos,
-- stock_conteo_items) y Compras/Comprobantes (stock_comprobantes,
-- stock_comprobante_items) -- esta última la usa TAMBIÉN
-- admin-inventario.js:cntConfirmar() para registrar el ajuste de un conteo,
-- no solo la pantalla de Compras.
--
-- Disparador: cliente real (licencia_id=6, ultima@gmail.com) entrando a
-- "Conteo Físico" desde el celular, pantalla en blanco con
-- "HTTP 501 en stock_conteos: tabla no soportada".
--
-- Columnas confirmadas contra filas reales de Supabase (GET .../tabla?select=*&limit=1),
-- no inferidas del uso en JS -- mismo método que 0007/0008.

CREATE TABLE IF NOT EXISTS stock_conteos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id   INTEGER NOT NULL,
  deposito_id   INTEGER,
  sucursal_id   INTEGER,
  numero        TEXT,
  estado        TEXT NOT NULL DEFAULT 'borrador',
  observacion   TEXT,
  usuario       TEXT,
  fecha         TEXT,
  fecha_confirm TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_stock_conteos_tenant ON stock_conteos(licencia_id);

-- licencia_id: NO existe en la tabla real de Supabase (ese lado confía en
-- filtrar siempre por conteo_id, que ya viene de un conteo padre correctamente
-- scopeado -- funciona ahí porque RLS está desactivado y nadie más puede leer
-- igual). Acá se agrega igual, D1-only, para que el Worker pueda aislar por
-- tenant de la misma forma que el resto de las tablas (se inyecta server-side
-- desde el token, nunca confiado del body -- ver postgrestShim.js runInsert).
CREATE TABLE IF NOT EXISTS stock_conteo_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id     INTEGER NOT NULL,
  conteo_id       INTEGER NOT NULL,
  producto_id     INTEGER NOT NULL,
  nombre_producto TEXT,
  stock_sistema   REAL DEFAULT 0,
  stock_fisico    REAL,
  diferencia      REAL,
  ajustado        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_stock_conteo_items_conteo ON stock_conteo_items(conteo_id);
CREATE INDEX IF NOT EXISTS ix_stock_conteo_items_tenant ON stock_conteo_items(licencia_id);

CREATE TABLE IF NOT EXISTS stock_comprobantes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id   INTEGER NOT NULL,
  deposito_id   INTEGER,
  sucursal_id   INTEGER,
  tipo          TEXT NOT NULL,
  referencia    TEXT,
  venta_id      TEXT,
  observacion   TEXT,
  terminal      TEXT,
  usuario       TEXT,
  fecha         TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  proveedor     TEXT,
  total_monto   REAL DEFAULT 0,
  metodo_pago   TEXT,
  tiene_factura INTEGER DEFAULT 0,
  factura_nro   TEXT,
  factura_ruc   TEXT
);
CREATE INDEX IF NOT EXISTS ix_stock_comprobantes_tenant ON stock_comprobantes(licencia_id);

-- licencia_id: mismo motivo que stock_conteo_items arriba (no existe en Supabase,
-- D1-only para poder aislar por tenant).
CREATE TABLE IF NOT EXISTS stock_comprobante_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id      INTEGER NOT NULL,
  comprobante_id   INTEGER NOT NULL,
  producto_id      INTEGER NOT NULL,
  nombre_producto  TEXT,
  cantidad         REAL DEFAULT 0,
  cantidad_antes   REAL DEFAULT 0,
  cantidad_despues REAL DEFAULT 0,
  costo_unitario   REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_stock_comprobante_items_comp ON stock_comprobante_items(comprobante_id);
CREATE INDEX IF NOT EXISTS ix_stock_comprobante_items_tenant ON stock_comprobante_items(licencia_id);
