-- ─────────────────────────────────────────────────────────────
-- mi-pos · Factura Electrónica (FacturaSend / SIFEN)
--
-- Agrega a pos_ventas los campos de trazabilidad del documento
-- electrónico emitido vía FacturaSend:
--
--   fe_cdc            CDC de 44 dígitos (identificador único SIFEN).
--                     Crítico: se necesita para consultar estados,
--                     cancelar (48hs) y emitir Nota de Crédito asociada.
--   fe_estado         Código de estado FacturaSend:
--                     -1 Borrador · 0 Generado · 1 Enviado en lote ·
--                      2 Aprobado · 3 Aprobado c/obs · 4 Rechazado ·
--                     99 Cancelado. NULL = venta sin FE o pendiente.
--   fe_numero         Número formateado del DE: 001-001-0000001
--   fe_qr             Link/QR devuelto por la emisión (para el ticket)
--   fe_lote_id        ID del lote de FacturaSend donde se envió
--   fe_error          Último error de emisión (si falló el lote/create)
--   fe_respuesta      Código + mensaje de SIFEN (ej: "0260 Autorización
--                     del DE satisfactoria" o el motivo de rechazo)
--   fe_fecha_emision  Cuándo se envió a FacturaSend
--
-- USO:
--   - El POS (fase 2) llena estos campos al emitir en el cobro.
--   - El Panel Admin → Factura Electrónica lista estos documentos y
--     actualiza fe_estado/fe_respuesta con el botón ACTUALIZAR ESTADOS.
--   - Las credenciales (tenant_id/api_key) NO van acá: viven en
--     pos_config con clave 'facturasend_config' (tabla ya existente).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS fe_cdc           TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_estado        TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_numero        TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_qr            TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_lote_id       TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_error         TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_respuesta     TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fe_fecha_emision TIMESTAMPTZ DEFAULT NULL;

-- Listado del panel: documentos FE de un negocio ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_pos_ventas_fe_cdc
  ON pos_ventas (licencia_email, fecha DESC)
  WHERE fe_cdc IS NOT NULL;

-- Polling de estados: encontrar rápido los pendientes (0-Generado / 1-Enviado)
CREATE INDEX IF NOT EXISTS idx_pos_ventas_fe_pendientes
  ON pos_ventas (licencia_email, fe_estado)
  WHERE fe_cdc IS NOT NULL AND fe_estado IN ('0','1');
