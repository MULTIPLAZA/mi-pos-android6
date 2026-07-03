-- ─────────────────────────────────────────────────────────────
-- mi-pos · Servicios (rubro barbería / peluquería / estética)
--
-- Un "servicio" (corte, barba, tintura, manicura) es un producto con
-- es_servicio=true: tiene precio y duración, pero no maneja stock.
-- Reusa toda la infraestructura de productos (cobro, factura electrónica,
-- reportes) sin tablas nuevas — mismo patrón que add_es_insumo.sql.
--
--   es_servicio   true  = es un servicio agendable (no descuenta stock)
--   duracion_min  duración estándar en minutos (para calcular el fin del turno)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_productos
  ADD COLUMN IF NOT EXISTS es_servicio  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duracion_min INTEGER DEFAULT 30;

NOTIFY pgrst, 'reload schema';
