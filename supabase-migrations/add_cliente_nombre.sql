-- ─────────────────────────────────────────────────────────────
-- mi-pos · Nombre del cliente en venta (sin facturación)
--
-- Agrega columna cliente_nombre a pos_ventas. Permite identificar
-- una venta por nombre rápido (ej: "Juan", "Mesa Carlos", "Pedido López")
-- sin necesidad de cargar RUC ni emitir factura.
--
-- Se ingresa desde el ícono de persona en el header de scSale.
-- Aparece debajo del Nro Ticket en pantalla y en el ticket impreso.
-- Independiente de pos_ventas.factura_nombre (que es para SIFEN).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS cliente_nombre TEXT DEFAULT NULL;

-- Índice para búsquedas rápidas por nombre (LIKE / ilike)
CREATE INDEX IF NOT EXISTS idx_pos_ventas_cliente_nombre
  ON pos_ventas (licencia_email, cliente_nombre)
  WHERE cliente_nombre IS NOT NULL;
