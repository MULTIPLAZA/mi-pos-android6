-- ─────────────────────────────────────────────────────────────
-- mi-pos · Hospedaje: registro de huéspedes (para no volver a
-- tipear los datos de un cliente que ya se alojó antes)
--
-- Al hacer check-in, buscar por nombre o documento sugiere huéspedes
-- ya registrados y completa sus datos solo. Al confirmar un check-in,
-- el huésped se guarda (o actualiza) acá automáticamente.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_huespedes (
  id                  BIGSERIAL PRIMARY KEY,
  licencia_email      TEXT NOT NULL,
  nombre              TEXT NOT NULL,
  documento           TEXT,
  telefono            TEXT,
  nacionalidad        TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_huespedes_licencia ON pos_huespedes(licencia_email);
CREATE INDEX IF NOT EXISTS idx_pos_huespedes_documento ON pos_huespedes(licencia_email, documento);

NOTIFY pgrst, 'reload schema';
