-- Función RPC para descontar stock de forma atómica (previene race condition multi-terminal)
-- Todos los items se decrementan en una sola transacción PostgreSQL.

-- Drop de la versión anterior (firma exacta obtenida de pg_proc)
DROP FUNCTION IF EXISTS descontar_stock_venta(integer, jsonb, text, text);

CREATE FUNCTION descontar_stock_venta(
  p_deposito_id INTEGER,
  p_items       JSONB,   -- [{producto_id, cantidad, sucursal_id, licencia_id, nombre_producto}]
  p_referencia  TEXT     DEFAULT '',
  p_terminal    TEXT     DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO stock (deposito_id, sucursal_id, licencia_id, producto_id, nombre_producto, cantidad, updated_at)
    VALUES (
      p_deposito_id,
      (item->>'sucursal_id')::INTEGER,
      (item->>'licencia_id')::INTEGER,
      (item->>'producto_id')::INTEGER,
      COALESCE(item->>'nombre_producto', ''),
      -((item->>'cantidad')::NUMERIC),
      NOW()
    )
    ON CONFLICT (deposito_id, producto_id) DO UPDATE
      SET cantidad   = stock.cantidad - (item->>'cantidad')::NUMERIC,
          updated_at = NOW();
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION descontar_stock_venta(integer, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION descontar_stock_venta(integer, jsonb, text, text) TO authenticated;
