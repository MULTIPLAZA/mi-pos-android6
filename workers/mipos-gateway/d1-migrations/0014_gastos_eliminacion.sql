-- gastoEliminar() (admin-finanzas.js) hacia un DELETE real sobre un gasto ya
-- registrado, sin motivo/fecha/usuario -- unico hard-delete de un registro
-- contable real en todo el sistema (ver memoria
-- project_mipos_gasto_hard_delete_sin_auditoria: ventas/turnos/fiado nunca
-- se borran, solo se marcan anulados). Mismo patron que pos_ventas
-- (anulada/fecha_anulacion/motivo_anulacion, ver pos_ventas mas arriba) --
-- + usuario_eliminacion, que pos_ventas no tiene pero un gasto (vector
-- clasico de fraude interno: cargar un gasto falso y despues borrar la
-- evidencia) amerita.
--
-- SQLite no soporta "ADD COLUMN IF NOT EXISTS" -- si este script ya corrio,
-- volver a correrlo tira "duplicate column name" (no reintentar sin revisar
-- antes con PRAGMA table_info(gastos)).
ALTER TABLE gastos ADD COLUMN eliminado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gastos ADD COLUMN fecha_eliminacion TEXT;
ALTER TABLE gastos ADD COLUMN motivo_eliminacion TEXT;
ALTER TABLE gastos ADD COLUMN usuario_eliminacion TEXT;
