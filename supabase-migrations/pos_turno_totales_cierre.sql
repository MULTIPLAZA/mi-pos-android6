-- pos_turno_totales_cierre.sql
-- El cierre de turno (confirmarCierre en app.js, y su reintento en init.js)
-- intenta guardar total_vendido, total_egresos, cantidad_ventas y
-- resumen_pagos en pos_turno, pero esas columnas nunca se crearon.
-- Esto hace que el PATCH de cierre falle SIEMPRE con 400, el turno nunca
-- termina de sincronizarse (pos_cierre_pendiente queda pegado en
-- localStorage reintentando en cada carga de la app) y el dashboard de
-- admin nunca pudo sumar bien total_vendido por turno.

ALTER TABLE public.pos_turno
  ADD COLUMN IF NOT EXISTS total_vendido   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_egresos   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_ventas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resumen_pagos   JSONB;
