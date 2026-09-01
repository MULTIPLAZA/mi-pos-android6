// Traduce el subset de sintaxis PostgREST realmente usado por el POS (ver
// docs/fase0-inventario.md: eq./ilike./in./gte./lte./is./lt./like., select=, order=,
// limit=, on_conflict=, header Prefer) a SQL parametrizado contra D1.
//
// Reglas de seguridad (no negociables, ver docs/fase0-inventario.md):
//  1. Todo nombre de columna se valida contra el allowlist de schema.js antes de
//     interpolarlo en el SQL. Nunca se interpola un nombre que no este en la lista.
//  2. La columna de tenant (licencia_email o licencia_id segun la tabla) se inyecta
//     SIEMPRE desde el token validado - cualquier valor de esa columna que venga en
//     el filtro del cliente o en el body de un INSERT/UPDATE se descarta.

import { TABLES } from './schema.js';

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);

const OP_SQL = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'LIKE', // SQLite LIKE ya es case-insensitive para ASCII por defecto
};

class ShimError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertColumn(tableDef, table, col) {
  if (!tableDef.columns.includes(col)) {
    throw new ShimError(`columna no permitida: ${table}.${col}`, 400);
  }
}

function toSqliteValue(tableDef, col, value) {
  if (tableDef.booleans.includes(col)) {
    if (value === true || value === 1 || value === '1' || value === 'true') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  }
  return value;
}

function fromSqliteRow(tableDef, row) {
  const out = { ...row };
  for (const col of tableDef.booleans) {
    if (col in out && out[col] !== null) out[col] = !!out[col];
  }
  return out;
}

// Parsea un valor de filtro estilo PostgREST: "op.valor" o "op.(v1,v2,v3)" para `in`.
function parseFilterValue(raw) {
  const dot = raw.indexOf('.');
  if (dot === -1) throw new ShimError(`filtro malformado: ${raw}`);
  const op = raw.slice(0, dot);
  const value = raw.slice(dot + 1);
  return { op, value };
}

// query: instancia de URLSearchParams (ya decodeada)
export function parseFilters(table, query) {
  const tableDef = TABLES[table];
  if (!tableDef) throw new ShimError(`tabla no soportada en D1: ${table}`, 501);

  const filters = [];
  for (const [key, raw] of query.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    const col = key;
    assertColumn(tableDef, table, col);
    if (tableDef.tenant && col === tableDef.tenant.column) continue; // se ignora, se inyecta server-side
    const { op, value } = parseFilterValue(raw);
    if (op === 'is') {
      filters.push({ col, op: 'is', value: value === 'null' ? null : value === 'true' ? 1 : value === 'false' ? 0 : value });
    } else if (op === 'in') {
      const list = value.replace(/^\(/, '').replace(/\)$/, '').split(',').map((v) => v.trim());
      filters.push({ col, op: 'in', value: list.map((v) => toSqliteValue(tableDef, col, v)) });
    } else if (OP_SQL[op]) {
      filters.push({ col, op, value: toSqliteValue(tableDef, col, value) });
    } else {
      throw new ShimError(`operador no soportado: ${op}`, 400);
    }
  }

  const select = query.get('select');
  let selectCols = ['*'];
  if (select && select !== '*') {
    selectCols = select.split(',').map((c) => c.trim());
    for (const c of selectCols) assertColumn(tableDef, table, c);
  }

  const orderRaw = query.get('order');
  let orderBy = null;
  if (orderRaw) {
    const [col, dir] = orderRaw.split('.');
    assertColumn(tableDef, table, col);
    orderBy = `${col} ${(dir || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
  }

  const limitRaw = query.get('limit');
  const limit = limitRaw ? Math.max(0, parseInt(limitRaw, 10) || 0) : null;

  return { tableDef, filters, selectCols, orderBy, limit };
}

function whereClause(tableDef, filters, tenantValue) {
  const clauses = [];
  const binds = [];
  if (tableDef.tenant) {
    clauses.push(`${tableDef.tenant.column} = ?`);
    binds.push(tenantValue);
  }
  for (const f of filters) {
    if (f.op === 'is') {
      clauses.push(f.value === null ? `${f.col} IS NULL` : `${f.col} IS ?`);
      if (f.value !== null) binds.push(f.value);
    } else if (f.op === 'in') {
      clauses.push(`${f.col} IN (${f.value.map(() => '?').join(',')})`);
      binds.push(...f.value);
    } else {
      clauses.push(`${f.col} ${OP_SQL[f.op]} ?`);
      binds.push(f.value);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', binds };
}

export async function runSelect(db, table, query, tenantValue) {
  const { tableDef, filters, selectCols, orderBy, limit } = parseFilters(table, query);
  const { sql: where, binds } = whereClause(tableDef, filters, tenantValue);
  let sql = `SELECT ${selectCols.join(',')} FROM ${table} ${where}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit !== null) sql += ` LIMIT ${limit}`;
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map((r) => fromSqliteRow(tableDef, r));
}

// rows: array de objetos (soporta insert masivo, igual que supaPost con array)
// db.batch() en vez de un `for` con un await por fila: para un INSERT masivo
// (import Excel de productos, alta de items de un conteo físico -- 73 filas
// en un caso real, ver [[project_mipos_gateway_runinsert_n1]]) el for
// secuencial hacía 73 round-trips a D1 uno detrás del otro -- confirmado en
// vivo 2026-08-26 contra el Worker real: 14.1 SEGUNDOS para ese insert,
// suficiente para que el botón "Cargando productos..." de
// admin-inventario.js:cntIniciar() se sintiera colgado en el navegador del
// cliente. db.batch() manda todas las sentencias en una sola llamada RPC al
// binding D1 -- las ejecuta secuencialmente server-side dentro de una
// transacción implícita (todo o nada, más seguro que el for anterior, que
// dejaba filas parciales insertadas si alguna a mitad de camino fallaba).
export async function runInsert(db, table, rows, { onConflictCols, tenantValue, returnMinimal }) {
  const tableDef = TABLES[table];
  if (!tableDef) throw new ShimError(`tabla no soportada en D1: ${table}`, 501);
  const list = Array.isArray(rows) ? rows : [rows];
  const stmts = list.map((row) => {
    const data = { ...row };
    if (tableDef.tenant) data[tableDef.tenant.column] = tenantValue; // siempre inyectado, nunca confiado del body
    if (tableDef.uuidPk && !data[tableDef.pk]) data[tableDef.pk] = crypto.randomUUID();
    const cols = Object.keys(data).filter((c) => {
      assertColumn(tableDef, table, c);
      return true;
    });
    const values = cols.map((c) => toSqliteValue(tableDef, c, data[c]));
    let sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    if (onConflictCols && onConflictCols.length) {
      for (const c of onConflictCols) assertColumn(tableDef, table, c);
      const updateSet = cols
        .filter((c) => !onConflictCols.includes(c))
        .map((c) => `${c} = excluded.${c}`)
        .join(', ');
      sql += ` ON CONFLICT(${onConflictCols.join(',')}) DO UPDATE SET ${updateSet}`;
    }
    if (!returnMinimal) sql += ' RETURNING *';
    return db.prepare(sql).bind(...values);
  });
  const results = await db.batch(stmts);
  if (returnMinimal) return [];
  const out = [];
  for (const r of results) out.push(...r.results.map((row) => fromSqliteRow(tableDef, row)));
  return out;
}

// Blindaje de rango de daño para tablas admin-only (tableDef.tenant === null,
// ej. `licencias` -- ver schema.js). Esas tablas NO exigen autenticacion a
// pedido explicito del dueño (2026-08-11, "riesgo aceptado": cualquiera con
// la URL del Worker puede editar una licencia ajena sin login). Pero sin este
// chequeo, un PATCH/DELETE sin NINGUN filtro no tiene tenant que lo acote y
// tampoco ningun otro WHERE -- afecta TODAS las filas de la tabla de un solo
// request, accidental o no. Esto NO reintroduce la friccion de auth que se
// saco a proposito: super-admin.html siempre manda id=eq.X en estos casos,
// asi que el panel real no se ve afectado -- solo bloquea el caso "sin
// filtro = le pega a todos".
function assertFiltroObligatorioSiSinTenant(tableDef, table, filters) {
  if (tableDef.tenant === null && filters.length === 0) {
    throw new ShimError(`${table}: falta filtro -- esta tabla no tiene tenant que acote el alcance, se exige al menos un filtro explicito para operaciones que modifican datos`, 400);
  }
}

export async function runUpdate(db, table, query, data, tenantValue, { returnMinimal }) {
  const { tableDef, filters } = parseFilters(table, query);
  assertFiltroObligatorioSiSinTenant(tableDef, table, filters);
  const patch = { ...data };
  delete patch[tableDef.tenant ? tableDef.tenant.column : '__none__']; // no se permite reescribir el tenant desde el cliente
  const cols = Object.keys(patch).filter((c) => {
    assertColumn(tableDef, table, c);
    return true;
  });
  if (!cols.length) return [];
  const setSql = cols.map((c) => `${c} = ?`).join(', ');
  const setBinds = cols.map((c) => toSqliteValue(tableDef, c, patch[c]));
  const { sql: where, binds: whereBinds } = whereClause(tableDef, filters, tenantValue);
  let sql = `UPDATE ${table} SET ${setSql} ${where}`;
  if (!returnMinimal) sql += ' RETURNING *';
  const stmt = db.prepare(sql).bind(...setBinds, ...whereBinds);
  if (returnMinimal) {
    await stmt.run();
    return [];
  }
  const { results } = await stmt.all();
  return results.map((r) => fromSqliteRow(tableDef, r));
}

export async function runDelete(db, table, query, tenantValue) {
  const { tableDef, filters } = parseFilters(table, query);
  assertFiltroObligatorioSiSinTenant(tableDef, table, filters);
  const { sql: where, binds } = whereClause(tableDef, filters, tenantValue);
  await db.prepare(`DELETE FROM ${table} ${where}`).bind(...binds).run();
}

export { ShimError };
