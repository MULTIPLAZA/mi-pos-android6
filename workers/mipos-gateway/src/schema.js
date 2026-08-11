// Fuente: information_schema.columns REAL de Supabase (CSV entregado por el usuario,
// confirmado 2026-08-10). Las 11 tablas MVP están todas confirmadas — sin borrador.
// Ver docs/fase0-inventario.md para el detalle de diferencias contra el borrador
// original inferido del código (varias: pos_categorias no tiene `activa`, pos_ventas
// tenía columnas no detectadas, sucursales.licencia_id es nullable, etc).
//
// Cada tabla D1-nativa soportada declara: su columna de tenant (y de que tipo es -
// email o licencia_id numerico, la inconsistencia es real, ver docs/fase0-inventario.md),
// y el allowlist de columnas legibles/escribibles. El Worker NUNCA acepta un nombre
// de columna que no este en `columns` - es la defensa contra column-name injection.

export const TENANT_EMAIL = 'email';
export const TENANT_LICENCIA_ID = 'licencia_id';

export const TABLES = {
  licencias: {
    tenant: null, // tabla raiz, no se filtra por si misma
    pk: 'id',
    columns: [
      'id', 'clave', 'plan_id', 'nombre_cliente', 'email_cliente', 'fecha_vence',
      'activa', 'notas', 'created_at', 'rubro', 'tipo_pago', 'monto', 'monto_soporte',
      'precio_terminal', 'tipo_negocio', 'capacidades',
    ],
    booleans: ['activa'],
  },
  activaciones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'device_id', 'email', 'nombre_negocio', 'direccion',
      'fecha_activacion', 'ultima_consulta', 'activa', 'ip_activacion', 'sucursal',
      'nombre_terminal', 'deleted_at', 'modo',
    ],
    booleans: ['activa'],
  },
  pos_config: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'licencia_email', 'clave', 'valor', 'updated_at'],
    booleans: [],
  },
  // OJO: la real NO tiene columna `activa`/`activo`.
  pos_categorias: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'nombre', 'color', 'licencia_email', 'updated_at'],
    booleans: [],
  },
  pos_productos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'nombre', 'precio', 'precio_variable', 'costo', 'codigo', 'categoria',
      'iva', 'color', 'color_propio', 'mitad', 'inventario', 'comanda', 'item_libre',
      'activo', 'terminal', 'licencia_email', 'updated_at', 'deleted_at', 'es_descuento',
      'desc_tipo', 'desc_valor', 'imagen', 'es_insumo', 'foto_url', 'codigos',
      'es_kilo', 'es_favorito',
    ],
    booleans: [
      'precio_variable', 'color_propio', 'mitad', 'inventario', 'comanda',
      'item_libre', 'activo', 'es_descuento', 'es_insumo', 'es_kilo', 'es_favorito',
    ],
  },
  pos_ventas: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'fecha', 'turno_id', 'terminal', 'total', 'metodo_pago', 'comprobante',
      'items', 'tiene_factura', 'factura_ruc', 'factura_nombre', 'licencia_email',
      'created_at', 'sucursal', 'id_transaccion', 'anulada', 'fecha_anulacion',
      'motivo_anulacion', 'div_pagos', 'cliente_nombre', 'fe_cdc', 'fe_estado',
      'fe_numero', 'fe_qr', 'fe_lote_id', 'fe_error', 'fe_respuesta',
      'fe_fecha_emision', 'fe_nc_cdc', 'fe_nc_numero', 'fe_nc_estado', 'mm_pagos',
      'pix_mp_pagos',
    ],
    booleans: ['tiene_factura', 'anulada'],
  },
  pos_turno: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'fecha_apertura', 'fecha_cierre', 'efectivo_inicial', 'estado', 'terminal',
      'total_contado', 'diferencia', 'licencia_email', 'created_at', 'total_vendido',
      'total_egresos', 'cantidad_ventas', 'resumen_pagos', 'efectivo_inicial_brl',
    ],
    booleans: [],
  },
  pos_salones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'sucursal_id', 'nombre', 'color', 'activo', 'orden', 'created_at',
    ],
    booleans: ['activo'],
  },
  pos_mesas: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'salon_id', 'licencia_id', 'sucursal_id', 'nombre', 'capacidad',
      'activo', 'orden', 'created_at',
    ],
    booleans: ['activo'],
  },
  sucursales: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'nombre', 'direccion', 'telefono', 'activa', 'created_at'],
    booleans: ['activa'],
  },
  // uuidPk: la real usa gen_random_uuid() en Postgres -> crypto.randomUUID() en el
  // Worker antes del INSERT (ver postgrestShim.js).
  pos_pedidos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    uuidPk: true,
    columns: [
      'id', 'licencia_email', 'licencia_id', 'sucursal', 'terminal_origen', 'mesero_id',
      'numero_orden', 'mesa', 'tipo_pedido', 'estado', 'items', 'total',
      'observaciones', 'venta_id', 'created_at', 'updated_at', 'descuento_ticket',
    ],
    booleans: [],
  },
};

export function isSupportedTable(table) {
  return Object.prototype.hasOwnProperty.call(TABLES, table);
}
