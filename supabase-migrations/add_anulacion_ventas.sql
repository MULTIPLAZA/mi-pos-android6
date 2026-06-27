-- ─────────────────────────────────────────────────────────────
-- mi-pos · Anulación de ventas desde admin web
--
-- Agrega columnas para marcar una venta como anulada sin borrarla.
-- Permite mantener el historial, distinguir anuladas en reportes,
-- y revertir el efecto sobre P&G, IVA, ventas por producto, etc.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS anulada          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_anulacion  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT        NULL;

-- Índice parcial — la mayoría de las queries del P&G/reportes
-- filtran ventas activas (anulada=false). Acelera ese caso.
CREATE INDEX IF NOT EXISTS idx_pos_ventas_anulada
  ON pos_ventas (licencia_email, fecha)
  WHERE anulada = false;

-- Forzar a PostgREST a recargar el schema para que las nuevas
-- columnas estén disponibles inmediatamente vía la API REST.
NOTIFY pgrst, 'reload schema';
