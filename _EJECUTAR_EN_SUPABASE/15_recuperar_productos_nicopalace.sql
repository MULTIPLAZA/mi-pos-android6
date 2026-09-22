-- FIX URGENTE 22/09/2026 -- Nico Palace Hotel (admin@nicopalace.com) reporto
-- que no le aparecen los productos de consumicion (bar/minibar) en "Articulos".
--
-- CAUSA RAIZ: pos_productos NO TENIA NINGUNA fila para esta licencia (0 rows,
-- ni siquiera soft-deleted). El codigo (js/productos.js supaUpsertProducto)
-- ya documenta este failure mode: si el guardado de un producto nuevo falla
-- por falta de internet, queda encolado SOLO en localStorage de ese
-- dispositivo -- si ese dispositivo se resetea/reinstala antes de que la cola
-- drene, el producto se pierde para siempre en la nube.
--
-- RECUPERACION: reconstrui estos 3 productos a partir del HISTORIAL DE VENTAS
-- real de Nico Palace (pos_ventas.items, JSON), que si conservaba el id/
-- nombre/precio/iva de cada venta (04/09 y 11/09/2026). No hay garantia de
-- que sea el menu completo -- solo recupera lo que efectivamente se vendio
-- en el historial disponible. Confirmar con el hotel si falta algo mas.
--
-- Idempotente: ON CONFLICT (licencia_email, id) DO NOTHING, no pisa nada si
-- ya existiera alguno de estos ids.

INSERT INTO pos_productos
  (id, nombre, precio, precio_variable, costo, codigo, categoria, iva,
   color, color_propio, mitad, inventario, comanda, activo, licencia_email, updated_at)
VALUES
  (2, 'AGUA SAN CLARA',       5000,  false, 0, '', 'Comidas', '10', '#546e7a', false, false, false, false, true, 'admin@nicopalace.com', now()),
  (4, 'KIT DE PASTA Y ESCOBA',20000, false, 0, '', 'Comidas', '10', '#546e7a', false, false, false, false, true, 'admin@nicopalace.com', now()),
  (6, 'CERVEZA MUNI',         10000, false, 0, '', 'Comidas', '10', '#546e7a', false, false, false, false, true, 'admin@nicopalace.com', now())
ON CONFLICT (licencia_email, id) DO NOTHING;
