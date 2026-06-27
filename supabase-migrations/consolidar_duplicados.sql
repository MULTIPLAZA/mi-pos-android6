-- ════════════════════════════════════════════════════════════════════════
-- CONSOLIDAR sucursales y depósitos duplicados
-- ════════════════════════════════════════════════════════════════════════
-- Regla del canónico: id MÍNIMO del grupo (el más viejo).
-- Re-apunta todas las FK a ese id, mergea stock por (deposito_id,producto_id),
-- y borra los duplicados huérfanos.
--
-- ⚠️ HACER BACKUP ANTES. Corré `detectar_duplicados.sql` primero para ver
--    qué va a tocar. Esto va dentro de una transacción — si algo falla,
--    se revierte todo.
--
-- Para una licencia específica: cambiar el filtro `p_licencia_id` abajo.
-- Para TODAS las licencias: dejar `p_licencia_id` como NULL.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  p_licencia_id INTEGER := NULL; -- ← ponele un id para limitar; NULL = todas
  r     RECORD;
  p_rec RECORD;
  cnt   INT;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────
  -- FASE 1: SUCURSALES duplicadas (por licencia + UPPER(TRIM(nombre)))
  -- ──────────────────────────────────────────────────────────────────────
  FOR r IN
    SELECT licencia_id, UPPER(TRIM(nombre)) AS nombre_norm,
           MIN(id) AS id_canonico, array_agg(id ORDER BY id) AS todos_ids
    FROM sucursales
    WHERE (p_licencia_id IS NULL OR licencia_id = p_licencia_id)
    GROUP BY licencia_id, UPPER(TRIM(nombre))
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Sucursal lic=% nombre=% canonico=% todos=%',
      r.licencia_id, r.nombre_norm, r.id_canonico, r.todos_ids;

    UPDATE depositos          SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock              SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_comprobantes SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_movimientos  SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_conteos      SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;

    DELETE FROM sucursales
      WHERE id = ANY(r.todos_ids) AND id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % sucursales borradas', cnt;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────
  -- FASE 2: DEPÓSITOS duplicados (después de mergear sucursales)
  -- ──────────────────────────────────────────────────────────────────────
  -- Mergea stock con un loop POR PRODUCTO en lugar de CTE encadenado.
  -- Razón: PostgreSQL no garantiza orden de ejecución entre CTEs que
  -- modifican la misma tabla, y la versión anterior chocaba con la
  -- constraint UNIQUE(deposito_id,producto_id).
  -- ──────────────────────────────────────────────────────────────────────
  FOR r IN
    SELECT licencia_id, sucursal_id, UPPER(TRIM(nombre)) AS nombre_norm,
           MIN(id) AS id_canonico, array_agg(id ORDER BY id) AS todos_ids
    FROM depositos
    WHERE (p_licencia_id IS NULL OR licencia_id = p_licencia_id)
    GROUP BY licencia_id, sucursal_id, UPPER(TRIM(nombre))
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Depósito lic=% suc=% nombre=% canonico=% todos=%',
      r.licencia_id, r.sucursal_id, r.nombre_norm, r.id_canonico, r.todos_ids;

    -- Para cada producto que aparezca en los depósitos duplicados,
    -- consolidar la cantidad en el canónico.
    FOR p_rec IN
      SELECT producto_id, SUM(cantidad) AS suma_dup
      FROM stock
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico
      GROUP BY producto_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM stock
        WHERE deposito_id = r.id_canonico AND producto_id = p_rec.producto_id
      ) THEN
        UPDATE stock
          SET cantidad   = cantidad + p_rec.suma_dup,
              updated_at = NOW()
          WHERE deposito_id = r.id_canonico
            AND producto_id = p_rec.producto_id;
      ELSE
        INSERT INTO stock (licencia_id, sucursal_id, deposito_id, producto_id,
                           nombre_producto, cantidad, updated_at)
        SELECT licencia_id, sucursal_id, r.id_canonico, producto_id,
               nombre_producto, p_rec.suma_dup, NOW()
        FROM stock
        WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico
          AND producto_id = p_rec.producto_id
        LIMIT 1;
      END IF;
    END LOOP;

    -- Borrar todas las filas de stock duplicadas (ya consolidadas)
    DELETE FROM stock
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % filas de stock consolidadas', cnt;

    UPDATE stock_comprobantes SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    UPDATE stock_movimientos  SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    UPDATE stock_conteos      SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;

    DELETE FROM depositos
      WHERE id = ANY(r.todos_ids) AND id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % depósitos borrados', cnt;
  END LOOP;

  RAISE NOTICE '✓ Consolidación terminada';
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- Después de correr esto, los duplicados ya no aparecen en los dropdowns
-- y todos los movimientos quedan apuntando al depósito canónico.
-- ──────────────────────────────────────────────────────────────────────
