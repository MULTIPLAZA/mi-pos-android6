-- Ver comentario completo en workers/mipos-gateway/d1-migrations/0016_gastos_iva.sql
-- -- mismo fix, versión Postgres/Supabase. IF NOT EXISTS sí funciona acá, se
-- puede volver a correr sin romper nada.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva VARCHAR(10);
