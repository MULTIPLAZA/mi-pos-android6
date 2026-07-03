-- ─────────────────────────────────────────────────────────────
-- mi-pos · Profesionales (rubro barbería / peluquería / estética)
--
-- Un profesional es quien atiende los turnos (barbero, estilista,
-- manicura). Estructura clonada de pos_mesas: es "un recurso con estado"
-- que ocupa columnas en la vista de agenda.
--
-- Cada agenda tiene una columna por profesional activo, ordenada por 'orden'.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_profesionales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  licencia_id    BIGINT,
  licencia_email TEXT NOT NULL,
  sucursal       TEXT,
  nombre         TEXT NOT NULL,
  color          TEXT DEFAULT '#4caf50',   -- color de la columna en la agenda
  avatar_url     TEXT,
  orden          INTEGER DEFAULT 0,
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_profesionales_email
  ON pos_profesionales (licencia_email, activo, orden);

-- Política multi-tenant. NOTA: hoy el sistema usa la anon key sin RLS real
-- (ver rls_hardening.sql). Esta policy sigue el MISMO patrón que las tablas
-- existentes para no romper el modelo actual; se endurece junto con el resto
-- cuando se aplique el hardening + auth real.
ALTER TABLE pos_profesionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_profesionales_anon_all ON pos_profesionales;
CREATE POLICY pos_profesionales_anon_all ON pos_profesionales
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
