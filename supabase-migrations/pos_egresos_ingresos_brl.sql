-- pos_egresos_ingresos_brl.sql
-- Auditoría completa tras la pérdida del efectivo inicial en R$ (Hotel Nico
-- Palace, 13-14/07/2026): se encontraron dos huecos más del mismo tipo en
-- la "caja en dos monedas".
--
-- 1) Egresos cargados en Reales (toggle R$ del modal "Registrar egreso")
--    guardaban el monto original en R$ solo en turnoData/localStorage —
--    nunca llegaba a Supabase. Se agregan las columnas para persistirlo.
--
-- 2) Los INGRESOS del turno (cobros de fiado, usados en el resumen de caja
--    en dos monedas) no tenían NINGUNA tabla en Supabase — vivían 100% en
--    localStorage. Si el dispositivo perdía el localStorage a mitad de
--    turno, esos cobros desaparecían sin dejar rastro en ningún lado.

ALTER TABLE public.pos_egresos
  ADD COLUMN IF NOT EXISTS monto_original NUMERIC,
  ADD COLUMN IF NOT EXISTS moneda_original TEXT;

CREATE TABLE IF NOT EXISTS public.pos_ingresos (
  id BIGSERIAL PRIMARY KEY,
  turno_id BIGINT,
  descripcion TEXT,
  monto NUMERIC NOT NULL DEFAULT 0,
  metodo TEXT,
  monto_original NUMERIC,
  moneda_original TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminal TEXT,
  licencia_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
