-- ─────────────────────────────────────────────────────────────
-- mi-pos · tipo_negocio y capacidades en licencias (super-admin)
--
-- Hoy el rubro/tipo del negocio se guarda solo en pos_config (clave
-- 'rubro_config') con un upsert best-effort que puede fallar en silencio
-- y desincronizarse. Esta columna lo hace explícito en la licencia, para
-- que el super-admin lo asigne de forma confiable y el POS lo lea directo.
--
--   tipo_negocio   'gastronomia' | 'retail' | 'despensa' | 'barberia' | ...
--   capacidades    JSONB con los flags del rubro (mesas, cocina, delivery,
--                  codigo_barras, balanza, agenda, profesionales, etc.)
--                  El POS lo lee como override sobre los defaults del tipo.
--
-- pos_config/rubro_config sigue funcionando (compatibilidad); esta columna
-- es la fuente de verdad preferente cuando está presente.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE licencias
  ADD COLUMN IF NOT EXISTS tipo_negocio TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS capacidades  JSONB DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
