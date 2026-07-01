-- ============================================================
-- MIGRATION_CreditoFiado_v1.sql
-- Tablas para el módulo de crédito/fiado del POS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Clientes con crédito
CREATE TABLE IF NOT EXISTS pos_cred_clientes (
  id          BIGINT       PRIMARY KEY,
  email       TEXT         NOT NULL,
  nombre      TEXT         NOT NULL,
  limite_gs   INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cred_clientes_email ON pos_cred_clientes (email);

-- Ventas fiadas (ledger de deudas)
CREATE TABLE IF NOT EXISTS pos_cred_fiado (
  id             TEXT         PRIMARY KEY,
  email          TEXT         NOT NULL,
  cliente_id     BIGINT       NOT NULL,
  cliente_nombre TEXT         NOT NULL,
  nro_ticket     INTEGER,
  total          INTEGER      NOT NULL,
  fecha          TIMESTAMPTZ  NOT NULL,
  pagado         BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_pago     TIMESTAMPTZ,
  metodo_pago    TEXT         NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cred_fiado_email       ON pos_cred_fiado (email);
CREATE INDEX IF NOT EXISTS idx_cred_fiado_cliente_id  ON pos_cred_fiado (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cred_fiado_pagado      ON pos_cred_fiado (pagado);

-- RLS: cada email solo ve sus propios registros
ALTER TABLE pos_cred_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cred_fiado    ENABLE ROW LEVEL SECURITY;

-- Políticas para anon key (el app usa la anon key con email como identificador)
-- Permite SELECT, INSERT, UPDATE por email coincidente en JWT o sin JWT (anon)
-- Nota: Si usás service_role key en el backend estas políticas no aplican.

DROP POLICY IF EXISTS "cred_clientes_own" ON pos_cred_clientes;
CREATE POLICY "cred_clientes_own" ON pos_cred_clientes
  USING      (email = current_setting('request.jwt.claims', true)::json->>'email')
  WITH CHECK (email = current_setting('request.jwt.claims', true)::json->>'email');

DROP POLICY IF EXISTS "cred_fiado_own" ON pos_cred_fiado;
CREATE POLICY "cred_fiado_own" ON pos_cred_fiado
  USING      (email = current_setting('request.jwt.claims', true)::json->>'email')
  WITH CHECK (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Si el POS usa anon key SIN autenticación JWT (patrón email en fila):
-- reemplazá las políticas de arriba por las de abajo.
-- IMPORTANTE: Elegí UNA de las dos opciones y comentá la otra.

/*
-- Opción B: sin JWT — política permisiva (anon puede leer/escribir todo)
-- Usar SOLO si el POS no implementa Supabase Auth
DROP POLICY IF EXISTS "cred_clientes_own" ON pos_cred_clientes;
CREATE POLICY "cred_clientes_anon" ON pos_cred_clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cred_fiado_own" ON pos_cred_fiado;
CREATE POLICY "cred_fiado_anon" ON pos_cred_fiado FOR ALL USING (true) WITH CHECK (true);
*/
