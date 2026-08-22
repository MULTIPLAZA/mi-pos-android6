-- turno.js supaInsertVenta() (js/turno.js) manda SIEMPRE factura_numero y
-- factura_timbrado en el objeto venta (cadena vacia si la venta no tiene
-- factura, valores reales si los tiene) -- son columnas nuevas del lado
-- Supabase (ver supabase-migrations/add_factura_numero_timbrado.sql) que
-- nunca se agregaron al MVP D1 de mipos-gateway.
--
-- Efecto sin esta migracion: schema.js no tiene estas columnas en el
-- allowlist de pos_ventas, así que postgrestShim.js's runInsert() rechaza
-- CUALQUIER insert a pos_ventas que las incluya con
-- "columna no permitida: pos_ventas.factura_numero" (400) -- como el
-- objeto venta SIEMPRE las manda (con o sin factura), esto rompe el 100%
-- de las ventas para cualquier tenant Cloudflare, no solo las facturadas.
-- No detectado hasta ahora porque mipos-gateway todavia no tiene clientes
-- reales en produccion.

ALTER TABLE pos_ventas ADD COLUMN factura_numero   TEXT;
ALTER TABLE pos_ventas ADD COLUMN factura_timbrado TEXT;
