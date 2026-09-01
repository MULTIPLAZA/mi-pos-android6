-- RPCs atómicas para Compras/Entradas de stock (admin-inventario.js:movGuardar/
-- movEjecutarAnulacion) -- simétricas a descontar_stock_venta/revertir_stock_venta
-- (stock_atomic_increment.sql/decrement.sql), que ya cubren Ventas pero no Compras.
--
-- Bug real detectado en auditoría 2026-09-01: procesarLado() y
-- movEjecutarAnulacion() hacían lectura de `stock` con un SELECT, calculaban
-- cantidad/costo promedio ponderado en JS, y recién después escribían con un
-- POST/PATCH aparte -- dos compras (o una compra y su anulación) simultáneas
-- del mismo producto podían pisarse el resultado (lost update). Con estas
-- funciones, todo el ciclo lectura+cálculo+escritura ocurre dentro de una
-- sola sentencia UPDATE/INSERT..ON CONFLICT, protegido por el locking de fila
-- de PostgreSQL -- ninguna otra transacción puede leer un valor a mitad de
-- camino.
--
-- licencia_email se pasa explícito por item (no hay JWT/tenant server-side
-- acá, mismo modelo que el resto de las funciones de este archivo -- RLS
-- está desactivado en Supabase, ver memoria del proyecto).

-- ── ajustar_stock_compra: alta de Compra/Entrada/Salida/Transferencia ──────
DROP FUNCTION IF EXISTS ajustar_stock_compra(integer, jsonb, boolean, text, text);

CREATE FUNCTION ajustar_stock_compra(
  p_deposito_id INTEGER,
  p_items       JSONB,    -- [{producto_id, cantidad (delta con signo), costo (opcional, costo unitario de ESTE movimiento), sucursal_id, licencia_id, nombre_producto, licencia_email}]
  p_actualizar_costo_producto BOOLEAN DEFAULT false,  -- true solo para tipo='compra' (entrada/salida/transferencia no tocan pos_productos.costo)
  p_referencia  TEXT      DEFAULT '',
  p_terminal    TEXT      DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  v_prod_id     INTEGER;
  v_cant        NUMERIC;
  v_costo       NUMERIC;
  v_lic_email   TEXT;
  v_costo_final NUMERIC;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id   := (item->>'producto_id')::INTEGER;
    v_cant      := COALESCE((item->>'cantidad')::NUMERIC, 0);
    v_costo     := COALESCE((item->>'costo')::NUMERIC, 0);
    v_lic_email := item->>'licencia_email';

    -- COSTO PROMEDIO PONDERADO calculado DENTRO del INSERT..ON CONFLICT:
    -- `stock.cantidad`/`stock.costo_unitario` en el DO UPDATE se resuelven
    -- contra la fila YA BLOQUEADA por esta sentencia -- es la misma garantía
    -- de atomicidad que usan descontar_stock_venta/revertir_stock_venta,
    -- solo que acá con una fórmula en vez de una simple suma/resta.
    INSERT INTO stock (deposito_id, sucursal_id, licencia_id, producto_id, nombre_producto, cantidad, costo_unitario, updated_at)
    VALUES (
      p_deposito_id,
      (item->>'sucursal_id')::INTEGER,
      (item->>'licencia_id')::INTEGER,
      v_prod_id,
      COALESCE(item->>'nombre_producto', ''),
      v_cant,
      CASE WHEN v_cant > 0 AND v_costo > 0 THEN v_costo ELSE 0 END,
      NOW()
    )
    ON CONFLICT (deposito_id, producto_id) DO UPDATE SET
      costo_unitario = CASE
        WHEN v_cant > 0 AND v_costo > 0 THEN
          CASE WHEN stock.cantidad > 0 AND stock.costo_unitario > 0
            THEN ROUND((stock.cantidad * stock.costo_unitario + v_cant * v_costo) / (stock.cantidad + v_cant))
            ELSE v_costo
          END
        ELSE stock.costo_unitario
      END,
      cantidad        = stock.cantidad + v_cant,
      nombre_producto = EXCLUDED.nombre_producto,
      updated_at      = NOW()
    RETURNING costo_unitario INTO v_costo_final;

    IF p_actualizar_costo_producto AND v_costo > 0 AND v_lic_email IS NOT NULL THEN
      UPDATE pos_productos SET costo = v_costo_final, updated_at = NOW()
      WHERE id = v_prod_id AND licencia_email ILIKE v_lic_email;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION ajustar_stock_compra(integer, jsonb, boolean, text, text) TO anon;
GRANT EXECUTE ON FUNCTION ajustar_stock_compra(integer, jsonb, boolean, text, text) TO authenticated;

-- ── revertir_stock_compra: anulación de Compra/Entrada/Salida/Transferencia ─
DROP FUNCTION IF EXISTS revertir_stock_compra(integer, jsonb, text, text);

CREATE FUNCTION revertir_stock_compra(
  p_deposito_id INTEGER,
  p_items       JSONB,    -- [{producto_id, cantidad (cantidad original del movimiento, positiva), costo_unitario (costo de ESE movimiento), cantidad_antes (stock antes de ese movimiento), es_compra (bool), sucursal_id, licencia_id, nombre_producto, licencia_email}]
  p_referencia  TEXT      DEFAULT '',
  p_terminal    TEXT      DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item             JSONB;
  v_prod_id        INTEGER;
  v_cant           NUMERIC;
  v_costo_orig     NUMERIC;
  v_cant_antes     NUMERIC;
  v_es_compra      BOOLEAN;
  v_lic_email      TEXT;
  v_costo_rev      NUMERIC;
  v_puede_revertir BOOLEAN;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id    := (item->>'producto_id')::INTEGER;
    v_cant       := COALESCE((item->>'cantidad')::NUMERIC, 0);
    v_costo_orig := COALESCE((item->>'costo_unitario')::NUMERIC, 0);
    v_cant_antes := COALESCE((item->>'cantidad_antes')::NUMERIC, 0);
    v_es_compra  := COALESCE((item->>'es_compra')::BOOLEAN, false);
    v_lic_email  := item->>'licencia_email';
    -- Solo se puede recalcular el "costo antes" con exactitud si había stock
    -- previo al movimiento original -- si no, no hay valor recuperable y se
    -- deja el costo actual como está (mismo criterio que el fallback JS que
    -- reemplaza esta función).
    v_puede_revertir := (v_costo_orig > 0 AND v_cant_antes > 0 AND v_cant > 0);

    UPDATE stock SET
      -- `costo_unitario`/`cantidad` del lado derecho, sin calificar, se
      -- resuelven contra la fila ya bloqueada por este UPDATE (valor previo
      -- a esta escritura) -- mismo mecanismo de atomicidad que arriba.
      costo_unitario = CASE WHEN v_puede_revertir
        THEN GREATEST(0, ROUND((costo_unitario * (v_cant_antes + v_cant) - v_cant * v_costo_orig) / v_cant_antes))
        ELSE costo_unitario
      END,
      cantidad   = cantidad - v_cant,
      updated_at = NOW()
    WHERE deposito_id = p_deposito_id AND producto_id = v_prod_id
    RETURNING costo_unitario INTO v_costo_rev;

    IF v_puede_revertir AND v_es_compra AND v_lic_email IS NOT NULL THEN
      UPDATE pos_productos SET costo = v_costo_rev, updated_at = NOW()
      WHERE id = v_prod_id AND licencia_email ILIKE v_lic_email;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION revertir_stock_compra(integer, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION revertir_stock_compra(integer, jsonb, text, text) TO authenticated;
