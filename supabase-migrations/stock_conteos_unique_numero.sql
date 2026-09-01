-- Ver comentario completo en
-- workers/mipos-gateway/d1-migrations/0017_stock_conteos_unique_numero.sql
-- -- mismo fix, versión Postgres/Supabase. Si este script falla con
-- "could not create unique index" es porque YA hay duplicados reales -- en
-- ese caso hay que resolverlos a mano (renombrar uno de los dos) antes de
-- reintentar, no saltear la constraint.
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_conteos_licencia_numero ON stock_conteos(licencia_id, numero);
