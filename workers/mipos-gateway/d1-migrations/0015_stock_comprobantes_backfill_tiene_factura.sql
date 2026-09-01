-- El checkbox "Tiene factura" recien se agrego HOY al form de Nueva Compra
-- (admin-inventario.js) -- toda compra registrada ANTES de este cambio tiene
-- tiene_factura=0 (el DEFAULT de la columna, ver 0010_stock_conteos_comprobantes.sql)
-- simplemente porque el campo nunca se mando, no porque esas compras hayan
-- sido realmente informales.
--
-- El calculo de Liquidacion de IVA (admin-finanzas.js) empieza a filtrar por
-- tiene_factura=true en este mismo commit -- sin este backfill, TODO el
-- historico de compras quedaria excluido del credito fiscal de golpe
-- (peor que el bug que se esta arreglando, que sobreestimaba el credito en
-- vez de anularlo). Se asume que toda compra pre-existente SI generaba
-- credito (mismo criterio que tenia el calculo viejo, "cualquier compra
-- genera credito") -- de aca en mas, el checkbox real decide caso por caso.
UPDATE stock_comprobantes SET tiene_factura = 1
WHERE tipo = 'compra' AND (tiene_factura = 0 OR tiene_factura IS NULL);
