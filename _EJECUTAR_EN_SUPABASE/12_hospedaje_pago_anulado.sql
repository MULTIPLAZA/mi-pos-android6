-- ════════════════════════════════════════════════════════════
-- Marca de "pago anulado" en estadías de hospedaje
-- ════════════════════════════════════════════════════════════
-- Cuando se hace check-out de una habitación (checkOutFolio -> venta ->
-- hospedajeLiquidarEstadiaTrasVenta), la estadía queda en estado
-- 'checkout' y la habitación se libera. Si DESPUÉS se anula esa venta
-- (error de cobro, corrección, etc.), nada revertía la habitación ni
-- avisaba que esa estadía se quedó sin cobrar de verdad — quedaba como
-- un check-out normal y silencioso.
--
-- Estas dos columnas permiten marcar la estadía cuando esto pasa (ver
-- anularVentaConfirmar() en js/init.js) para que el hotel pueda
-- revisarla manualmente.

ALTER TABLE pos_estadias ADD COLUMN IF NOT EXISTS pago_anulado BOOLEAN DEFAULT false;
ALTER TABLE pos_estadias ADD COLUMN IF NOT EXISTS pago_anulado_fecha TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
