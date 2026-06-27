-- ─────────────────────────────────────────────────────────────
-- mi-pos · Insumos (mercaderías que se compran pero NO se venden)
--
-- Agrega flag es_insumo a pos_productos.
--   - es_insumo = false  → producto que se vende en el POS
--   - es_insumo = true   → insumo (harina, queso, servilletas, etc.).
--                          Se compra y se controla stock,
--                          pero NUNCA aparece en la pantalla de ventas.
--
-- Convención: un insumo siempre debería tener inventario = true.
-- La maquinaria de Compras / Inventario / Movimientos / Conteo
-- ya filtra por inventario=true, así que los insumos entran solos.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_productos
  ADD COLUMN IF NOT EXISTS es_insumo BOOLEAN NOT NULL DEFAULT false;

-- Índice parcial para acelerar el listado de insumos activos por licencia
CREATE INDEX IF NOT EXISTS idx_pos_productos_es_insumo
  ON pos_productos (licencia_email, es_insumo)
  WHERE activo = true;
