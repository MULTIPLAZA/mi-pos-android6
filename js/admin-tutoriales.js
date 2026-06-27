// ════════════════════════════════════════════════════════════
// Admin: Tutoriales — guías paso a paso por módulo
// ════════════════════════════════════════════════════════════
// Index visual con tarjetas agrupadas por categoria. Click en una
// tarjeta abre el tutorial completo (mismo content area).
//
// Para AGREGAR un tutorial: simplemente sumar un objeto a TUTORIALES.
// ════════════════════════════════════════════════════════════

var TUTORIALES = [
  // ───────── PRINCIPAL ─────────
  {
    id: 'dashboard',
    cat: 'Principal',
    titulo: 'Dashboard — leer el resumen del negocio',
    icono: 'chart',
    resumen: 'Ventas, ticket promedio, operaciones, distribución de pagos y los productos más vendidos del mes — todo de un vistazo.',
    paraQueSirve: 'Es la primera pantalla que ves al entrar al admin. Te muestra cómo viene el mes en comparación con el anterior: cuánto vendiste, cuál es tu ticket promedio, cuántas operaciones hiciste, en qué método cobraste más, qué productos se vendieron más, y los gastos/compras del período. Es la foto del negocio.',
    pasos: [
      { t:'Ver KPIs principales', d:'Arriba ves <b>3 cards grandes</b>: <b>Ventas</b> del mes (con flecha verde si subió vs mes anterior, roja si bajó), <b>Ticket promedio</b> (cuánto gasta en promedio cada cliente) y <b>Operaciones</b> (cuántos tickets emitiste).' },
      { t:'Distribución por forma de cobro', d:'Card amplia: porcentaje de <b>Efectivo</b> vs <b>POS/Transferencia</b>. Te dice cómo te paga tu cliente — si la mayoría es efectivo, podés necesitar más caja chica.' },
      { t:'Compras y gastos del mes', d:'Dos cards: <b>Compras</b> (gasto en mercadería, con las 3 más grandes detalladas) y <b>Gastos</b> (alquileres, sueldos, etc). Si compras > ventas, está mal.' },
      { t:'Gráfico de últimos 7 días', d:'Barras agrupadas por día: <b>Ventas</b> (azul), <b>Costo</b> (gris), <b>Utilidad</b> (verde). Buscá si hay un día consistentemente más bajo y revisá la causa.' },
      { t:'Día y hora más activos', d:'Cards a la derecha: en qué día de la semana vendés más, y en qué hora del día. Útil para reforzar personal en esos horarios.' },
      { t:'Top productos del mes', d:'Lista con los productos más vendidos: cuánto vendiste de cada uno y la barra horizontal proporcional. Si tu top 3 cae, hay que reaccionar.' },
      { t:'Participación por categoría', d:'Gráfico de torta: % de tus ventas por categoría (Clásicas, Gourmet, Bebidas, etc.). Si una categoría chica crece, puede ser una oportunidad.' }
    ],
    tips: [
      'Mirá el dashboard <b>todos los días al cerrar</b> el local. 2 minutos. Te entrena el ojo para detectar caídas a tiempo.',
      'Si el <b>ticket promedio</b> baja vs mes anterior, capaz hay que armar combos o promos para subirlo.',
      'Las <b>flechas verde/roja</b> en los KPIs son la comparación con el MES ANTERIOR completo. No se comparan con la semana anterior.',
      'Cambiá el rango con los chips <b>Hoy / Esta semana / Este mes</b> arriba a la derecha para ver foto chica o foto grande.'
    ]
  },
  // ───────── CATÁLOGO ─────────
  {
    id: 'productos',
    cat: 'Catálogo',
    titulo: 'Cargar y editar productos',
    icono: 'package',
    resumen: 'Crear, editar y organizar el menú/catálogo de productos que vendés.',
    paraQueSirve: 'Es el corazón del negocio: cada producto que vas a vender (lomito, coca, hamburguesa) tiene que estar cargado acá con su precio, categoría y color. Sin esto, el cajero no tiene qué tocar para vender.',
    pasos: [
      { t:'Entrar a Productos', d:'En el menú lateral izquierdo, hacé click en <b>Productos</b> (sección Catálogo).' },
      { t:'Crear producto nuevo', d:'Apretá el botón <b>+ Nuevo producto</b> arriba a la derecha.' },
      { t:'Cargar los datos básicos', d:'Nombre del producto, precio de venta, categoría (Bebidas, Comidas, etc.) y color (sirve para identificarlo rápido en el POS).' },
      { t:'Activar inventario (si controlás stock)', d:'Si querés llevar control de cuánto te queda, activá el switch <b>Inventario</b>. Vas a poder ver el stock en pantalla.' },
      { t:'Definir mínimo de stock', d:'Si activaste inventario, poné el <b>stock mínimo</b>. Cuando llegues a ese número, el sistema te avisa con un color naranja.' },
      { t:'Guardar', d:'Apretá <b>Guardar</b>. El producto aparece automáticamente en el POS del local.' }
    ],
    tips: [
      'El <b>color</b> ayuda al cajero a encontrar productos rápido en el POS. Usá colores distintos por categoría (rojo para carnes, verde para bebidas, etc.).',
      'Si el producto tiene <b>precio variable</b> (ej. delivery), activá esa opción y al venderlo te va a pedir el monto.'
    ]
  },
  {
    id: 'importar',
    cat: 'Catálogo',
    titulo: 'Importar productos desde Excel',
    icono: 'upload',
    resumen: 'Cargar muchos productos de una en lugar de uno por uno.',
    paraQueSirve: 'Si tenés 50 o 200 productos para subir al sistema, en vez de cargarlos uno por uno podés hacer una planilla de Excel y subirla. Te ahorra horas.',
    pasos: [
      { t:'Entrar a Importar productos', d:'En el menú lateral, sección Catálogo → <b>Importar productos</b>.' },
      { t:'Descargar plantilla', d:'Apretá <b>Descargar plantilla Excel</b>. Te baja un archivo .xlsx con las columnas correctas.' },
      { t:'Llenar la planilla', d:'Abrila en Excel/Google Sheets y cargá una fila por producto: <b>nombre, precio, categoría, color, inventario (sí/no), mínimo, costo</b>.' },
      { t:'Subir la planilla', d:'Volvé al sistema, apretá <b>Seleccionar archivo</b> y elegí tu Excel.' },
      { t:'Revisar la vista previa', d:'El sistema muestra los productos detectados. Verificá que esté todo bien antes de confirmar.' },
      { t:'Confirmar importación', d:'Apretá <b>Importar</b>. Los productos se cargan al catálogo y ya están disponibles en el POS.' }
    ],
    tips: [
      'Hacelo de a tandas si tenés muchos productos (ej. de 50 en 50) para revisar mejor.',
      'Si un producto ya existe con el mismo nombre, el sistema te pregunta si actualizar o saltar.'
    ]
  },
  {
    id: 'insumos',
    cat: 'Catálogo',
    titulo: 'Insumos: qué son, cómo cargarlos y aplicar stock',
    icono: 'box',
    resumen: 'Mercadería que comprás para producir pero que NO vendés directo (harina, aceite, servilletas). Te explicamos paso a paso cómo darles stock.',
    paraQueSirve: '<p>Algunas cosas las <b>comprás pero no se venden por separado</b>: la harina para hacer las pizzas, el aceite, las servilletas, el papel higiénico del baño. Esos son <b>insumos</b>.</p><p><b>Diferencia clara con productos:</b></p><ul style="margin:8px 0 8px 18px;line-height:1.6"><li><b>Producto</b> = ALGO QUE VENDÉS. Aparece en el POS del cajero. Tiene precio de venta. Ejemplo: "Pizza Margarita", "Coca 600ml".</li><li><b>Insumo</b> = ALGO QUE USÁS PARA PRODUCIR O PARA EL LOCAL. NO aparece en el POS. NO tiene precio de venta. Ejemplo: "Harina 000", "Queso muzzarella", "Servilletas", "Detergente".</li></ul><p>Si lo cargás como insumo y mañana lo querés vender, lo podés "mover a productos" sin perder el stock acumulado.</p>',
    pasos: [
      { t:'Decidir si es producto o insumo', d:'Pregunta clave: <i>"¿el cliente lo pide y se lo cobro por separado?"</i>. Si SÍ → es <b>Producto</b>. Si NO (se usa adentro o para producir algo más) → es <b>Insumo</b>. Ejemplo: la <b>Pizza</b> es producto. La <b>Harina</b> que usás para hacerla es insumo.' },
      { t:'Entrar a Insumos', d:'Menú lateral → sección Catálogo → <b>Insumos</b>. Es una pantalla muy parecida a Productos pero pintada de naranja para que no las confundas.' },
      { t:'+ Nuevo Insumo', d:'Apretá el botón verde <b>+ Nuevo Insumo</b> arriba a la derecha. Se abre un panel a la derecha con el formulario.' },
      { t:'Cargar nombre y categoría', d:'<b>Nombre</b>: descriptivo y claro (ej. "Harina 000 25kg", "Aceite girasol 5L"). <b>Categoría</b>: agrupá por tipo (Lácteos, Limpieza, Carnes, Envases, Verduleria, etc.). Si no existe la categoría, escribila y se crea sola.' },
      { t:'Costo unitario (importante)', d:'Cuánto te sale UNA unidad del insumo. Ejemplo: si comprás una bolsa de harina por Gs 35.000 y la dividís en kg para llevar control, el costo unitario es Gs 1.400 (35.000 / 25 kg). Este número se usa para calcular cuánta plata tenés inmovilizada en stock.' },
      { t:'Color (opcional)', d:'Útil para identificarlo rápido visualmente en las listas. Verde para verduras, marrón para carnes, etc.' },
      { t:'Guardar insumo', d:'Apretá <b>Guardar insumo</b> abajo. El insumo se crea con stock = 0 (todavía no tenés nada cargado). Para CARGARLE STOCK seguí los siguientes pasos.' },
      { t:'¿Cómo le aplico stock al insumo? (Opción A: por compra)', d:'<b>La forma normal:</b> cada vez que comprás insumos (al proveedor, al supermercado mayorista) lo registrás en <b>Compras</b>. Andá al tutorial "Cargar compras de mercadería" — el flujo es idéntico que para productos. Al guardar la compra, el stock del insumo se actualiza automáticamente.' },
      { t:'¿Cómo le aplico stock al insumo? (Opción B: ajuste manual)', d:'<b>Para el stock inicial (la primera vez):</b> entrá a <b>Inventarios</b> → buscá el insumo en la lista → apretá <b>✏️ Ajustar</b>. Elegí "<b>Ajuste — fija el stock en</b>" y poné la cantidad real que tenés ahora. Motivo: "Stock inicial". Listo.' },
      { t:'Ver el stock de los insumos', d:'En <b>Inventarios</b> aparecen TODOS: productos e insumos juntos. Si querés ver solo insumos, podés filtrarlos por categoría. También en el <b>Extracto de Producto</b> podés ver la evolución de un insumo específico (cuánto compraste, cuánto usaste).' }
    ],
    tips: [
      'El sistema te <b>bloquea</b> que el insumo aparezca en el POS del cajero: en la grilla, en la búsqueda, en pizzas mitad y mitad, en modificadores. Tranquilo, no se va a vender por error.',
      'Si te equivocaste y cargaste como insumo algo que SÍ vendés, abrí el insumo y apretá "<b>→ Mover a Productos</b>" arriba. Se transfiere con stock intacto.',
      'Igual que con productos, los insumos podés cargarlos masivo desde Excel — "Importar productos" sirve para ambos.',
      'Si vendés productos COMPUESTOS (una pizza usa harina + queso + salsa) podés en el futuro armar <b>recetas</b> para que al vender una pizza se descuenten automáticamente los insumos que la componen.',
      'Para limpieza/baño/papelería: cargá como insumo y al fin de mes hacé un <b>Movimiento de Stock → Salida</b> con motivo "Consumo del local". Así sabés cuánta plata gastás en eso por mes.'
    ]
  },

  // ───────── INVENTARIO ─────────
  {
    id: 'stock-inicio',
    cat: 'Inventario',
    titulo: 'Arrancar con el control de stock — el flujo completo',
    icono: 'help',
    resumen: 'Antes de meterte en cada pantalla, entendé cómo se conectan todas. Tutorial recomendado PRIMERO si nunca usaste un sistema de stock.',
    paraQueSirve: '<p>Si nunca usaste un sistema de stock antes, esto te va a ahorrar dolores de cabeza. Te explicamos el modelo completo antes de meternos en cada botón.</p><p><b>La idea de fondo es simple:</b></p><ol style="margin:8px 0 8px 18px;line-height:1.7"><li>Cargás tus productos en el sistema (una sola vez).</li><li>Le decís al sistema cuánto tenés HOY de cada uno (stock inicial).</li><li>Cuando compras al proveedor, lo cargás en COMPRAS → suma stock.</li><li>Cuando vendés a un cliente desde el POS → resta stock SOLO.</li><li>Si rompiste algo, lo regalaste, o pasó algo raro, lo cargás en MOVIMIENTOS DE STOCK.</li><li>Una vez por mes hacés CONTEO FÍSICO: contás lo real y ajustás diferencias.</li></ol><p>Si seguís este ciclo, el sistema siempre va a saber cuánto tenés. Si te salteás pasos, vas a tener diferencias.</p>',
    pasos: [
      { t:'Glosario rápido — entendé estos 5 términos antes', d:'<b>Producto</b>: algo que vendés (pizza, coca). <b>Insumo</b>: algo que usás/comprás pero no vendés (harina, papel). <b>Stock</b>: cuánto tenés AHORA de algo. <b>Depósito</b>: dónde está guardado (depósito principal del local, depósito de la otra sucursal, etc.). <b>Comprobante</b>: cada vez que algo entra o sale, queda registrado como un "comprobante" con fecha y motivo.' },
      { t:'Paso 1: Cargar tus productos', d:'Andá a <b>Productos</b> (sección Catálogo). Cargá cada cosa que vendés con su nombre y precio. <b>Importante:</b> en los productos que querés llevarles control de stock, activá el switch <b>Inventario</b>. Los que no necesitás controlar (ej. una bebida que reponés a diario), podés dejarlos sin inventario.' },
      { t:'Paso 2: Cargar el stock inicial', d:'Entrá a <b>Inventarios</b>. Vas a ver todos los productos con stock en 0. Para cada uno apretá <b>✏️ Ajustar</b> → tipo <b>"Ajuste — fija el stock en"</b> → cantidad que tenés realmente AHORA → motivo "Stock inicial". Esto le dice al sistema "tengo TANTO de esto". Tarea de una sola vez.' },
      { t:'Paso 3: A medida que comprás → Compras', d:'CADA VEZ que te llegan productos del proveedor, los cargás en la pantalla <b>Compras</b>. Eso suma stock automáticamente. NO uses ajuste manual para esto — usalo solo para el inicial o para casos raros.' },
      { t:'Paso 4: A medida que vendés → automático', d:'Vos no hacés nada acá: cuando un cajero vende un producto en el POS y lo cobra, el sistema le resta uno al stock automáticamente. Cada venta es un <b>comprobante</b> que vas a ver después en el extracto del producto.' },
      { t:'Paso 5: Casos raros → Movimientos de Stock', d:'Si <b>rompiste</b> un producto, lo <b>regalaste</b>, lo <b>consumiste</b> el personal, o lo <b>transferiste</b> a otra sucursal — eso NO es compra ni venta. Va en <b>Movimientos de Stock</b> con el motivo claro (rotura, regalo, consumo, transferencia).' },
      { t:'Paso 6: Una vez por mes → Conteo físico', d:'Por más cuidado que tengas, el sistema y la realidad se desfasan (roturas no registradas, robos, errores). 1 vez por mes hacés un <b>Conteo Físico</b>: contás la mercadería real y el sistema te ajusta automáticamente las diferencias.' },
      { t:'Paso 7: Mirar resultados → Inventarios + Extracto', d:'<b>Inventarios</b> te dice CÓMO ESTÁS HOY (cuánto tenés de cada, qué está bajo, qué está crítico). <b>Extracto de Producto</b> te dice por qué llegaste a ese stock (qué pasó en el tiempo). Son tus dos pantallas de control.' }
    ],
    tips: [
      'El error más común: cargar el stock inicial mal o no cargarlo nunca. Sin stock inicial el sistema no tiene de dónde partir y todo queda raro. Hacé este paso bien.',
      'Si tenés POCOS productos (10-30), cargá stock inicial uno por uno. Si tenés MUCHOS (100+), pedile a un empleado que cuente todo en una tarde y vos cargás los números — es la única forma seria.',
      'El segundo error más común: no cargar las compras. Si te llega mercadería y no la cargás en el sistema, el stock se va a hacer cada vez más negativo a medida que vendés. <b>Cargar compras es lo más importante</b>.',
      'No te enrosques con que el stock esté siempre 100% exacto. El conteo mensual existe justamente para tolerar pequeñas diferencias. Buscá que el sistema te dé un orden, no una precisión imposible.'
    ]
  },
  {
    id: 'inventarios',
    cat: 'Inventario',
    titulo: 'Controlar mi stock — pantalla Inventarios',
    icono: 'list',
    resumen: 'La pantalla principal del módulo. Ver cuánto tenés de cada cosa, qué está bajo, qué está crítico, y cuánta plata tenés invertida en mercadería.',
    paraQueSirve: '<p>Es como abrir la puerta del depósito y mirar todo de un vistazo. Esta pantalla te responde a 4 preguntas clave del día a día:</p><ol style="margin:8px 0 8px 18px;line-height:1.7"><li><b>¿Qué cosas estoy por quedarme sin stock?</b> (los del estado naranja/rojo).</li><li><b>¿Cuánta plata tengo "tirada" en mercadería?</b> (el KPI verde "Valor en inventario").</li><li><b>¿Cuánto me queda de [tal cosa]?</b> (busco el nombre y veo el número).</li><li><b>¿Por qué el stock de [tal cosa] está raro?</b> (apretás "Historial" y ves la evolución).</li></ol><p>Si entrás todos los días al admin, esta es la pantalla a mirar primero después del Dashboard.</p>',
    pasos: [
      { t:'Entrar a Inventarios', d:'Menú lateral → sección Inventario → <b>Inventarios</b>. Vas a ver una pantalla con 4 cards arriba, una barra de búsqueda y abajo una tabla con todos los productos.' },
      { t:'Elegir sucursal (si tenés más de una)', d:'Arriba a la derecha hay un dropdown <b>"Todas las sucursales"</b>. Si tu negocio tiene una sola sucursal, dejá "Todas". Si tenés varias, podés filtrar por una específica para ver solo su stock.' },
      { t:'Leer los 4 KPIs grandes de arriba', d:'<b>Productos</b> (azul): cantidad de items con inventario activo. <b>Stock bajo</b> (naranja): los que llegaron a su mínimo configurado — comprar pronto. <b>Sin stock</b> (rojo): los que están en 0 o negativo — urgente. <b>Valor en inventario</b> (verde): cantidad × costo unitario sumado de todo — es la PLATA REAL que tenés en mercadería.' },
      { t:'Filtrar con los chips de estado', d:'A la derecha de la búsqueda hay 4 chips: <b>Todos</b>, <b>OK</b>, <b>Bajo</b>, <b>Sin stock</b>. Cada uno tiene un contador. Tocá "<b>Sin stock</b>" y la tabla te muestra SOLO lo que está crítico → eso es tu lista de compras urgente.' },
      { t:'Buscar un producto específico', d:'Escribí en el campo de búsqueda (lupa) — busca por nombre, código o categoría. Útil cuando tenés muchos productos y querés ir directo a uno.' },
      { t:'Interpretar cada fila', d:'Cada fila es un producto. Tiene: <b>círculo de color</b> (identificación visual), <b>nombre + código</b>, <b>stock actual</b> con una barra de progreso vs el mínimo (verde/naranja/roja), el <b>costo unitario</b>, el <b>valor</b> (cantidad × costo), un <b>tag de estado</b> (OK/Bajo/Sin stock) y a la derecha los botones <b>Historial</b> y <b>Ajustar</b>.' },
      { t:'Ver el Historial de un producto', d:'Apretá <b>📊 Historial</b> en la fila del producto. Se abre un modal con TODOS los movimientos (compras, ventas, ajustes, conteos) y un mini-gráfico de evolución. Para entender por qué se quedó en ese stock.' },
      { t:'Ajustar el stock manualmente', d:'Apretá <b>✏️ Ajustar</b> en la fila. Elegí el tipo: <b>Entrada</b> (suma — para cargar mercadería que apareció), <b>Salida</b> (resta — rotura, regalo) o <b>Ajuste</b> (fija en un número — para stock inicial o cuando ya no sabés qué pasó). Cargá la cantidad, motivo obligatorio (importante para tu auditoría), guardar.' },
      { t:'Productos críticos primero', d:'La tabla está ordenada para ayudarte: primero los SIN STOCK (rojo), después los BAJOS (naranja), después los OK (verde). Así lo urgente lo ves sin scrollear.' }
    ],
    tips: [
      'El <b>Valor en inventario</b> es plata real "atada" en mercadería. Si ese número es muy alto (más de 1-2 meses de ventas), tenés sobrestock — estás comprando más de lo que vendés.',
      'Definí <b>mínimos</b> realistas en cada producto. El mínimo te avisa antes de que te quedes sin stock. Como regla: el mínimo debería ser lo que vendés en 5-7 días.',
      'Si activaste inventario en muchos productos y se ve abrumador, podés dejar inventario solo en los más caros o más críticos. No tenés que llevar control de TODO.',
      'En sucursales múltiples, el filtro de sucursal arriba es CLAVE. Te muestra solo el stock de ese local así no te confundís con el de otras.'
    ]
  },
  {
    id: 'extracto',
    cat: 'Inventario',
    titulo: 'Extracto de un producto — auditoria del stock',
    icono: 'trending',
    resumen: 'Cuando un producto se mueve raro y querés saber POR QUÉ, esto te muestra la película completa: cada entrada, cada salida, cada ajuste — en orden cronológico.',
    paraQueSirve: '<p>Si Inventarios es la "foto de hoy", el Extracto es la "película desde siempre". Es la herramienta de auditoría más potente del módulo de stock.</p><p><b>Cuándo lo usás:</b></p><ul style="margin:8px 0 8px 18px;line-height:1.6"><li>Un producto te aparece con stock raro y querés saber qué pasó.</li><li>Sospechás que falta algo (¿robo? ¿error?).</li><li>Querés ver cuánto vendiste de un producto en un mes específico.</li><li>Necesitás demostrar al contador qué movimientos hubo.</li><li>Querés ver el gráfico de evolución (sube? baja? cuándo subió mucho?).</li></ul>',
    pasos: [
      { t:'Entrar a Extracto de Producto', d:'Menú lateral → sección Inventario → <b>Extracto de Producto</b>. Vas a ver una pantalla casi vacía con filtros arriba — tenés que elegir un producto primero.' },
      { t:'Elegir el producto a auditar', d:'Dropdown <b>Producto</b> arriba a la izquierda. Te muestra todos los que tienen inventario activo. Elegí el que querés revisar (ej. "Carne", "Coca Cola 1.5L").' },
      { t:'Elegir el período', d:'Dos formas: (A) los chips rápidos <b>Hoy / Semana / Mes / Año</b> son atajos. (B) cargás manualmente <b>Desde</b> y <b>Hasta</b> con los calendarios. Para una auditoría completa, usá un período largo (3 meses, año).' },
      { t:'Filtrar por sucursal (opcional)', d:'Si tu negocio tiene varias sucursales, podés ver el extracto de SOLO una. Sino dejá "Todas las sucursales" para ver todo.' },
      { t:'Filtrar por depósito (opcional)', d:'Similar a sucursal. Si dentro de una sucursal tenés varios depósitos (ej. cocina + barra), podés filtrar uno solo.' },
      { t:'Apretar BUSCAR', d:'Botón verde arriba a la derecha. El sistema arma los 4 KPIs, el gráfico y la tabla.' },
      { t:'Leer los 4 KPIs grandes', d:'<b>Saldo anterior</b>: cuánto tenías ANTES de empezar el período. <b>Entradas</b>: cuánto entró (compras, ajustes positivos). <b>Salidas</b>: cuánto salió (ventas, roturas, ajustes negativos). <b>Saldo final</b>: lo que te quedó al final del período. La fórmula es: Saldo anterior + Entradas − Salidas = Saldo final. Si no cierra, hay algo raro.' },
      { t:'Mirar el gráfico de evolución', d:'La línea muestra cómo se movió el stock día a día. <b>Verde</b> = creció en el período (compraste más de lo que vendiste). <b>Rojo</b> = terminaste negativo (vendiste lo que no tenías cargado — falta cargar compras). <b>Gris</b> = quedaste en cero al final. Los puntos son cada movimiento.' },
      { t:'Leer la tabla cronológica', d:'Cada fila es un movimiento: <b>Fecha/Hora</b>, <b>Tipo</b> (Venta, Compra, Ajuste, Conteo, etc. — con color), <b>Comprobante</b> (el número o referencia), <b>Sucursal/Depósito</b> donde pasó, <b>Entrada</b> y <b>Salida</b> (cantidad), <b>Saldo</b> (cuánto te quedó después de ese movimiento). La tabla está en orden cronológico.' },
      { t:'Expandir el detalle de un movimiento', d:'Hacé <b>click sobre una fila</b> y se abre debajo un mini-detalle con TODOS los productos que estaban en ese comprobante. Útil cuando una compra incluyó 10 cosas y querés verlo entero.' },
      { t:'Filtrar por tipo de movimiento', d:'Abajo de la tabla hay un dropdown <b>"Todos los tipos"</b>. Podés elegir "Solo ventas", "Solo compras", "Solo ajustes". Útil para responder preguntas tipo: <i>"¿cuántas veces ajusté este producto a mano?"</i>.' }
    ],
    tips: [
      'Si ves un <b>salto raro</b> (mucho stock que desaparece de golpe sin venta), hacé click en esa fila para expandir y ver qué fue. Capaz fue una transferencia, una rotura, o un error.',
      'Cuando hay un <b>Conteo Físico</b> en la tabla (color naranja), ese día alguien contó la realidad y se ajustó la diferencia. Útil para saber cuándo fue la última vez que cuadraste ese producto.',
      'Si el extracto muestra que vendiste 200 unidades en el mes pero el cliente te dice que no, capaz es un producto que se cobra por gramo o por porción (precio variable). Revisá la configuración del producto.',
      'Para el contador o para imprimir: podés exportar todo el extracto a Excel si necesitás (botón Exportar arriba a la derecha). Sirve para el cierre fiscal.'
    ]
  },
  {
    id: 'compras',
    cat: 'Inventario',
    titulo: 'Cargar compras de mercadería — paso a paso',
    icono: 'shoppingCart',
    resumen: 'La operación MÁS IMPORTANTE del módulo de inventario. Cada vez que te llega mercadería del proveedor, la cargás acá y el stock se actualiza solo.',
    paraQueSirve: '<p>Sin esto, todo el sistema deja de funcionar. Te lo explico con un ejemplo:</p><p><i>Hoy tenés 5 cocas en el sistema. Te llegan 20 más del proveedor. Si NO las cargás, el sistema sigue creyendo que tenés 5. Cuando vendas 6, te aparece en rojo "−1 stock". Si en cambio cargás la compra, el sistema pasa a "25 cocas", y vendiendo 6 te queda "19". Así de simple.</i></p><p><b>Hacé esto cada vez que recibís pedido</b>. Es la disciplina del local. 5 minutos cuando llega el camión te ahorran 5 horas de revisar diferencias después.</p>',
    pasos: [
      { t:'Tener la factura/remito del proveedor a mano', d:'Antes de empezar, tené el papel del proveedor delante: factura, remito, o lo que te dejó. Necesitás el <b>número de comprobante</b>, qué productos llegaron y con qué <b>costo unitario</b> cada uno. Si te lo enviaron por WhatsApp, abrí la foto al lado.' },
      { t:'Entrar a Compras', d:'Menú lateral → sección Inventario → <b>Compras</b>. Te muestra el historial de compras anteriores. Para registrar una nueva, vamos al tab siguiente.' },
      { t:'+ Nueva compra', d:'Apretá la pestaña <b>+ Nueva compra</b> arriba. Se abre el formulario en blanco.' },
      { t:'Cargar el encabezado', d:'<b>Fecha</b>: la fecha que llegó la mercadería (no necesariamente la de la factura). <b>Tipo</b>: viene fijo en "Compra / Ingreso". <b>Comprobante N°</b>: número que figura en la factura/remito del proveedor (ej. "001-002-0001234"). <b>Depósito destino</b>: dónde estás guardando la mercadería (si tenés una sola sucursal, hay uno solo). <b>Proveedor</b>: nombre de quien te vendió (Coca FEMSA, Frigorífico San Juan, etc).' },
      { t:'Observación (opcional pero útil)', d:'Campo libre. Útil para anotar cosas como "Vino sin 2 cajones del pedido, prometieron mandar mañana" o "Bonificación 5% por pago contado". Tu yo del futuro te lo agradece.' },
      { t:'Agregar productos uno por uno', d:'En el campo <b>"Buscar producto para agregar"</b> escribí el nombre del producto. Aparece un dropdown con coincidencias. Hacé click en el que es. Aparece una fila nueva en la tabla. Repetí para cada producto que vino en la compra.' },
      { t:'Cargar cantidad y costo unitario de cada producto', d:'En cada fila de producto: <b>Cantidad</b> que llegó (usá los botones − y + o escribí directo). <b>Costo unitario</b>: cuánto te costó UNA unidad (ej. si compraste 12 cocas a Gs 36.000, el costo unitario es 3.000). La columna <b>TOTAL</b> se calcula sola (cantidad × costo).' },
      { t:'Verificar el TOTAL COMPRA abajo', d:'Cuando terminás de cargar todos los productos, el sistema te suma el <b>TOTAL COMPRA</b> abajo a la derecha en verde. Compará ese número con el total de la factura del proveedor. <b>Si no coincide, repasá las cantidades o costos.</b> Errores típicos: poner el costo total en vez del unitario, equivocar cantidad.' },
      { t:'GUARDAR la compra', d:'Botón verde <b>💾 GUARDAR</b> abajo a la derecha. La compra se registra como un comprobante y el stock de TODOS los productos cargados se actualiza al instante. Vas a ver el toast verde de confirmación.' },
      { t:'Verificar (opcional)', d:'Volvé a Inventarios y buscá uno de los productos que cargaste. El stock debería haber aumentado por la cantidad que pusiste. Si querés ver la compra después, el listado en "Lista de compras" te la muestra con el botón <b>Ver</b> para ver el detalle.' }
    ],
    tips: [
      '<b>Cargá las compras el mismo día que llegan.</b> Si las dejás para "después" o para "el fin de semana", te olvidás detalles, perdés papeles, y empezás a tener diferencias. Es la disciplina más importante del módulo.',
      'El <b>costo unitario</b> que cargás se usa para 2 cosas: (1) calcular el <b>Valor en inventario</b> en la pantalla de Inventarios, (2) calcular el <b>costo de mercadería vendida</b> en el Balance P&G. Si cargás mal el costo, esos números van a estar mal.',
      'Si recibís un producto que NO está cargado en tu catálogo de productos, primero andá a Productos → + Nuevo, lo creás, y volvés a la compra. Si lo cargás de cero como "varios", después no se puede rastrear.',
      'Si te equivocaste al guardar (ej. cantidad mal), entrá a "Lista de compras", buscá la compra, apretá <b>Anular</b>. Eso REVIERTE el stock — vuelve a como estaba antes. Después cargá la compra correcta de cero.',
      'Si te falta un producto del pedido y prometen mandarlo después, NO lo cargues "por las dudas". Cargá solo lo que llegó. Cuando llegue lo faltante, hacés OTRA compra (referencia: "Faltante pedido X").',
      'Para insumos es exactamente lo mismo: en el buscador aparecen productos E insumos juntos. Cargás cantidad y costo igual. El stock se actualiza para el insumo automáticamente.'
    ]
  },
  {
    id: 'movstock',
    cat: 'Inventario',
    titulo: 'Movimientos de stock — para todo lo que no es compra ni venta',
    icono: 'transfer',
    resumen: 'Roturas, regalos, mermas, consumo del personal, traslados entre sucursales. Todo lo que mueve mercadería pero no es venta ni compra normal.',
    paraQueSirve: '<p>El día a día tiene mil situaciones que afectan el stock pero NO son una venta normal ni una compra al proveedor. Esta pantalla cubre todo eso para que el sistema se mantenga ordenado:</p><ul style="margin:8px 0 8px 18px;line-height:1.6"><li><b>Rotura/Merma</b>: se cayó una caja de cervezas, una pizza salió quemada, la verdura se pudrió → es una <b>Salida</b>.</li><li><b>Consumo del personal</b>: la moza tomó una coca → <b>Salida</b>.</li><li><b>Regalo / Cortesía</b>: invitaste al cliente importante → <b>Salida</b>.</li><li><b>Encontraste mercadería que no estaba en sistema</b>: → <b>Entrada</b> (raro pero pasa).</li><li><b>Mover mercadería entre sucursales</b>: el local A le presta carne al local B → <b>Transferencia</b>.</li></ul><p><b>Importante:</b> esto NO sirve para "cargar mercadería del proveedor" (eso va en Compras), ni para descontar ventas (eso lo hace el POS solo al cobrar).</p>',
    pasos: [
      { t:'Entrar a Movimientos de Stock', d:'Menú lateral → sección Inventario → <b>Movimientos de Stock</b>. Vas a ver el historial de movimientos anteriores con filtros (fecha, depósito).' },
      { t:'+ Nuevo movimiento', d:'Apretá la pestaña <b>+ Nuevo movimiento</b> arriba.' },
      { t:'Elegir el TIPO (clave)', d:'Dropdown <b>Tipo</b>. Tres opciones: <b>Entrada</b> (suma stock), <b>Salida</b> (resta stock), <b>Transferencia</b> (saca de un depósito y mete en otro). Elegí el que aplique al caso.' },
      { t:'Para ENTRADA o SALIDA', d:'Aparece un solo dropdown de <b>Depósito</b>: elegí dónde está la mercadería que vas a mover. Después cargás los productos con cantidades.' },
      { t:'Para TRANSFERENCIA', d:'Aparecen DOS dropdowns: <b>Depósito origen</b> (de dónde sale) y <b>Depósito destino</b> (a dónde va). Útil cuando el local del centro le presta al del barrio (o viceversa). El sistema genera DOS movimientos asociados: una salida en origen y una entrada en destino.' },
      { t:'Cargar Comprobante N° y Observación', d:'<b>Comprobante N°</b>: número interno tuyo si querés (ej. "ROTURA-001", "TRANS-2026-05-23"). Si dejás vacío, el sistema le pone uno automático. <b>Observación</b>: <b>OBLIGATORIO escribir el motivo claro</b>. Ej.: "Cayó la heladera, se perdieron 4 cocas y 2 cervezas". Tu yo del futuro va a leer esto en 6 meses y necesita entender qué pasó.' },
      { t:'Agregar los productos afectados', d:'En el buscador <b>"Buscar producto para agregar"</b> escribí el nombre, hacé click. Aparece la fila con cantidad. Repetí para cada producto que se vio afectado.' },
      { t:'Ajustar cantidades', d:'En cada fila, cantidad con los botones − y + o escribiendo directo. Si te equivocaste de producto, el botón × a la izquierda lo saca.' },
      { t:'GUARDAR', d:'Botón verde <b>💾 GUARDAR</b> abajo a la derecha. El stock se actualiza al instante. En Entrada se suma; en Salida se resta; en Transferencia se resta de origen y se suma en destino.' }
    ],
    tips: [
      '<b>Siempre cargá un motivo claro</b> en la Observación. Cuando dentro de 6 meses revises el extracto y veas un movimiento de -10 cocas, el motivo te recuerda qué pasó (rotura? robo? regalo?). Sin motivo, es un misterio.',
      'Las <b>transferencias</b> generan DOS comprobantes asociados (uno en cada depósito). Si querés cancelar una transferencia, anular cualquiera de los dos cancela el otro.',
      'Si tenés MUCHAS roturas, podés hacer UN movimiento al final del mes que diga "Mermas mayo 2026" con la lista completa, en vez de cargar de a uno cada día. Pero no te olvides de hacerlo.',
      'Para el <b>consumo del personal del local</b> (ej. cocas que toma el cocinero a la tarde): hacé un Movimiento de Salida una vez por mes con motivo "Consumo personal mes X". Te sirve para entender cuánto plata se va en esto.',
      'Si <b>te equivocaste</b> al guardar un movimiento, en el listado podés apretar <b>Anular</b> y el stock vuelve a como estaba.',
      'Diferencia clave: <b>Compras</b> = entrada del proveedor con costo. <b>Movimiento → Entrada</b> = entrada sin costo (apareció mercadería). Casi siempre usás Compras para sumar stock. Movimiento → Entrada es muy raro.'
    ]
  },
  {
    id: 'conteo',
    cat: 'Inventario',
    titulo: 'Conteo físico — alinear el sistema con la realidad',
    icono: 'check_circle',
    resumen: 'Una vez por mes contás la mercadería real con los pies en el depósito y el sistema te ajusta las diferencias automáticamente.',
    paraQueSirve: '<p>Por más cuidado que tengas con compras y movimientos, <b>siempre hay diferencias</b> entre lo que dice el sistema y lo que realmente hay en el depósito. ¿Por qué?</p><ul style="margin:8px 0 8px 18px;line-height:1.6"><li>Roturas que nadie cargó.</li><li>Regalos al cliente sin registrar.</li><li>Consumo del personal sin registrar.</li><li>Pequeños robos hormiga.</li><li>Errores de carga en compras.</li><li>Productos que se mezclan entre sí (ej. 2 sabores de coca en la misma estantería).</li></ul><p>El <b>conteo físico</b> es la herramienta para corregir todo eso. Una vez por mes (o cada 15 días si querés más rigor), agarrás una planilla, vas al depósito, contás la mercadería real, lo cargás en el sistema, y el sistema te ajusta las diferencias automáticamente. Después de un conteo, el sistema y la realidad están iguales.</p><p><b>Pensalo así:</b> es como hacer "cierre de caja" pero para la mercadería en vez del efectivo.</p>',
    pasos: [
      { t:'Elegir el momento', d:'Hacelo <b>fuera del horario de venta</b> (cierre del local, o un domingo). Si lo hacés mientras hay venta, vas a contar mientras la mercadería se está moviendo — vas a tener errores.' },
      { t:'Tener 1 persona contando + el sistema cerca', d:'Lo ideal: <b>uno</b> con celular o planilla impresa contando en el depósito, <b>otro</b> en la PC cargando los números. Si lo hacés solo, abrí el sistema en el celular y cargá ahí mismo mientras contás.' },
      { t:'Entrar a Conteo Físico', d:'Menú lateral → sección Inventario → <b>Conteo Físico</b>. Vas a ver el historial de conteos anteriores. Tabs: <b>Historial</b> (conteos pasados) y <b>+ Nuevo conteo</b> (para empezar uno nuevo).' },
      { t:'+ Nuevo conteo', d:'Apretá la pestaña <b>+ Nuevo conteo</b>.' },
      { t:'Elegir el depósito a contar', d:'Dropdown <b>Depósito a contar</b>. <b>Importante:</b> un conteo es de UN solo depósito. Si tenés varios (cocina + barra + sucursal otra), hacés un conteo separado por cada uno. No mezcles.' },
      { t:'Fecha y observación', d:'<b>Fecha del conteo</b>: hoy normalmente. <b>Observación</b> (opcional pero útil): "Conteo mensual mayo 2026" o "Conteo de cierre de mes". Para tu auditoría después.' },
      { t:'Iniciar conteo', d:'Apretá el botón verde <b>Iniciar conteo</b>. El sistema te arma una lista con TODOS los productos del depósito que tienen inventario activo. Vas a ver: columna PRODUCTO, columna SISTEMA (lo que el sistema cree que tenés), columna CONTEO FÍSICO (donde cargás lo real) y columna DIFERENCIA (se calcula sola).' },
      { t:'Contar y cargar producto por producto', d:'Andá al depósito y por cada producto: <b>contá la cantidad real que hay</b> y escribila en el campo "Conteo físico" correspondiente. El sistema te muestra automáticamente la <b>diferencia</b> (verde si tenés MÁS de lo esperado, rojo si tenés MENOS).' },
      { t:'¿Qué hacer si la diferencia es muy grande?', d:'Si la diferencia es ≥ 10% del stock, RECONTÁ ese producto antes de seguir. Capaz contaste mal, o capaz hay error de carga, o capaz hay un problema serio (robo). Si después de recontar sigue grande, dejala registrada y abordá la causa después.' },
      { t:'Guardar como borrador (si no terminás de una)', d:'Si tenés MUCHA mercadería y no terminás en una sola sesión, apretá <b>Guardar borrador</b> abajo. Podés volver al día siguiente y seguir desde donde quedaste. Aparece en el Historial con estado "BORRADOR".' },
      { t:'Confirmar y ajustar', d:'Cuando terminaste de contar TODO, apretá el botón verde <b>✓ Confirmar y ajustar</b> arriba a la derecha. El sistema te muestra un resumen: cuántos productos contaste, cuántos tienen diferencia ≠ 0. Confirmás y el sistema crea un comprobante de tipo <b>Conteo</b> que AJUSTA TODOS los productos con diferencia al número real que vos contaste. Los que no tienen diferencia, no se tocan.' },
      { t:'Verificar después', d:'Andá a Inventarios. Los productos que ajustaste ahora muestran el stock que vos contaste (el real). Si querés ver la auditoría del ajuste, andá a Extracto de un producto cualquiera y vas a ver una línea de tipo <b>Conteo</b> con la fecha de hoy.' }
    ],
    tips: [
      '<b>Hacelo una vez por mes mínimo.</b> Si nunca lo hacés, el desfase entre sistema y realidad crece y el sistema termina sirviendo para nada.',
      'Si tu mercadería se mueve mucho (restaurante con 200 ingredientes), capaz conteo semanal o quincenal de los productos críticos es mejor que conteo mensual completo.',
      'Llevá una <b>planilla impresa de Excel</b> al depósito para anotar los conteos a mano antes de cargarlos al sistema. Te evita ir y volver del depósito a la PC.',
      'Los productos con <b>diferencia = 0</b> (cuadran) NO se tocan en el ajuste — el sistema solo modifica los que tienen diferencia ≠ 0. Eso es bueno: no se pierde historial.',
      'Después del conteo, <b>el extracto del producto</b> muestra una línea tipo "Conteo CONTEO-005" en la fecha que lo hiciste. Así sabés siempre cuándo fue la última vez que cuadraste un producto.',
      'Si en un conteo encontrás una diferencia rara y querés investigar antes de confirmar, podés <b>guardar como borrador</b>, ir a Extracto de ese producto, ver los movimientos, descubrir la causa, y después volver al conteo y completar.',
      'Para insumos también — el conteo aparece junto con los productos. Contás todo lo del depósito.',
      'Si querés ser muy riguroso: <b>imprimí el reporte del conteo</b> (en Historial → botón Ver) y archivalo con la fecha. Sirve para auditoría contable.'
    ]
  },

  // ───────── OPERACIONES ─────────
  {
    id: 'cajas',
    cat: 'Operaciones',
    titulo: 'Cajas y turnos — abrir y cerrar caja',
    icono: 'cash',
    resumen: 'Cada vez que se vende hay que tener una caja abierta. Al final del día se cierra y se cuadra.',
    paraQueSirve: 'El turno es la sesión de trabajo del cajero: lo abre cuando empieza a vender (con el efectivo inicial) y lo cierra al final del día contando lo que hay en caja. Si las diferencias dan mal, el sistema te avisa.',
    pasos: [
      { t:'Abrir turno', d:'En el POS del local, al primer ingreso del día te pide <b>efectivo inicial</b>. Cargá lo que dejaste en la caja (ej. 50.000 para vuelto).' },
      { t:'Vender normal', d:'A medida que se cobra, el sistema acumula efectivo, POS, transferencias, etc. en el turno abierto.' },
      { t:'Ver turno desde el admin', d:'En el admin web → menú lateral → <b>Cajas / Turnos</b>. Ves cada turno abierto y cerrado, montos por método, ventas, anulaciones.' },
      { t:'Cerrar turno (en el POS)', d:'Al final del día, en el POS del local, ir a <b>Cerrar caja</b>. Te pide contar el efectivo real y los demás métodos.' },
      { t:'Cargar conteo real', d:'Poné cuánto contaste de efectivo, cuánto de POS, etc. El sistema te muestra automáticamente la <b>diferencia</b> con lo que esperaba.' },
      { t:'Confirmar', d:'Si la diferencia es chica o aceptable, confirmá. El turno queda cerrado y archivado en el reporte.' }
    ],
    tips: [
      'Si la diferencia da MUCHO mal (más de 5%), no confirmes — recontá. Capaz contaste un billete o método.',
      'Los <b>cierres de turno</b> son la auditoría diaria. Reviselo todos los días — si ves diferencias chicas seguidas, capaz hay un cajero descuidado.'
    ]
  },
  {
    id: 'terminales',
    cat: 'Operaciones',
    titulo: 'Terminales — vincular dispositivos al sistema',
    icono: 'monitor',
    resumen: 'Cada celular/tablet/PC que use el POS aparece acá como una terminal independiente.',
    paraQueSirve: 'Si tenés varios dispositivos vendiendo (una tablet en barra + un celular en delivery + una PC en caja), cada uno es una "terminal" del sistema. Acá ves cuáles están activas y desde dónde se vendió cada cosa.',
    pasos: [
      { t:'Entrar a Terminales', d:'Menú lateral → sección Principal → <b>Terminales</b>.' },
      { t:'Ver listado', d:'Tenés todas las terminales registradas con el nombre que le pusiste, sucursal, modo (caja o satélite), y última vez que se conectó.' },
      { t:'Asignar timbrado', d:'Cada terminal puede tener un timbrado distinto para facturar (más en el tutorial de Timbrado).' },
      { t:'Borrar terminal vieja', d:'Si una terminal ya no la usás (vendiste el celular, etc.), podés borrarla para limpiar el listado.' }
    ],
    tips: [
      '<b>Modo Caja</b>: cobra y emite ticket. <b>Modo Satélite</b>: mesero toma pedido y manda a la cocina, NO cobra. La caja después lo agarra y cobra.',
      'Si activás un dispositivo NUEVO con la misma sucursal que ya tenías, NO se crea sucursal nueva (gracias al fix idempotente que aplicamos). Reutiliza la existente.'
    ]
  },

  // ───────── FINANZAS ─────────
  {
    id: 'gastos',
    cat: 'Finanzas',
    titulo: 'Gastos fijos — anotar todo lo que sale',
    icono: 'cash',
    resumen: 'Cargar todos los gastos del negocio (alquiler, luz, sueldos) para saber tu rentabilidad real.',
    paraQueSirve: 'Las ventas son una parte de la historia. Para saber si <b>ganás plata</b> tenés que restar los gastos. Acá cargás todo: alquiler, sueldos, luz, gas, internet, impuestos, sueldos, etc. Sin esto, el balance no sirve.',
    pasos: [
      { t:'Entrar a Gastos Fijos', d:'Menú lateral → sección Finanzas → <b>Gastos Fijos</b>.' },
      { t:'+ Nuevo gasto', d:'Apretá <b>+ Nuevo gasto</b>.' },
      { t:'Elegir categoría', d:'Alquiler, Servicios, Sueldos, Impuestos, etc. (las creás en el Plan de Gastos previamente).' },
      { t:'Elegir concepto', d:'Dentro de cada categoría tenés conceptos puntuales (ej. en Servicios: ANDE, ESSAP, Internet).' },
      { t:'Cargar monto y fecha', d:'Cuánto pagaste y cuándo. Opcionalmente cargá una observación.' },
      { t:'Guardar', d:'El gasto queda registrado y se suma a tu balance del mes.' }
    ],
    tips: [
      'Cargá los gastos <b>el mismo día que los pagás</b> o al menos 1 vez por semana. Si los dejás todos para fin de mes, vas a olvidarte de alguno.',
      'Antes de cargar gastos por primera vez, andá a <b>Plan de Gastos</b> y armá las categorías que vas a usar.'
    ]
  },
  {
    id: 'plan-gastos',
    cat: 'Finanzas',
    titulo: 'Plan de Gastos — armar tus categorías',
    icono: 'tag',
    resumen: 'Crear las categorías y conceptos donde vas a cargar tus gastos.',
    paraQueSirve: 'Antes de empezar a cargar gastos, conviene tener armado tu "árbol" de categorías y conceptos. Así organizás todo y después los reportes salen agrupados de forma útil.',
    pasos: [
      { t:'Entrar a Plan de Gastos', d:'Menú lateral → sección Finanzas → <b>Plan de Gastos</b>.' },
      { t:'+ Nueva categoría', d:'Crea categorías generales: Alquileres, Servicios, Sueldos, Impuestos, Marketing, Mantenimiento.' },
      { t:'+ Nuevo concepto (dentro de cada categoría)', d:'Conceptos puntuales: en Servicios → ANDE, ESSAP, Internet, Cable, Teléfono.' },
      { t:'Reordenar / eliminar', d:'Podés borrar categorías o conceptos que no usás.' }
    ],
    tips: [
      'Empezá con pocas categorías (5-7) y andá creando conceptos a medida que aparecen los gastos. No te pongas a armar 50 conceptos de entrada.'
    ]
  },
  {
    id: 'balance',
    cat: 'Finanzas',
    titulo: 'Balance Pérdidas y Ganancias',
    icono: 'chart',
    resumen: 'Saber si el negocio gana o pierde plata en un período.',
    paraQueSirve: 'El reporte más importante para el dueño. Te dice: cuánto vendiste, cuánto te costó la mercadería vendida, cuánto pagaste en gastos, y cuánto te quedó NETO al final. Si ese número es positivo, ganaste plata. Si es negativo, perdiste.',
    pasos: [
      { t:'Entrar a Balance P&G', d:'Menú lateral → sección Finanzas → <b>Balance P&G</b>.' },
      { t:'Elegir período', d:'Hoy, semana, mes, año o un rango custom.' },
      { t:'Leer los grandes números', d:'<b>Ventas brutas</b> (total vendido) - <b>Costo de mercadería</b> (lo que te costó comprar lo que vendiste) = <b>Margen bruto</b>. Después de eso: - <b>Gastos fijos</b> = <b>Ganancia neta</b>.' },
      { t:'Mirar el % de margen', d:'Si el margen bruto es bajo (menos de 40-50%), capaz estás vendiendo barato o comprando caro. Si la ganancia neta es negativa, los gastos fijos son altos para tu volumen de ventas.' }
    ],
    tips: [
      'Mirá el balance <b>todas las semanas</b>. Si lo mirás solo a fin de mes, ya es tarde para reaccionar.',
      'Si el costo de mercadería sale 0 o muy bajo, capaz no cargaste los costos en los productos. Revisá Productos.'
    ]
  },
  {
    id: 'iva',
    cat: 'Finanzas',
    titulo: 'Liquidación de IVA',
    icono: 'fileText',
    resumen: 'Calcular cuánto IVA tenés que pagar al fisco cada período.',
    paraQueSirve: 'Si emitís facturas, cobrás IVA. Pero también pagás IVA cuando comprás mercadería. La diferencia es lo que tenés que ingresar a la DGI. Esta pantalla te lo calcula automáticamente.',
    pasos: [
      { t:'Entrar a Liquidación IVA', d:'Menú lateral → sección Finanzas → <b>Liquidación IVA</b>.' },
      { t:'Elegir período', d:'Generalmente mensual.' },
      { t:'Leer débito fiscal', d:'IVA que cobraste por tus ventas con factura.' },
      { t:'Leer crédito fiscal', d:'IVA que pagaste en las compras con factura del proveedor.' },
      { t:'Saldo a pagar', d:'Débito - Crédito = lo que tenés que ingresar (o saldo a favor si das negativo).' },
      { t:'Cerrar período', d:'Cuando confirmás, el período queda cerrado y no se puede modificar. Conviene cerrarlo después del 15 del mes siguiente (cuando ya cargaste todas las facturas).' }
    ],
    tips: [
      'Para que el cálculo dé bien, tenés que cargar TODAS las compras como Compras con sus respectivos costos e IVA.',
      'Antes de cerrar el período, repasá los datos. Una vez cerrado se complica modificarlo.'
    ]
  }
];

// ───────── RENDER ─────────

function renderTutoriales(){
  var c = document.getElementById('content');
  if(!c) return;

  // Agrupar por categoria
  var grupos = {};
  TUTORIALES.forEach(function(t){
    if(!grupos[t.cat]) grupos[t.cat] = [];
    grupos[t.cat].push(t);
  });

  var ico = function(n){ return (typeof NodoIco==='function') ? NodoIco(n,18) : ''; };
  var icoGrande = function(n){ return (typeof NodoIco==='function') ? NodoIco(n,22) : ''; };

  var catIco = { 'Principal':'chart', 'Catálogo':'package', 'Inventario':'box', 'Operaciones':'cash', 'Finanzas':'chart' };
  var catColor = { 'Principal':'var(--blue)', 'Catálogo':'var(--blue)', 'Inventario':'var(--green)', 'Operaciones':'var(--orange)', 'Finanzas':'var(--green)' };

  var html =
    '<div class="ph">'
      +'<div>'
        +'<div class="pt">Tutoriales</div>'
        +'<div class="ps">Aprendé a usar cada módulo del sistema paso a paso</div>'
      +'</div>'
      +'<div class="ps" style="display:flex;align-items:center;gap:6px">'+icoGrande('bulb')+' <span>'+TUTORIALES.length+' tutoriales disponibles</span></div>'
    +'</div>';

  Object.keys(grupos).forEach(function(cat){
    var color = catColor[cat] || 'var(--blue)';
    html += '<div style="margin-bottom:26px">'
      + '<div style="display:flex;align-items:center;gap:9px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:'+color+';margin-bottom:12px;padding:0 2px">'
        + ico(catIco[cat]||'box')
        + '<span>'+cat+'</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

    grupos[cat].forEach(function(t){
      html += '<div onclick="abrirTutorial(\''+t.id+'\')" class="tut-card" style="background:var(--card);border:1px solid var(--border);border-left:3px solid '+color+';border-radius:10px;padding:16px 18px;cursor:pointer;transition:transform .12s,box-shadow .12s">'
        + '<div style="display:flex;align-items:flex-start;gap:11px;margin-bottom:8px">'
          + '<div style="color:'+color+';flex-shrink:0;margin-top:1px">'+icoGrande(t.icono)+'</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.25">'+t.titulo+'</div>'
            + '<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">'+t.resumen+'</div>'
          + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:'+color+';font-weight:700;display:flex;align-items:center;gap:5px;margin-top:6px">'
          + '<span>'+t.pasos.length+' pasos</span>'
          + '<span style="opacity:.5">·</span>'
          + '<span>Ver tutorial</span>'
          + ico('chevronRight')
        + '</div>'
      + '</div>';
    });

    html += '</div></div>';
  });

  // Estilos de hover (una sola vez)
  html += '<style>.tut-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.18)}[data-theme="light"] .tut-card:hover{box-shadow:0 6px 16px rgba(0,0,40,.10)}</style>';

  c.innerHTML = html;
}

function abrirTutorial(id){
  var t = TUTORIALES.find(function(x){ return x.id === id; });
  if(!t){
    if(typeof toast==='function') toast('Tutorial no encontrado');
    return;
  }
  var c = document.getElementById('content');
  if(!c) return;

  var ico = function(n,s){ return (typeof NodoIco==='function') ? NodoIco(n, s||16) : ''; };

  // Para cada paso busca automaticamente la imagen /tutoriales-img/<id>/NN.png
  // (donde NN es el numero del paso con padding 0). Si el archivo existe en
  // el deploy de Cloudflare Pages, se muestra. Si no, queda oculta sin error.
  var pasosHtml = t.pasos.map(function(p, i){
    var nro = (i+1).toString().padStart(2,'0');
    var imgSrc = p.img || (nro + '.png'); // override manual con p.img si se quiere
    var fullSrc = '/tutoriales-img/' + t.id + '/' + imgSrc;
    var imgId = 'tutImg_' + t.id + '_' + nro;
    return '<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">'
      + '<div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--g2);color:var(--green);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;font-family:Consolas,monospace">'+(i+1)+'</div>'
      + '<div style="flex:1;padding-top:4px;min-width:0">'
        + '<div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">'+p.t+'</div>'
        + '<div style="font-size:13px;color:var(--text2);line-height:1.55">'+p.d+'</div>'
        // Imagen del paso — onerror la oculta si no existe el archivo
        + '<img id="'+imgId+'" src="'+fullSrc+'" alt="Paso '+(i+1)+'" '
          + 'onclick="abrirTutImgZoom(this.src)" '
          + 'onerror="this.style.display=\'none\'" '
          + 'style="display:block;max-width:100%;width:auto;max-height:340px;border:1px solid var(--border);border-radius:8px;margin-top:12px;cursor:zoom-in;background:var(--card2);" />'
      + '</div>'
    + '</div>';
  }).join('');

  var tipsHtml = (t.tips && t.tips.length)
    ? '<div style="background:var(--b2);border-left:3px solid var(--blue);border-radius:8px;padding:14px 16px;margin-top:24px">'
      + '<div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--blue);margin-bottom:9px">'
        + ico('bulb',14)+'<span>Tips útiles</span>'
      + '</div>'
      + t.tips.map(function(tip){ return '<div style="font-size:13px;color:var(--text);margin-bottom:7px;line-height:1.5">• '+tip+'</div>'; }).join('')
    + '</div>'
    : '';

  c.innerHTML =
    '<div class="ph">'
      +'<div>'
        +'<button onclick="renderTutoriales()" style="background:transparent;border:1px solid var(--border);border-radius:7px;color:var(--muted);padding:7px 13px;font:600 12px Barlow,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-bottom:8px">'
          +ico('chevronLeft',14)+'Volver a tutoriales'
        +'</button>'
        +'<div class="pt">'+t.titulo+'</div>'
        +'<div class="ps">'+t.resumen+'</div>'
      +'</div>'
    +'</div>'

    + '<div class="card" style="padding:18px 22px;margin-bottom:20px;background:var(--card);border-left:3px solid var(--green)">'
      + '<div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--green);margin-bottom:9px">'
        + ico('help',14)+'<span>¿Para qué sirve?</span>'
      + '</div>'
      + '<div style="font-size:14px;color:var(--text);line-height:1.6">'+t.paraQueSirve+'</div>'
    + '</div>'

    + '<div class="card" style="padding:20px 24px">'
      + '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--muted);margin-bottom:10px">Paso a paso</div>'
      + pasosHtml
    + '</div>'

    + tipsHtml;

  // Scroll arriba
  try { window.scrollTo({top:0, behavior:'smooth'}); } catch(e){}
}

// Modal de zoom para las capturas — click en la imagen abre fullscreen
function abrirTutImgZoom(src){
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;animation:tutImgFade .15s ease-out';
  ov.onclick = function(){ ov.remove(); };
  var img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6)';
  ov.appendChild(img);
  // Boton cerrar arriba a la derecha
  var btn = document.createElement('button');
  btn.innerHTML = (typeof NodoIco==='function') ? NodoIco('close',18,'#fff') : '✕';
  btn.style.cssText = 'position:absolute;top:18px;right:18px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center';
  btn.onclick = function(e){ e.stopPropagation(); ov.remove(); };
  ov.appendChild(btn);
  // Escape cierra
  var onEsc = function(e){
    if(e.key === 'Escape'){ ov.remove(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
  // CSS de animacion (una vez)
  if(!document.getElementById('tutImgFadeStyle')){
    var st = document.createElement('style');
    st.id = 'tutImgFadeStyle';
    st.textContent = '@keyframes tutImgFade{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(ov);
}
