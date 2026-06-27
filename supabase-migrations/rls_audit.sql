-- ════════════════════════════════════════════════════════════════════════
-- SEC-003 — Auditoría de RLS (Row-Level Security) en Supabase
-- ════════════════════════════════════════════════════════════════════════
-- SOLO LECTURA. Corré esto primero para ver el estado actual de RLS.
-- Mostrá los resultados antes de aplicar rls_hardening.sql.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) ¿Qué tablas del dominio mi-pos existen y cuáles tienen RLS habilitado?
SELECT
  t.schemaname,
  t.tablename,
  CASE WHEN t.rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS rls_estado,
  COUNT(p.policyname) AS num_policies
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'licencias', 'activaciones', 'super_admins',
    'sucursales', 'depositos',
    'pos_productos', 'pos_pedidos', 'pos_ventas', 'pos_turnos',
    'stock', 'stock_comprobantes', 'stock_comprobante_items',
    'stock_movimientos', 'stock_conteos', 'stock_conteo_items',
    'gastos', 'plan_gastos_categorias', 'plan_gastos_conceptos',
    'iva_cierres', 'timbrados', 'timbrado_asignaciones',
    'modificadores', 'modificador_opciones'
  )
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.rowsecurity DESC, t.tablename;

-- ── 2) Listado completo de policies actuales (por tabla)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd          AS comando,
  qual         AS using_expr,
  with_check   AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ── 3) Tablas SIN RLS que tienen columna `licencia_id` (probablemente deberían tener RLS)
SELECT
  t.tablename,
  '⚠️ SIN RLS pero tiene licencia_id' AS alerta
FROM pg_tables t
JOIN information_schema.columns c
  ON c.table_schema = t.schemaname AND c.table_name = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = FALSE
  AND c.column_name = 'licencia_id'
ORDER BY t.tablename;
