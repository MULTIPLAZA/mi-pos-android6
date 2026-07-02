-- ─────────────────────────────────────────────────────────────
-- mi-pos · Idempotencia de ventas (anti-duplicado en la nube)
--
-- CONTEXTO: las ventas offline se envían a Supabase por dos caminos
-- (syncConSupabase y syncVentasPendientes). Con los fixes de v1.15.26
-- ya NO corren en paralelo, lo que cierra el caso común de duplicado.
-- Queda un caso raro: si el POST a Supabase tiene éxito pero la app se
-- cierra ANTES de marcar la venta como sincronizada, el próximo ciclo
-- la reenvía → duplicado.
--
-- Esta migración lo cierra del todo con una clave única por venta,
-- generada en el cliente. Un reenvío de la misma venta choca contra el
-- índice único y se descarta (merge-duplicates), en vez de duplicar.
--
-- ORDEN DE APLICACIÓN (importante en producción):
--   1. Ejecutar esta migración PRIMERO (agrega la columna, nullable).
--   2. Recién después desplegar el código que setea venta_uuid y usa
--      on_conflict=venta_uuid. Si se despliega el código antes de la
--      columna, PostgREST rechaza el insert ("column does not exist").
--
-- Las ventas viejas (sin uuid) quedan con NULL — el índice único es
-- parcial (WHERE venta_uuid IS NOT NULL), así que no las afecta.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS venta_uuid TEXT DEFAULT NULL;

-- Índice único parcial: dos ventas no pueden compartir uuid, pero las
-- filas viejas con NULL conviven sin problema.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_ventas_venta_uuid
  ON pos_ventas (venta_uuid)
  WHERE venta_uuid IS NOT NULL;

-- Forzar recarga del schema en PostgREST
NOTIFY pgrst, 'reload schema';
