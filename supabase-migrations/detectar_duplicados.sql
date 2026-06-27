-- ════════════════════════════════════════════════════════════════════════
-- DETECCIÓN de sucursales y depósitos duplicados por licencia
-- ════════════════════════════════════════════════════════════════════════
-- SOLO LECTURA. Corré esto primero para ver qué hay antes de consolidar.
-- Cambiá el WHERE de :licId si querés filtrar por una licencia específica.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. SUCURSALES duplicadas (por licencia + nombre normalizado) ─────
SELECT
  licencia_id,
  UPPER(TRIM(nombre))            AS nombre_norm,
  COUNT(*)                       AS cant,
  array_agg(id ORDER BY id)      AS ids,
  array_agg(nombre ORDER BY id)  AS nombres,
  MIN(id)                        AS id_canonico,
  COUNT(*) FILTER (WHERE activa) AS activas
FROM sucursales
GROUP BY licencia_id, UPPER(TRIM(nombre))
HAVING COUNT(*) > 1
ORDER BY licencia_id, nombre_norm;

-- ── 2. DEPÓSITOS duplicados (por licencia + sucursal + nombre normalizado) ─
SELECT
  d.licencia_id,
  d.sucursal_id,
  s.nombre                       AS sucursal,
  UPPER(TRIM(d.nombre))          AS nombre_norm,
  COUNT(*)                       AS cant,
  array_agg(d.id ORDER BY d.id)  AS ids,
  array_agg(d.nombre ORDER BY d.id) AS nombres,
  MIN(d.id)                      AS id_canonico,
  COUNT(*) FILTER (WHERE d.activo) AS activos
FROM depositos d
LEFT JOIN sucursales s ON s.id = d.sucursal_id
GROUP BY d.licencia_id, d.sucursal_id, s.nombre, UPPER(TRIM(d.nombre))
HAVING COUNT(*) > 1
ORDER BY d.licencia_id, s.nombre, nombre_norm;

-- ── 3. Movimientos por depósito duplicado (para ver qué impacto tiene) ──
WITH dups AS (
  SELECT d.id, d.licencia_id, d.sucursal_id, d.nombre,
         UPPER(TRIM(d.nombre)) AS nombre_norm,
         MIN(d.id) OVER (PARTITION BY d.licencia_id, d.sucursal_id, UPPER(TRIM(d.nombre))) AS id_canonico,
         COUNT(*) OVER (PARTITION BY d.licencia_id, d.sucursal_id, UPPER(TRIM(d.nombre))) AS cant
  FROM depositos d
)
SELECT
  dups.licencia_id,
  dups.nombre              AS deposito,
  dups.id                  AS deposito_id,
  dups.id_canonico,
  (SELECT COUNT(*) FROM stock              WHERE deposito_id = dups.id) AS rows_stock,
  (SELECT COUNT(*) FROM stock_comprobantes WHERE deposito_id = dups.id) AS rows_comprob,
  (SELECT COUNT(*) FROM stock_movimientos  WHERE deposito_id = dups.id) AS rows_mov,
  (SELECT COUNT(*) FROM stock_conteos      WHERE deposito_id = dups.id) AS rows_conteos
FROM dups
WHERE dups.cant > 1
ORDER BY dups.licencia_id, dups.nombre_norm, dups.id;
