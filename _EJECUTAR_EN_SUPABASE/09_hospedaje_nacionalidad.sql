-- ─────────────────────────────────────────────────────────────
-- mi-pos · Hospedaje: nacionalidad del huésped
--
-- Agrega el campo de nacionalidad al registro de check-in, para el
-- registro de huéspedes del hotel (habitual pedirlo a turistas
-- extranjeros).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_estadias
  ADD COLUMN IF NOT EXISTS huesped_nacionalidad TEXT;

NOTIFY pgrst, 'reload schema';
