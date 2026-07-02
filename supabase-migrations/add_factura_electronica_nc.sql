-- ─────────────────────────────────────────────────────────────
-- mi-pos · Factura Electrónica — Nota de Crédito por anulación
--
-- Cuando una venta con documento electrónico se anula PASADAS las
-- 48 horas de la emisión, SIFEN ya no acepta el evento de
-- cancelación: corresponde emitir una Nota de Crédito electrónica
-- (tipoDocumento 5) asociada a la factura original por su CDC.
--
-- Estos campos guardan la NC emitida sobre la venta anulada:
--   fe_nc_cdc     CDC de la Nota de Crédito
--   fe_nc_numero  Número formateado de la NC: 001-001-0000001
--                 (correlativo propio, separado del de facturas,
--                  persistido en pos_config clave 'fe_nc_correlativo')
--   fe_nc_estado  Estado FacturaSend de la NC (0 Generado, 2 Aprobado,
--                 4 Rechazado...) — se actualiza con el polling
--
-- Dentro de las 48hs NO se usa NC: el evento de cancelación marca
-- fe_estado='99' en la misma fila.
--
-- USO: Panel Admin → Historial de Ventas → Anular. El sistema decide
-- solo cancelación vs NC según la antigüedad del documento.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS fe_nc_cdc    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_nc_numero TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_nc_estado TEXT DEFAULT NULL;

-- Forzar a PostgREST a recargar el schema
NOTIFY pgrst, 'reload schema';
