-- ════════════════════════════════════════════════════════════════════════
-- RPC crear_sucursal — versión IDEMPOTENTE
-- ════════════════════════════════════════════════════════════════════════
-- Antes: cada llamada creaba un registro nuevo aunque ya existiera el
--   mismo nombre+licencia → terminales múltiples generaban duplicados.
-- Ahora: busca por UPPER(TRIM(nombre)) + licencia_id ANTES de insertar.
--   Si ya existe, reutiliza. Devuelve siempre {sucursal_id, deposito_id}.
--
-- Invocado desde: js/licencia.js:814 →
--   supaRPC('crear_sucursal', {
--     p_licencia_id, p_nombre, p_direccion, p_deposito
--   })
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS crear_sucursal(integer, text, text, text);

CREATE FUNCTION crear_sucursal(
  p_licencia_id INTEGER,
  p_nombre      TEXT,
  p_direccion   TEXT DEFAULT '',
  p_deposito    TEXT DEFAULT 'Depósito Principal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nombre_suc TEXT := TRIM(p_nombre);
  v_nombre_dep TEXT := TRIM(COALESCE(p_deposito, 'Depósito Principal'));
  v_suc_id     INTEGER;
  v_dep_id     INTEGER;
BEGIN
  IF v_nombre_suc = '' THEN
    RAISE EXCEPTION 'El nombre de la sucursal no puede estar vacío';
  END IF;
  IF v_nombre_dep = '' THEN
    v_nombre_dep := 'Depósito Principal';
  END IF;

  -- ── Sucursal: buscar antes de crear ────────────────────────────────
  SELECT id INTO v_suc_id
    FROM sucursales
   WHERE licencia_id = p_licencia_id
     AND UPPER(TRIM(nombre)) = UPPER(v_nombre_suc)
   ORDER BY id ASC
   LIMIT 1;

  IF v_suc_id IS NULL THEN
    INSERT INTO sucursales (licencia_id, nombre, direccion, activa)
      VALUES (p_licencia_id, v_nombre_suc, COALESCE(p_direccion, ''), TRUE)
      RETURNING id INTO v_suc_id;
  ELSE
    -- Reactivar si estaba apagada (caso: cliente la había desactivado y la vuelve a usar)
    UPDATE sucursales SET activa = TRUE
      WHERE id = v_suc_id AND activa = FALSE;
  END IF;

  -- ── Depósito: buscar antes de crear (scope: licencia + sucursal) ──
  SELECT id INTO v_dep_id
    FROM depositos
   WHERE licencia_id = p_licencia_id
     AND sucursal_id = v_suc_id
     AND UPPER(TRIM(nombre)) = UPPER(v_nombre_dep)
   ORDER BY id ASC
   LIMIT 1;

  IF v_dep_id IS NULL THEN
    INSERT INTO depositos (licencia_id, sucursal_id, nombre, activo)
      VALUES (p_licencia_id, v_suc_id, v_nombre_dep, TRUE)
      RETURNING id INTO v_dep_id;
  ELSE
    UPDATE depositos SET activo = TRUE
      WHERE id = v_dep_id AND activo = FALSE;
  END IF;

  RETURN jsonb_build_object(
    'sucursal_id', v_suc_id,
    'deposito_id', v_dep_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_sucursal(integer, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION crear_sucursal(integer, text, text, text) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- OPCIONAL: índice único parcial para BLINDAR contra duplicados
-- desde la base, no solo desde la función. Comentado por si rompe
-- algún flujo legacy — activarlo después de correr la consolidación.
-- ──────────────────────────────────────────────────────────────────────
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_sucursal_lic_nombre
--   ON sucursales (licencia_id, UPPER(TRIM(nombre)));
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposito_lic_suc_nombre
--   ON depositos  (licencia_id, sucursal_id, UPPER(TRIM(nombre)));
