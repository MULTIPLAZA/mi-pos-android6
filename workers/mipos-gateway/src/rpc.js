// Reimplementacion en JS/D1 de las 6 RPCs de Postgres detectadas en docs/fase0-inventario.md.
// Las 2 primeras (activar_licencia, verificar_licencia) son las criticas para el MVP -
// sin ellas ningun dispositivo nuevo puede activarse. Las otras 4 quedan documentadas
// con su contrato de entrada/salida pero marcadas como pendientes de completar una vez
// que se conozca el comportamiento exacto de la funcion Postgres original (no esta en
// el repo - hay que leerla en Supabase Studio > Database > Functions antes de darla
// por terminada, sobre todo avanzar_correlativo y descontar_stock_venta que necesitan
// ser atomicas para no duplicar comprobantes / desincronizar stock).

import { ShimError } from './postgrestShim.js';
import { signToken } from './token.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias, se renueva en cada verificar_licencia

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
  return { ok: true, token, plan: lic.plan_id, vence: lic.fecha_vence, backend: 'cloudflare' };
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
  return { ok: true, activa: true, token, plan: act.plan_id, vence: act.fecha_vence, backend: 'cloudflare' };
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
  avanzar_correlativo: (db, _secret, tenant, params) => avanzarCorrelativo(db, tenant, params),
  descontar_stock_venta: (db, _secret, tenant, params) => descontarStockVenta(db, tenant, params),
};
