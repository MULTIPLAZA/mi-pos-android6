-- Promo por cantidad (ej. "3 unidades por Gs 10.000") -- pedido del usuario
-- 2026-08-26. promo_cant = cada cuántas unidades se arma el grupo,
-- promo_precio = precio TOTAL de ese grupo. NULL/0 en cualquiera de los dos
-- = sin promo (comportamiento actual, sin cambios). Ver lineBaseTotal() en
-- js/ventas.js para el cálculo del lado cliente.
--
-- Correr a mano en el SQL Editor de Supabase (no hay acceso DDL directo
-- desde este entorno, solo REST con anon key). Ya aplicado el equivalente
-- en D1 (workers/mipos-gateway/d1-migrations/0012_pos_productos_promo.sql)
-- para los tenants Cloudflare-nativos.

ALTER TABLE pos_productos ADD COLUMN IF NOT EXISTS promo_cant INTEGER;
ALTER TABLE pos_productos ADD COLUMN IF NOT EXISTS promo_precio NUMERIC;
