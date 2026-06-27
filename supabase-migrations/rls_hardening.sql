-- ════════════════════════════════════════════════════════════════════════
-- SEC-003 — RLS Hardening: policies que toda tabla con licencia_id necesita
-- ════════════════════════════════════════════════════════════════════════
-- LEER ANTES DE CORRER:
--   1) Antes de aplicar esto, correr rls_audit.sql y revisar el output.
--   2) Si una tabla ya tiene policies funcionando, NO les pegues encima sin
--      mirar — podés romper acceso de clientes.
--   3) Si el cliente usa anon key (no auth de Supabase) y filtra por
--      query string (?licencia_id=eq.X), las policies de abajo van a
--      bloquear todo. En ese caso este modelo es incompatible — habría
--      que migrar a Auth real con tokens por tenant.
--
-- MODELO ASUMIDO:
--   Cada licencia tiene un email_cliente. El cliente loguea con ese
--   email vía Supabase Auth. JWT lleva email. Cada tabla filtra por
--   licencia_id correspondiente al email del JWT.
--
--   Esto requiere que el cliente migre al patrón "auth.signInWithPassword"
--   en vez de usar anon key directo. Si NO está hecho, este SQL es la
--   versión "deseada" — antes de aplicarlo hay que migrar el cliente.
-- ════════════════════════════════════════════════════════════════════════

-- ── HELPER: get_my_licencia_id() ─────────────────────────────────────
-- Devuelve la licencia_id correspondiente al JWT actual (vía email).
-- Si el JWT no es de un usuario válido, devuelve NULL (las policies bloquean).
-- También permite que super_admins vean todo.
CREATE OR REPLACE FUNCTION get_my_licencia_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM licencias
   WHERE LOWER(email_cliente) = LOWER(auth.jwt() ->> 'email')
     AND activa = TRUE
   ORDER BY id ASC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_my_licencia_id() TO anon, authenticated;

-- ── TEMPLATE: aplicar a CADA tabla con columna licencia_id ────────────
-- Reemplazá <TABLA> por el nombre y ejecutalo por cada una.
-- (Lista completa abajo con todas las tablas del dominio).
--
-- ALTER TABLE <TABLA> ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS <TABLA>_tenant_select ON <TABLA>;
-- CREATE POLICY <TABLA>_tenant_select ON <TABLA>
--   FOR SELECT USING (licencia_id = get_my_licencia_id() OR is_super_admin());
--
-- DROP POLICY IF EXISTS <TABLA>_tenant_insert ON <TABLA>;
-- CREATE POLICY <TABLA>_tenant_insert ON <TABLA>
--   FOR INSERT WITH CHECK (licencia_id = get_my_licencia_id() OR is_super_admin());
--
-- DROP POLICY IF EXISTS <TABLA>_tenant_update ON <TABLA>;
-- CREATE POLICY <TABLA>_tenant_update ON <TABLA>
--   FOR UPDATE USING (licencia_id = get_my_licencia_id() OR is_super_admin());
--
-- DROP POLICY IF EXISTS <TABLA>_tenant_delete ON <TABLA>;
-- CREATE POLICY <TABLA>_tenant_delete ON <TABLA>
--   FOR DELETE USING (licencia_id = get_my_licencia_id() OR is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- APLICACIÓN A TABLAS CONCRETAS (descomentar cuando confirmes el modelo)
-- ════════════════════════════════════════════════════════════════════════

-- Tablas con columna licencia_id directa:
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'sucursales', 'depositos',
    'pos_productos', 'pos_pedidos', 'pos_ventas', 'pos_turnos',
    'stock', 'stock_comprobantes', 'stock_movimientos', 'stock_conteos',
    'gastos', 'plan_gastos_categorias', 'plan_gastos_conceptos',
    'iva_cierres', 'timbrados', 'timbrado_asignaciones',
    'modificadores', 'modificador_opciones'
  ];
  t TEXT;
BEGIN
  RAISE NOTICE 'Este bloque está COMENTADO por defecto. Para aplicar:';
  RAISE NOTICE '  1) Verificá que get_my_licencia_id() funciona bien con un user real';
  RAISE NOTICE '  2) Probá EN UNA TABLA SOLA primero (por ej. plan_gastos_categorias)';
  RAISE NOTICE '  3) Si funciona, sacá los comentarios del bloque de abajo';
  RAISE NOTICE '  4) Si no, probablemente el cliente no migró a Auth real todavía';
END $$;

-- DESCOMENTAR ABAJO PARA APLICAR (después de verificar):
/*
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'sucursales', 'depositos',
    'pos_productos', 'pos_pedidos', 'pos_ventas', 'pos_turnos',
    'stock', 'stock_comprobantes', 'stock_movimientos', 'stock_conteos',
    'gastos', 'plan_gastos_categorias', 'plan_gastos_conceptos',
    'iva_cierres', 'timbrados', 'timbrado_asignaciones',
    'modificadores', 'modificador_opciones'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- Solo si la tabla existe
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS %1$I_tenant_select ON %1$I', t);
      EXECUTE format(
        'CREATE POLICY %1$I_tenant_select ON %1$I FOR SELECT USING (licencia_id = get_my_licencia_id() OR is_super_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS %1$I_tenant_insert ON %1$I', t);
      EXECUTE format(
        'CREATE POLICY %1$I_tenant_insert ON %1$I FOR INSERT WITH CHECK (licencia_id = get_my_licencia_id() OR is_super_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS %1$I_tenant_update ON %1$I', t);
      EXECUTE format(
        'CREATE POLICY %1$I_tenant_update ON %1$I FOR UPDATE USING (licencia_id = get_my_licencia_id() OR is_super_admin()) WITH CHECK (licencia_id = get_my_licencia_id() OR is_super_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS %1$I_tenant_delete ON %1$I', t);
      EXECUTE format(
        'CREATE POLICY %1$I_tenant_delete ON %1$I FOR DELETE USING (licencia_id = get_my_licencia_id() OR is_super_admin())',
        t
      );

      RAISE NOTICE 'RLS aplicado a: %', t;
    ELSE
      RAISE NOTICE 'Saltada (no existe): %', t;
    END IF;
  END LOOP;
END $$;
*/

-- ── Tabla licencias: caso especial ────────────────────────────────────
-- Cada cliente solo puede ver su propia licencia. Super-admin ve todas.
/*
ALTER TABLE licencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS licencias_own ON licencias;
CREATE POLICY licencias_own ON licencias
  FOR SELECT
  USING (
    LOWER(email_cliente) = LOWER(auth.jwt() ->> 'email')
    OR is_super_admin()
  );

DROP POLICY IF EXISTS licencias_super_admin_all ON licencias;
CREATE POLICY licencias_super_admin_all ON licencias
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
*/

-- ── Tabla activaciones: filtra por terminal del cliente actual ────────
-- Cada licencia ve solo sus propias activaciones.
/*
ALTER TABLE activaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activaciones_tenant_select ON activaciones;
CREATE POLICY activaciones_tenant_select ON activaciones
  FOR SELECT
  USING (licencia_id = get_my_licencia_id() OR is_super_admin());

DROP POLICY IF EXISTS activaciones_tenant_insert ON activaciones;
CREATE POLICY activaciones_tenant_insert ON activaciones
  FOR INSERT
  WITH CHECK (licencia_id = get_my_licencia_id() OR is_super_admin());

DROP POLICY IF EXISTS activaciones_tenant_update ON activaciones;
CREATE POLICY activaciones_tenant_update ON activaciones
  FOR UPDATE
  USING (licencia_id = get_my_licencia_id() OR is_super_admin())
  WITH CHECK (licencia_id = get_my_licencia_id() OR is_super_admin());
*/

-- ── Tablas que joinean a través de FK indirecta ───────────────────────
-- stock_comprobante_items, stock_conteo_items, modificador_opciones —
-- no tienen licencia_id directa. Filtran a través del comprobante/conteo/modificador padre.
/*
ALTER TABLE stock_comprobante_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_comprobante_items_tenant ON stock_comprobante_items;
CREATE POLICY stock_comprobante_items_tenant ON stock_comprobante_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stock_comprobantes c
      WHERE c.id = stock_comprobante_items.comprobante_id
        AND (c.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_comprobantes c
      WHERE c.id = stock_comprobante_items.comprobante_id
        AND (c.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  );

ALTER TABLE stock_conteo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_conteo_items_tenant ON stock_conteo_items;
CREATE POLICY stock_conteo_items_tenant ON stock_conteo_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stock_conteos c
      WHERE c.id = stock_conteo_items.conteo_id
        AND (c.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_conteos c
      WHERE c.id = stock_conteo_items.conteo_id
        AND (c.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  );

ALTER TABLE modificador_opciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS modificador_opciones_tenant ON modificador_opciones;
CREATE POLICY modificador_opciones_tenant ON modificador_opciones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM modificadores m
      WHERE m.id = modificador_opciones.modificador_id
        AND (m.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM modificadores m
      WHERE m.id = modificador_opciones.modificador_id
        AND (m.licencia_id = get_my_licencia_id() OR is_super_admin())
    )
  );
*/

-- ════════════════════════════════════════════════════════════════════════
-- ROADMAP RECOMENDADO PARA APLICAR
-- ════════════════════════════════════════════════════════════════════════
-- 1) Migrar cliente mi-pos a Supabase Auth real (signInWithPassword en login)
--    en vez de usar anon key directo + filtros por email en query string.
-- 2) Validar que get_my_licencia_id() funciona con un user de prueba.
-- 3) Aplicar RLS a UNA tabla menos crítica (ej: plan_gastos_categorias) y
--    probar el flujo completo con 2 cuentas distintas.
-- 4) Si funciona, descomentar los bloques de arriba y aplicar a todas.
-- 5) Si no funciona, mantener el modelo actual y agregar validaciones
--    server-side via RPCs con SECURITY DEFINER.
-- ════════════════════════════════════════════════════════════════════════
