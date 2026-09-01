-- Ver comentario completo en
-- workers/mipos-gateway/d1-migrations/0014_gastos_eliminacion.sql -- mismo
-- fix, versión Postgres/Supabase. IF NOT EXISTS sí funciona acá (a diferencia
-- de SQLite/D1), así que este script se puede volver a correr sin romper
-- nada.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMPTZ;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(500);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS usuario_eliminacion TEXT;
