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

// `licencias` es admin-only (ver index.js: requiere X-Admin-Key) - ningun dispositivo
// puede leerla directo. tipo_negocio/capacidades viajan entonces DENTRO de la respuesta
// de activar_licencia/verificar_licencia, que ya tienen la fila leida en memoria.
// capacidades se guarda como TEXT (JSON) en D1 - parsear con tolerancia a datos corruptos.
function parseCapacidades(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function activarLicencia(db, secret, params) {
  const { p_clave, p_email, p_device_id } = params;
  if (!p_clave || !p_email || !p_device_id) {
    throw new ShimError('activar_licencia: faltan parametros', 400);
  }
  const lic = await db
    .prepare('SELECT * FROM licencias WHERE clave = ? AND activa = 1')
    .bind(String(p_clave).trim().toUpperCase())
    .first();
  if (!lic) return { ok: false, error: 'clave invalida o licencia inactiva' };
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

export async function actualizarActivacion(db, tenant, params) {
  // TODO: confirmar contrato exacto contra la funcion Postgres original antes de produccion.
  const allowed = ['nombre_negocio', 'nombre_terminal', 'sucursal', 'modo'];
  const sets = [];
  const binds = [];
  for (const k of allowed) {
    if (k in params) {
      sets.push(`${k} = ?`);
      binds.push(params[k]);
    }
  }
  if (!sets.length) return { ok: true };
  binds.push(tenant.did);
  await db.prepare(`UPDATE activaciones SET ${sets.join(', ')} WHERE device_id = ?`).bind(...binds).run();
  return { ok: true };
}

export async function crearSucursal(db, tenant, params) {
  // TODO: confirmar contrato exacto (p_direccion no esta confirmado como columna real).
  const { p_nombre, p_direccion } = params;
  if (!p_nombre) throw new ShimError('crear_sucursal: falta p_nombre', 400);
  const { results } = await db
    .prepare('INSERT INTO sucursales (licencia_id, nombre, direccion, activa) VALUES (?, ?, ?, 1) RETURNING *')
    .bind(tenant.lid, p_nombre, p_direccion || null)
    .all();
  return { ok: true, sucursal: results[0] };
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

export async function avanzarCorrelativo(db, tenant, params) {
  // NO IMPLEMENTADO todavia - necesita leerse la funcion Postgres original para saber
  // en que tabla/columna vive el correlativo (no hay tabla de correlativos en el MVP
  // schema). db.batch() es la herramienta a usar aca para que el read-increment-write
  // sea atomico y no se dupliquen numeros de comprobante entre terminales concurrentes.
  throw new ShimError('avanzar_correlativo: pendiente de implementar (ver comentario en rpc.js)', 501);
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
