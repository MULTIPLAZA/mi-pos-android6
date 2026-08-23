// Reimplementacion en JS/D1 de las 6 RPCs de Postgres detectadas en docs/fase0-inventario.md,
// mas actualizar_rubro (nueva, sin equivalente en Supabase - ver comentario mas abajo).
// Las 2 primeras (activar_licencia, verificar_licencia) son las criticas para el MVP -
// sin ellas ningun dispositivo nuevo puede activarse. avanzar_correlativo y
// descontar_stock_venta quedan documentadas con su contrato de entrada/salida pero
// marcadas como pendientes de completar una vez que se conozca el comportamiento exacto
// de la funcion Postgres original (no esta en el repo - hay que leerla en Supabase
// Studio > Database > Functions antes de darla por terminada, tienen que ser atomicas
// para no duplicar comprobantes / desincronizar stock).

import { ShimError } from './postgrestShim.js';
import { signToken } from './token.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias, se renueva en cada verificar_licencia

// Rate-limit de activar_licencia por IP -- ver 0004_activacion_intentos.sql para el
// motivo completo. Umbral elegido para no molestar a un usuario real que se equivoca
// tipeando la clave (hasta 8 intentos en 15 min es holgado para eso) pero corta un
// loop de brute-force automatizado desde una misma IP.
const INTENTOS_MAX = 8;
const INTENTOS_VENTANA_MIN = 15;
// Limpieza oportunista de intentos viejos -- sin esto la tabla crece sin limite.
const INTENTOS_RETENCION_HORAS = 24;

async function intentosRecientes(db, ip) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM activacion_intentos
       WHERE ip = ? AND ok = 0 AND creado_at > datetime('now', ?)`,
    )
    .bind(ip, `-${INTENTOS_VENTANA_MIN} minutes`)
    .first();
  return row ? row.n : 0;
}

async function registrarIntento(db, ip, ok) {
  await db
    .prepare('INSERT INTO activacion_intentos (ip, ok) VALUES (?, ?)')
    .bind(ip, ok ? 1 : 0)
    .run();
  // Limpieza oportunista (no bloqueante para la respuesta, D1 no tiene cron aca).
  await db
    .prepare(`DELETE FROM activacion_intentos WHERE creado_at < datetime('now', ?)`)
    .bind(`-${INTENTOS_RETENCION_HORAS} hours`)
    .run();
}

// Ningun dispositivo normal lee `licencias` directo -- el cliente (licencia.js) solo
// conoce tipo_negocio/capacidades porque viajan DENTRO de la respuesta de
// activar_licencia/verificar_licencia, que ya tienen la fila leida en memoria.
// OJO: esto NO es porque `licencias` este protegida por X-Admin-Key -- ese header
// esta en el allowlist de CORS pero NUNCA se verifica en ningun lado del codigo
// (confirmado leyendo handleRest() en index.js). `licencias` (tenant:null en
// schema.js) es una tabla sin ninguna autenticacion en el REST generico del Worker,
// decision aceptada explicitamente por el dueño (ver el comentario "RIESGO ACEPTADO"
// en index.js/handleRest) -- la mencion previa de "X-Admin-Key" en este comentario
// era incorrecta/desactualizada, no describia proteccion real.
// capacidades se guarda como TEXT (JSON) en D1 - parsear con tolerancia a datos corruptos.
function parseCapacidades(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function activarLicencia(db, secret, params, ip) {
  const { p_clave, p_email, p_device_id } = params;
  if (!p_clave || !p_email || !p_device_id) {
    throw new ShimError('activar_licencia: faltan parametros', 400);
  }
  if (ip) {
    const n = await intentosRecientes(db, ip);
    if (n >= INTENTOS_MAX) {
      return { ok: false, error: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' };
    }
  }
  const lic = await db
    .prepare('SELECT * FROM licencias WHERE clave = ? AND activa = 1')
    .bind(String(p_clave).trim().toUpperCase())
    .first();
  if (!lic) {
    if (ip) await registrarIntento(db, ip, false);
    return { ok: false, error: 'clave invalida o licencia inactiva' };
  }
  if (ip) await registrarIntento(db, ip, true);
  if (lic.fecha_vence && new Date(lic.fecha_vence) < new Date()) {
    return { ok: false, error: 'licencia vencida' };
  }

  const existing = await db
    .prepare('SELECT id FROM activaciones WHERE device_id = ?')
    .bind(p_device_id)
    .first();
  if (existing) {
    await db
      .prepare('UPDATE activaciones SET activa = 1, ultima_consulta = ? WHERE id = ?')
      .bind(new Date().toISOString(), existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO activaciones (device_id, email, licencia_id, modo, activa, fecha_activacion)
         VALUES (?, ?, ?, 'caja', 1, ?)`,
      )
      .bind(p_device_id, p_email, lic.id, new Date().toISOString())
      .run();
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken(
    { lid: lic.id, em: lic.email_cliente, be: 'cloudflare', did: p_device_id, exp },
    secret,
  );
  return {
    ok: true, token, plan: lic.plan_id, vence: lic.fecha_vence, backend: 'cloudflare',
    tipo_negocio: lic.tipo_negocio || null,
    capacidades: parseCapacidades(lic.capacidades),
  };
}

export async function verificarLicencia(db, secret, params) {
  const { p_device_id, p_email } = params;
  const act = await db
    .prepare('SELECT a.*, l.* FROM activaciones a JOIN licencias l ON l.id = a.licencia_id WHERE a.device_id = ? AND a.email = ?')
    .bind(p_device_id, p_email)
    .first();
  if (!act) return { ok: false, error: 'activacion no encontrada' };
  if (!act.activa) return { ok: false, error: 'activacion desactivada' };
  if (act.fecha_vence && new Date(act.fecha_vence) < new Date()) {
    return { ok: false, error: 'licencia vencida' };
  }
  await db
    .prepare('UPDATE activaciones SET ultima_consulta = ? WHERE device_id = ?')
    .bind(new Date().toISOString(), p_device_id)
    .run();

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken(
    { lid: act.licencia_id, em: act.email_cliente, be: 'cloudflare', did: p_device_id, exp },
    secret,
  );
  // OJO: js/licencia.js:249 chequea `data.activa===true` (no `data.ok`) - hay que
  // devolver ambos campos para que el contrato sea compatible con el cliente actual.
  return {
    ok: true, activa: true, token, plan: act.plan_id, vence: act.fecha_vence, backend: 'cloudflare',
    tipo_negocio: act.tipo_negocio || null,
    capacidades: parseCapacidades(act.capacidades),
  };
}

// Contrato confirmado 2026-08-22 contra el llamador real (js/licencia.js:956):
// supaRPC('actualizar_activacion', {p_device_id, p_email, p_negocio, p_terminal, p_sucursal}).
// El mapeo anterior (nombre_negocio/nombre_terminal/sucursal/modo -- nombres
// de COLUMNA, no de parametro) nunca coincidia con lo que manda el cliente:
// la condicion `k in params` daba siempre false, `sets` quedaba vacio, y la
// RPC devolvia {ok:true} sin actualizar nada -- fallaba en silencio para
// todo tenant Cloudflare que cambiara nombre de negocio/terminal/sucursal.
// `modo` no se manda por esta RPC (el cliente lo actualiza aparte con un
// PATCH directo a activaciones?device_id=eq...), pero se deja soportado por
// si el contrato cambia. Se scopea por tenant.did (del token verificado),
// NO por el p_device_id del body -- mismo patron que actualizarRubro con
// tenant.lid, evita que un dispositivo pueda editar la activacion de otro.
export async function actualizarActivacion(db, tenant, params) {
  const map = { p_negocio: 'nombre_negocio', p_terminal: 'nombre_terminal', p_sucursal: 'sucursal', p_modo: 'modo' };
  const sets = [];
  const binds = [];
  for (const [pKey, col] of Object.entries(map)) {
    if (params && params[pKey] !== undefined) {
      sets.push(`${col} = ?`);
      binds.push(params[pKey]);
    }
  }
  if (!sets.length) return { ok: true };
  binds.push(tenant.did);
  await db.prepare(`UPDATE activaciones SET ${sets.join(', ')} WHERE device_id = ?`).bind(...binds).run();
  return { ok: true };
}

// Contrato confirmado 2026-08-22 contra el llamador real (js/licencia.js:976):
// supaRPC('crear_sucursal', {p_licencia_id, p_nombre, p_direccion, p_deposito}),
// que espera de vuelta result.sucursal_id (y opcionalmente result.deposito_id)
// EN LA RAIZ de la respuesta -- devolverlo anidado en `sucursal` (como antes)
// hacia que `if(result.sucursal_id)` diera siempre false, y el id nuevo nunca
// se guardaba en localStorage para un tenant Cloudflare. Tambien faltaba la
// idempotencia que el comentario del cliente ya asume ("crea o reutiliza por
// nombre") -- sin buscar antes de insertar, cada llamada duplicaba la fila.
// p_deposito (nombre de deposito) queda sin usar: D1 todavia no tiene tabla
// `depositos` (ver docs/RUNBOOK.md, mismo pendiente que descontar_stock_venta) --
// no se inventa una a medias aca, se documenta la limitacion.
export async function crearSucursal(db, tenant, params) {
  const p_nombre = params && params.p_nombre;
  const p_direccion = params && params.p_direccion;
  if (!p_nombre) throw new ShimError('crear_sucursal: falta p_nombre', 400);

  // El SELECT-then-INSERT anterior tenía la misma carrera check-then-insert
  // ya documentada (y arreglada) para avanzar_correlativo: dos llamadas
  // concurrentes con el mismo p_nombre podían pasar las dos el chequeo de
  // "existente" antes de que cualquiera insertara, duplicando la fila.
  // sucursales no tiene UNIQUE(licencia_id, nombre) (ver 0001_init_mvp.sql),
  // así que no se puede usar INSERT...ON CONFLICT como en avanzar_correlativo
  // sin una migración nueva -- en cambio, INSERT...SELECT...WHERE NOT EXISTS
  // es una sola sentencia SQL atómica: D1/SQLite serializa los writes, así
  // que solo una de dos llamadas concurrentes efectivamente inserta, la otra
  // ve 0 filas afectadas y el SELECT de abajo reusa el id ya creado.
  await db
    .prepare(
      `INSERT INTO sucursales (licencia_id, nombre, direccion, activa)
       SELECT ?, ?, ?, 1
       WHERE NOT EXISTS (
         SELECT 1 FROM sucursales WHERE licencia_id = ? AND nombre = ? AND activa = 1
       )`,
    )
    .bind(tenant.lid, p_nombre, p_direccion || null, tenant.lid, p_nombre)
    .run();

  const row = await db
    .prepare('SELECT id FROM sucursales WHERE licencia_id = ? AND nombre = ? AND activa = 1')
    .bind(tenant.lid, p_nombre)
    .first();
  return { ok: true, sucursal_id: row.id };
}

// El dueño del negocio puede cambiar su propio rubro desde admin-negocio.html (Configuración),
// no solo desde el super-admin. Esa pantalla llama a rubro.js -> _rubroGuardarSupabase(), que
// para tenants Supabase escribe directo en `licencias` (RLS desactivado, ver docs internos).
// Para tenants Cloudflare esa tabla es admin-only, así que hace falta esta RPC: deja que el
// dispositivo actualice SOLO su propia fila (scoped a tenant.lid, nunca a un id del body) sin
// pedirle la ADMIN_SECRET. Sin esto, el cambio de rubro se guardaría en pos_config pero
// licencias.tipo_negocio quedaría stale, y el próximo verificar_licencia pisaría el cambio local.
export async function actualizarRubro(db, tenant, params) {
  const { tipo_negocio, capacidades } = params;
  if (!tipo_negocio) throw new ShimError('actualizar_rubro: falta tipo_negocio', 400);
  await db
    .prepare('UPDATE licencias SET tipo_negocio = ?, capacidades = ? WHERE id = ?')
    .bind(tipo_negocio, capacidades ? JSON.stringify(capacidades) : null, tenant.lid)
    .run();
  return { ok: true };
}

// Implementado 2026-08-21 -- ver d1-migrations/0003_correlativos.sql. Scopeado a
// (licencia_id, terminal), NO a timbrado_id (el MVP Cloudflare todavia no tiene
// catalogo de timbrados propio; el frontend solo manda p_terminal, ver
// js/turno.js:70). El contrato de retorno replica el de Supabase (confirmado
// empiricamente contra timbrado_terminales.nro_actual de un tenant real): el
// numero devuelto es el que va a usar la PROXIMA factura, no la que se acaba de
// emitir -- turno.js cachea `d.nro_actual` para el siguiente cobro.
//
// INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING es una sola sentencia SQL
// atomica en SQLite/D1 -- evita la carrera read-then-write que causaba
// comprobantes duplicados en el lado Supabase (ver PATCH_BackfillRG90 / bug ya
// corregido en turno.js avanzarNroFactura._chain).
export async function avanzarCorrelativo(db, tenant, params) {
  const terminal = (params && params.p_terminal) || 'Terminal 1';
  const row = await db
    .prepare(
      `INSERT INTO correlativos (licencia_id, terminal, nro_actual, updated_at)
       VALUES (?, ?, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(licencia_id, terminal) DO UPDATE SET
         nro_actual = nro_actual + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       RETURNING nro_actual`,
    )
    .bind(tenant.lid, terminal)
    .first();
  return { ok: true, nro_actual: row.nro_actual };
}

export async function descontarStockVenta(db, tenant, params) {
  // NO IMPLEMENTADO todavia - la tabla `stock` no forma parte del MVP schema
  // (0001_init_mvp.sql). Implementar junto con la migracion del modulo de stock,
  // usando db.batch() para que el descuento sea atomico por item vendido.
  throw new ShimError('descontar_stock_venta: pendiente de implementar (ver comentario en rpc.js)', 501);
}

export const RPC_HANDLERS = {
  activar_licencia: (db, secret, _tenant, params) => activarLicencia(db, secret, params),
  verificar_licencia: (db, secret, _tenant, params) => verificarLicencia(db, secret, params),
  actualizar_activacion: (db, _secret, tenant, params) => actualizarActivacion(db, tenant, params),
  crear_sucursal: (db, _secret, tenant, params) => crearSucursal(db, tenant, params),
  actualizar_rubro: (db, _secret, tenant, params) => actualizarRubro(db, tenant, params),
  avanzar_correlativo: (db, _secret, tenant, params) => avanzarCorrelativo(db, tenant, params),
  descontar_stock_venta: (db, _secret, tenant, params) => descontarStockVenta(db, tenant, params),
};
