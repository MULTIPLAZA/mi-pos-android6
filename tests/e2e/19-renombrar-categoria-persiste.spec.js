// 19 — Regression: guardarCategoria() (js/productos.js, renombrar una
// categoría existente) actualizaba p.cat de TODOS los productos de esa
// categoría en memoria, pero nunca lo persistía en pos_productos.categoria --
// supaSyncTodasCategorias() solo toca la fila de la categoría en sí (tabla
// pos_categorias), nunca la columna categoria de cada producto. El rename
// quedaba solo en memoria y desaparecía en el próximo supaLoadProductos()
// (reconstruye PRODS entero desde el servidor, todavía con el nombre viejo)
// -- mismo patrón de pérdida silenciosa que guardarAsignacion() (v1.16.99),
// con más impacto: afecta a TODOS los productos de la categoría, no solo a
// los seleccionados a mano.
const { test, expect } = require('@playwright/test');

test.describe('guardarCategoria() persiste el rename en pos_productos.categoria', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.guardarCategoria === 'function' && typeof window.supaPatch === 'function',
      { timeout: 8000 }
    );
  });

  test('llama supaPatch renombrando categoria=old -> nombre nuevo', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');
      window.CATEGORIAS = [{ id: 1, nombre: 'Vieja', color: '#546e7a' }];
      window.PRODS = [
        { id: 201, name: 'Producto A', cat: 'Vieja', color: '#546e7a', colorPropio: false },
      ];

      const originalPatch = window.supaPatch;
      const originalSyncCats = window.supaSyncTodasCategorias;
      const originalUpdateColor = window.supaUpdateColorProductosCat;
      const patchCalls = [];
      window.supaPatch = function (tabla, filtro, data) { patchCalls.push({ tabla, filtro, data }); return Promise.resolve([]); };
      window.supaSyncTodasCategorias = function () { return Promise.resolve(); };
      window.supaUpdateColorProductosCat = function () { return Promise.resolve(); };

      // catEditIdx/catColorSel son `let` a nivel de página.
      catEditIdx = 0;
      catColorSel = '#546e7a'; // mismo color que el original -- no dispara el path de color
      document.getElementById('catNombreInput').value = 'Nueva';

      await window.guardarCategoria();

      window.supaPatch = originalPatch;
      window.supaSyncTodasCategorias = originalSyncCats;
      window.supaUpdateColorProductosCat = originalUpdateColor;

      return { patchCalls, prodCat: window.PRODS[0].cat };
    });

    expect(result.prodCat).toBe('Nueva'); // el rename local sí se aplica (ya lo hacía antes)

    const renameCall = result.patchCalls.find(c => c.tabla === 'pos_productos');
    expect(renameCall).toBeTruthy();
    expect(renameCall.filtro).toContain('categoria=eq.Vieja');
    expect(renameCall.data).toEqual({ categoria: 'Nueva' });
  });
});
