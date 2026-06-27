-- Setup / actualización tabla pos_pedidos para modo satélite
-- Seguro ejecutar aunque la tabla ya exista (usa IF NOT EXISTS / IF NOT EXISTS)

-- 1) Crear tabla si no existe
CREATE TABLE IF NOT EXISTS pos_pedidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licencia_email  TEXT NOT NULL,
  licencia_id     INTEGER,
  terminal_origen TEXT NOT NULL DEFAULT 'Satelite',
  numero_orden    INTEGER,
  mesa            TEXT,
  sucursal        TEXT NOT NULL DEFAULT 'Principal',
  tipo_pedido     TEXT NOT NULL DEFAULT 'llevar',
  estado          TEXT NOT NULL DEFAULT 'abierto',
  items           JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC(15,0) NOT NULL DEFAULT 0,
  descuento_ticket NUMERIC(15,0) NOT NULL DEFAULT 0,
  mesero_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Agregar columnas faltantes si la tabla ya existía sin ellas
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS sucursal         TEXT NOT NULL DEFAULT 'Principal';
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS licencia_id      INTEGER;
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS terminal_origen  TEXT NOT NULL DEFAULT 'Satelite';
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS numero_orden     INTEGER;
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS mesa             TEXT;
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS tipo_pedido      TEXT NOT NULL DEFAULT 'llevar';
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS descuento_ticket NUMERIC(15,0) NOT NULL DEFAULT 0;
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS mesero_id        TEXT;
ALTER TABLE pos_pedidos ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_pos_pedidos_licencia_estado
  ON pos_pedidos (licencia_email, estado, created_at DESC);

-- 4) RLS
ALTER TABLE pos_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_pedidos_anon_all" ON pos_pedidos;
CREATE POLICY "pos_pedidos_anon_all"
  ON pos_pedidos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON pos_pedidos TO anon;
GRANT ALL ON pos_pedidos TO authenticated;
