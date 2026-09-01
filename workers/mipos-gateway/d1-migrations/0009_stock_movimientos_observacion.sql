-- Faltaba `observacion` en 0008_stock_movimientos.sql -- se detecto probando
-- end-to-end el mismo payload que manda admin-inventario.js:guardarAjuste()
-- (`mov.observacion = motivo`, obligatorio en el form) contra el Worker real:
-- "columna no permitida: stock_movimientos.observacion". Confirmado contra la
-- fila real de Supabase, que si tiene esta columna (se paso por alto al
-- transcribirla a mano en 0008).

ALTER TABLE stock_movimientos ADD COLUMN observacion TEXT;
