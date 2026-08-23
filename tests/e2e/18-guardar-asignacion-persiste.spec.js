// 18 — Regression: guardarAsignacion() (js/productos.js, botón GUARDAR de la
// pantalla "Asignar artículos" a una categoría) solo tocaba PRODS en memoria
// -- mostraba el toast de éxito ("Artículos asignados a X") pero nunca
// llamaba a dbSaveProducto()/supaUpsertProducto(). El cambio se perdía en
// silencio en la próxima carga de productos desde Supabase (o nunca llegaba
// a otro dispositivo) -- mismo patrón de pérdida silenciosa que los
// incidentes de Hotel Nico/Bodemarket. Este test confirma que cada producto
// reasignado se persiste de verdad.
const { test, expect } = require('@playwright/test');

test.describe('guardarAsignacion() persiste el cambio de categoría (no solo memoria)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.guardarAsignacion === 'function' && typeof window.supaUpsertProducto === 'function',
      { timeout: 8000 }
    );
  });

  test('llama a dbSaveProducto() y supaUpsertProducto() para cada producto reasignado', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.PRODS = [
        { id: 101, name: 'Producto A', cat: 'Vieja', color: '#111', colorPropio: false },
        { id: 102, name: 'Producto B', cat: 'Vieja', color: '#111', colorPropio: false },
        { id: 103, name: 'Producto C (no seleccionado)', cat: 'Vieja', color: '#111', colorPropio: false },
      ];
      window.CATEGORIAS = [{ nombre: 'Nueva', color: '#222' }];

      const originalUpsert = window.supaUpsertProducto;
      const originalDbSave = window.dbSaveProducto;
      const upsertedIds = [];
      const dbSavedIds = [];
      window.supaUpsertProducto = function (p) { upsertedIds.push(p.id); return Promise.resolve(); };
      window.dbSaveProducto = function (p) { dbSavedIds.push(p.id); return Promise.resolve(); };

      // asignarCatNombre/asignarSeleccionados son `let` a nivel de página --
      // hay que reasignar el identificador suelto, no window.x (mismo gotcha
      // ya documentado para admin-negocio.html).
      asignarCatNombre = 'Nueva';
      asignarSeleccionados = new Set([101, 102]);

      window.guardarAsignacion();

      window.supaUpsertProducto = originalUpsert;
      window.dbSaveProducto = originalDbSave;

      return {
        upsertedIds, dbSavedIds,
        prodACat: window.PRODS[0].cat, prodBCat: window.PRODS[1].cat, prodCCat: window.PRODS[2].cat,
        prodAColor: window.PRODS[0].color,
      };
    });

    expect(result.upsertedIds.sort()).toEqual([101, 102]);
    expect(result.dbSavedIds.sort()).toEqual([101, 102]);
    expect(result.prodACat).toBe('Nueva');
    expect(result.prodBCat).toBe('Nueva');
    expect(result.prodCCat).toBe('Vieja'); // no seleccionado, no debe tocarse
    expect(result.prodAColor).toBe('#222'); // toma el color de la categoría nueva
  });
});
