-- Promo por cantidad (ej. "3 unidades por Gs 10.000") -- pedido del usuario
-- 2026-08-26. promo_cant = cada cuántas unidades se arma el grupo,
-- promo_precio = precio TOTAL de ese grupo. NULL/0 en cualquiera de los dos
-- = sin promo (comportamiento actual, sin cambios). Ver lineBaseTotal() en
-- js/ventas.js para el cálculo del lado cliente.

ALTER TABLE pos_productos ADD COLUMN promo_cant INTEGER;
ALTER TABLE pos_productos ADD COLUMN promo_precio REAL;
