-- FIX URGENTE 21/09/2026 -- reportado por Lo De Fernandez via WhatsApp:
-- "Balance P&G" y "Gastos Fijos > Nuevo gasto" tiraban error porque la
-- tabla gastos de Supabase nunca recibio estas dos migraciones, aunque
-- el codigo (admin-finanzas.js) las usa desde el commit del 01/09/2026:
--   - Error en Balance P&G: column gastos.eliminado does not exist
--   - Error al guardar gasto: Could not find the 'iva' column of 'gastos'
-- Idempotente (IF NOT EXISTS), se puede volver a correr sin romper nada.
-- Ver supabase-migrations/gastos_iva.sql y gastos_eliminacion.sql (mismo
-- contenido, quedaron ahi sin pasar a la cola _EJECUTAR_EN_SUPABASE).

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva VARCHAR(10);

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMPTZ;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(500);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS usuario_eliminacion TEXT;
