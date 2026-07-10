-- pos_estadias_tarifa_personalizada.sql
-- Si el recepcionista pacta una tarifa distinta a la normal de la
-- habitación al hacer el check-in (ej. un precio especial en Reales para
-- un huésped), esa tarifa tiene que valer para TODA la estadía. Sin esta
-- columna, agregar una noche (o el cobro automático de noches vencidas)
-- en un día viernes/sábado pisaba la tarifa pactada con el recargo de fin
-- de semana de la habitación sin que nadie se diera cuenta (caso real:
-- Hotel Nico Palace, huésped a R$350/noche, la 2da noche saltó al precio
-- de finde de la habitación).

ALTER TABLE public.pos_estadias
  ADD COLUMN IF NOT EXISTS tarifa_personalizada BOOLEAN DEFAULT false;
