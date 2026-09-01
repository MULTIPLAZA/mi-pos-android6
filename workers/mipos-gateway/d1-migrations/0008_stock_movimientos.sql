-- `stock_movimientos` -- complementa 0007_depositos_stock.sql. Sin esta tabla,
-- admin-inventario.js:guardarAjuste() (el boton real para cargar la cantidad
-- inicial de stock de un producto) hace `await supaPost('stock_movimientos', mov)`
-- ANTES de tocar `stock`, sin tolerar que falle -- con 0007 solo, el ajuste
-- entero seguia tirando error y nunca llegaba a actualizar `stock`.
-- Columnas confirmadas contra fila real de Supabase (GET .../stock_movimientos?select=*&limit=1).

CREATE TABLE IF NOT EXISTS stock_movimientos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id       INTEGER NOT NULL,
  deposito_id       INTEGER,
  sucursal_id       INTEGER,
  producto_id       INTEGER NOT NULL,
  nombre_producto   TEXT,
  tipo              TEXT NOT NULL,
  cantidad          REAL DEFAULT 0,
  cantidad_antes    REAL DEFAULT 0,
  cantidad_despues  REAL DEFAULT 0,
  referencia        TEXT,
  terminal          TEXT,
  usuario           TEXT,
  fecha             TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  comprobante_id    INTEGER
);
CREATE INDEX IF NOT EXISTS ix_stock_movimientos_tenant ON stock_movimientos(licencia_id);
CREATE INDEX IF NOT EXISTS ix_stock_movimientos_producto ON stock_movimientos(producto_id);
