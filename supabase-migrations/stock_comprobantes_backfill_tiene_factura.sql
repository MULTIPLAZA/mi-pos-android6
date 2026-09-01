-- Ver comentario completo en workers/mipos-gateway/d1-migrations/
-- 0015_stock_comprobantes_backfill_tiene_factura.sql -- mismo backfill,
-- versión Postgres/Supabase. Correr junto con el filtro nuevo por
-- tiene_factura=true en el cálculo de Liquidación de IVA (admin-finanzas.js)
-- para no dejar el histórico de compras sin crédito fiscal de golpe.
UPDATE stock_comprobantes SET tiene_factura = true
WHERE tipo = 'compra' AND (tiene_factura = false OR tiene_factura IS NULL);
