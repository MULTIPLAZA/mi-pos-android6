-- El form de Gastos asumía IVA 10% fijo para todo gasto "con factura" en el
-- cálculo de crédito fiscal (admin-finanzas.js), sin importar si el gasto
-- real tenía IVA 5% o era exento -- inflaba el crédito declarado (bug de
-- auditoría 2026-09-01). Columna nueva para que el dueño elija la tasa real
-- al cargar el gasto (10/5/exento, mismo vocabulario que pos_productos.iva).
--
-- SQLite no soporta "ADD COLUMN IF NOT EXISTS" -- si este script ya corrió,
-- no reintentar sin revisar antes con PRAGMA table_info(gastos).
ALTER TABLE gastos ADD COLUMN iva TEXT;
