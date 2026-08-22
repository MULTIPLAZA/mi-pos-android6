-- ─────────────────────────────────────────────────────────────
-- mi-pos · Número de comprobante y timbrado de la factura emitida
--
-- getFacturaData() (js/cobro.js) ya calcula timbrado + nro_factura
-- ("001-001-0000123") en el momento del cobro para TODA venta
-- facturada (autoimpresor o electrónica), pero supaInsertVenta()
-- (js/turno.js) solo guardaba tiene_factura/factura_ruc/factura_nombre
-- -- el timbrado y el número de comprobante se perdían para las
-- facturas autoimpresor (las electrónicas lo recuperaban vía
-- fe_numero, pero no de forma uniforme).
--
-- Esto rompía cualquier reporte fiscal (ej: RG90/Marangatu) que
-- necesite timbrado + número de comprobante de la factura real.
-- Ver fix en js/turno.js (supaInsertVenta).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS factura_numero   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factura_timbrado TEXT DEFAULT NULL;
