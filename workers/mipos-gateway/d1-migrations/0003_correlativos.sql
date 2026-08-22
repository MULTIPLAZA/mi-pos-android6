-- avanzar_correlativo (src/rpc.js) tiraba 501 a proposito porque no habia tabla
-- para guardar el contador de numero de comprobante -- bloqueaba el piloto de
-- cualquier cliente Cloudflare que facture (ver docs/RUNBOOK.md "Pendiente
-- conocido"). El MVP D1 todavia no tiene catalogo de timbrados (0001_init_mvp.sql
-- no lo incluyo), asi que el contador queda scopeado a (licencia_id, terminal) --
-- mismo scope que recibe la RPC desde el cliente (js/turno.js:70 solo manda
-- p_terminal, no punto_exp). Si mas adelante se agrega un catalogo de timbrados
-- real para Cloudflare, migrar este contador a scopearlo tambien por timbrado_id.
--
-- UNIQUE(licencia_id, terminal) es lo que permite el INSERT ... ON CONFLICT
-- atomico de abajo (una sola sentencia SQL, sin read-then-write en JS).

CREATE TABLE correlativos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  licencia_id INTEGER NOT NULL REFERENCES licencias(id),
  terminal    TEXT NOT NULL,
  nro_actual  INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(licencia_id, terminal)
);
