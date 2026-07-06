-- ─────────────────────────────────────────────────────────────
-- mi-pos · Hospedaje: abonos / pagos parciales durante la estadía
--
-- Muchos huéspedes van pagando día a día en vez de todo junto al
-- check-out (ej: 3 noches, pagan 1 por día). Agrega el registro de
-- esos pagos parciales a la estadía — el check-out final solo cobra
-- el saldo pendiente (total - suma de abonos), no el total de nuevo.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_estadias
  ADD COLUMN IF NOT EXISTS abonos JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
