-- pos_estadias_modalidad_mensual.sql
-- Soporte para huéspedes de estadía larga que pagan por mes en vez de por
-- noche (pedido real: Hotel Nico Palace). Con modalidad='mes':
--   - tarifa_noche pasa a interpretarse como la tarifa MENSUAL.
--   - hospAutoCargarNochesVencidas() salta por completo estas estadías
--     (no se les auto-cargan noches sueltas).
--   - El botón "+ NOCHE" del folio se muestra como "+ MES" y agrega un
--     cargo "Mes — Hab. X" con la tarifa pactada, sin recargo de fin de
--     semana (ese recargo es exclusivo del cobro por noche).

ALTER TABLE public.pos_estadias
  ADD COLUMN IF NOT EXISTS modalidad TEXT DEFAULT 'noche';
