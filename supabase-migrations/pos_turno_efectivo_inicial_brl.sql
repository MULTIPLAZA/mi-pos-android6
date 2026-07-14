-- pos_turno_efectivo_inicial_brl.sql
-- El efectivo inicial declarado en Reales al abrir una caja en dos monedas
-- (_hospCkModalidad / "Caja en dos monedas") solo vivía en turnoData/
-- localStorage — nunca se guardaba en Supabase porque no existía esta
-- columna. Apenas el dispositivo recargaba la app (algo que pasa solo con
-- el tiempo, sin ningún error visible), el monto en reales se perdía y
-- quedaba en 0, aunque el monto en guaraníes sí sobrevivía (caso real:
-- Hotel Nico Palace, R$350 declarados el 13/07 aparecieron en R$0 al día
-- siguiente).

ALTER TABLE public.pos_turno
  ADD COLUMN IF NOT EXISTS efectivo_inicial_brl NUMERIC DEFAULT 0;
