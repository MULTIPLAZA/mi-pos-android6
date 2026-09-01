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
      'es_kilo', 'es_favorito', 'promo_cant', 'promo_precio',
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
      'pix_mp_pagos', 'factura_numero', 'factura_timbrado',
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
  // Faltaban del MVP inicial - confirmado 2026-08-11: egresos/ingresos de turno no
  // sincronizaban para tenants cloudflare (501, tabla no soportada). Columnas
  // inferidas del cliente (js/sync.js), NO confirmadas contra Supabase real como las
  // 11 tablas originales - ver docs/fase0-inventario.md.
  pos_egresos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'turno_id', 'descripcion', 'monto', 'monto_original', 'moneda_original',
      'fecha', 'terminal', 'licencia_email',
    ],
    booleans: [],
  },
  pos_ingresos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'turno_id', 'descripcion', 'monto', 'metodo', 'monto_original',
      'moneda_original', 'fecha', 'terminal', 'licencia_email',
    ],
    booleans: [],
  },
  // Sistema de fiado/credito (js/credito.js) - mismo hueco. OJO: usan `email` como
  // columna de tenant, no `licencia_email` (asi las llama el codigo cliente).
  pos_cred_clientes: {
    tenant: { column: 'email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'email', 'nombre', 'limite_gs'],
    booleans: [],
  },
  pos_cred_fiado: {
    tenant: { column: 'email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'email', 'cliente_id', 'cliente_nombre', 'nro_ticket', 'total', 'fecha',
      'pagado', 'fecha_pago', 'metodo_pago',
    ],
    booleans: ['pagado'],
  },
  // Primer par de tablas de Inventario/Stock (ver d1-migrations/0007_depositos_stock.sql).
  // Columnas confirmadas 2026-08-25 contra filas reales de Supabase (GET .../depositos
  // y .../stock con select=*), no inferidas del uso en JS como pos_egresos/pos_ingresos.
  depositos: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'sucursal_id', 'nombre', 'es_principal', 'activo', 'created_at'],
    booleans: ['es_principal', 'activo'],
  },
  stock: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'deposito_id', 'sucursal_id', 'producto_id',
      'nombre_producto', 'cantidad', 'cantidad_minima', 'costo_unitario', 'updated_at',
    ],
    booleans: [],
  },
  // Ver d1-migrations/0008_stock_movimientos.sql -- admin-inventario.js:guardarAjuste()
  // inserta acá ANTES de tocar `stock`, sin tolerar que falle.
  stock_movimientos: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'deposito_id', 'sucursal_id', 'producto_id', 'nombre_producto',
      'tipo', 'cantidad', 'cantidad_antes', 'cantidad_despues', 'referencia', 'observacion',
      'terminal', 'usuario', 'fecha', 'comprobante_id',
    ],
    booleans: [],
  },
  // Ver d1-migrations/0010_stock_conteos_comprobantes.sql -- completa Inventario
  // (Conteo Físico + Compras/Movimientos de Stock, que comparten stock_comprobantes).
  stock_conteos: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'deposito_id', 'sucursal_id', 'numero', 'estado',
      'observacion', 'usuario', 'fecha', 'fecha_confirm', 'created_at',
    ],
    booleans: [],
  },
  // licencia_id: columna D1-only, no existe en Supabase (ver comentario en la migración).
  stock_conteo_items: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'conteo_id', 'producto_id', 'nombre_producto',
      'stock_sistema', 'stock_fisico', 'diferencia', 'ajustado',
    ],
    booleans: ['ajustado'],
  },
  stock_comprobantes: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'deposito_id', 'sucursal_id', 'tipo', 'referencia',
      'venta_id', 'observacion', 'terminal', 'usuario', 'fecha', 'created_at',
      'proveedor', 'total_monto', 'metodo_pago', 'tiene_factura', 'factura_nro', 'factura_ruc',
    ],
    booleans: ['tiene_factura'],
  },
  // licencia_id: columna D1-only, no existe en Supabase (ver comentario en la migración).
  stock_comprobante_items: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'comprobante_id', 'producto_id', 'nombre_producto',
      'cantidad', 'cantidad_antes', 'cantidad_despues', 'costo_unitario',
    ],
    booleans: [],
  },
  // Ver d1-migrations/0011_gastos_iva_timbrados.sql -- completa Finanzas
  // (Gastos Fijos/Plan de Gastos, Liquidación IVA) y Facturación Electrónica (Timbrados).
  gasto_categorias: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'nombre', 'orden', 'activa', 'created_at'],
    booleans: ['activa'],
  },
  gasto_conceptos: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'categoria_id', 'nombre', 'descripcion', 'orden',
      'activo', 'created_at',
    ],
    booleans: ['activo'],
  },
  gastos: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'fecha', 'concepto', 'categoria', 'monto', 'observacion',
      'sucursal', 'usuario', 'created_at', 'concepto_id', 'categoria_id',
      'tiene_factura', 'factura_nro', 'factura_ruc',
      // 0014_gastos_eliminacion.sql -- gastoEliminar() ahora marca en vez de
      // borrar (mismo patron que pos_ventas.anulada/fecha_anulacion/
      // motivo_anulacion, + usuario_eliminacion que ventas no tiene).
      'eliminado', 'fecha_eliminacion', 'motivo_eliminacion', 'usuario_eliminacion',
      // 0016_gastos_iva.sql -- IVA real por gasto (10/5/exento) en vez de
      // asumir 10% fijo en el credito fiscal.
      'iva',
    ],
    booleans: ['tiene_factura', 'eliminado'],
  },
  iva_liquidaciones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'periodo', 'venta_10', 'venta_5', 'venta_exenta',
      'debito_10', 'debito_5', 'debito_total', 'compra_10', 'compra_5',
      'credito_compras', 'gasto_10', 'gasto_5', 'credito_gastos', 'credito_total',
      'iva_pagar', 'iva_favor', 'estado', 'notas', 'usuario', 'created_at', 'updated_at',
    ],
    booleans: [],
  },
  // UNIQUE(licencia_email,nro) en la migración -- guardarTim() hace UPSERT con
  // on_conflict='licencia_email,nro' (mismo patrón que ya rompió pos_productos).
  timbrados: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'licencia_email', 'nro', 'tipo', 'vig_ini', 'vig_fin', 'sucursal',
      'nombre_suc', 'desde', 'hasta', 'cert_venc', 'cert_emis', 'activo',
      'created_at', 'updated_at',
    ],
    booleans: ['activo'],
  },
  // UNIQUE(licencia_email,terminal) en la migración -- mismo motivo que timbrados arriba.
  timbrado_terminales: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'timbrado_id', 'licencia_email', 'terminal', 'sucursal', 'punto_exp',
      'nro_actual', 'activo', 'created_at', 'updated_at',
    ],
    booleans: ['activo'],
  },
};

export function isSupportedTable(table) {
  return Object.prototype.hasOwnProperty.call(TABLES, table);
}
