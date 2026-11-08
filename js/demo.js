/* SCASSO — Datos de EJEMPLO (opcionales). Precios, rendimientos y ventas son ilustrativos: sirven para probar la app
   y se borran completos desde Configuración. No se cargan solos nunca. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, E = SC.engine, ST = SC.store;
  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString();

  SC.demo = {
    build(settings) {
      const S = ST.emptyState(); S.settings = settings || S.settings;
      const id = ST.uid, now = ST.now();
      const base = { ownerId: null, createdAt: now, updatedAt: now };
      const M = {};
      function mat(key, name, category, supplier, qty, unit, price, envase, hist) {
        const m = Object.assign({ id: id(), name, category, supplier, brand: '', envase: envase || '', unit, qty: String(qty), price: String(price), notes: 'Dato de ejemplo', history: [] }, base);
        (hist || []).forEach(([days, p]) => { m.price = String(p); m.history.push(E.historyEntry(m, iso(days))); m.updatedAt = iso(days); });
        if (!hist) m.history.push(E.historyEntry(m, iso(20)));
        m.price = String(price); if (hist) { const last = hist[hist.length - 1]; m.price = String(last[1]); }
        M[key] = m; S.materials.push(m); return m;
      }
      mat('cerdo', 'Carne de cerdo', 'Carnes', 'Frigorífico', 1, 'kg', 7500, '', [[40, 7000], [8, 7500]]);
      mat('sal', 'Sal gruesa', 'Especias y condimentos', 'Distribuidora', 1, 'kg', 800);
      mat('ajo', 'Ajo', 'Verduras', 'Verdulería', 1, 'kg', 6000);
      mat('romero', 'Romero seco', 'Especias y condimentos', 'Dietética', 250, 'g', 5000, 'paquete');
      mat('pimienta', 'Pimienta negra', 'Especias y condimentos', 'Dietética', 100, 'g', 4000, 'frasco');
      mat('hinojo', 'Semillas de hinojo', 'Especias y condimentos', 'Dietética', 100, 'g', 2500, 'frasco');
      mat('aceite', 'Aceite de girasol', 'Aceites y grasas', 'Distribuidora', 5, 'l', 15000, 'bidón');
      mat('huevo', 'Huevos', 'Otros', 'Granja', 1, 'docena', 3600);
      mat('limon', 'Limón', 'Frutas', 'Verdulería', 1, 'kg', 1500);
      mat('harina', 'Harina 000', 'Harinas y panificados', 'Molino', 25, 'kg', 20000, 'bolsa');
      mat('levadura', 'Levadura fresca', 'Harinas y panificados', 'Molino', 500, 'g', 4000);
      mat('papa', 'Papa', 'Verduras', 'Verdulería', 1, 'kg', 1000);
      mat('cebolla', 'Cebolla morada', 'Verduras', 'Verdulería', 1, 'kg', 2000);
      mat('vinagre', 'Vinagre de alcohol', 'Otros', 'Distribuidora', 5, 'l', 3000, 'bidón');
      mat('caja', 'Caja para sándwich', 'Envases y packaging', 'Packaging', 100, 'un', 30000, 'pack');

      const I = {};
      function ind(key, name, qty, unit, price) { const x = Object.assign({ id: id(), name, unit, qty: String(qty), price: String(price), notes: 'Dato de ejemplo' }, base); I[key] = x; S.indirects.push(x); }
      ind('gas', 'Gas (garrafa 10 kg)', 10, 'kg', 9000);
      ind('mo', 'Mano de obra', 1, 'h', 6000);

      const ing = (key, qty, unit) => ({ kind: 'm', ref: M[key].id, qty: String(qty), unit });
      const R = {};
      const rec = (key, o) => { const r = Object.assign({ id: id(), name: '', category: 'Elaboraciones base', description: '', photo: '', yieldUnit: 'kg', expectedFinal: '', portions: '', initialOverride: '', useHistoric: true, prep: '', cook: '', temp: '', procedure: '', notes: 'Receta de ejemplo', ingredients: [], indirects: [], byproducts: [], mainValueDisp: '' }, base, o); R[key] = r; S.recipes.push(r); return r; };

      const grasaId = id(), cueroId = id();
      rec('porchetta', { name: 'Porchetta SCASSO', category: 'Carnes', description: 'Porchetta artesanal cocida lentamente.', expectedFinal: '10', prep: '60', cook: '360', temp: '160',
        procedure: 'Salar y condimentar. Enrollar y atar. Cocción lenta. Reposar y porcionar.',
        ingredients: [ing('cerdo', 15, 'kg'), ing('sal', 300, 'g'), ing('ajo', 250, 'g'), ing('romero', 50, 'g'), ing('pimienta', 30, 'g'), ing('hinojo', 40, 'g')],
        indirects: [{ indirectId: I.gas.id, qty: '1.5', unit: 'kg', basis: 'batch' }, { indirectId: I.mo.id, qty: '3', unit: 'h', basis: 'batch' }],
        byproducts: [{ id: grasaId, name: 'Grasa recuperada', qty: '1.5', unit: 'kg', treatment: 'recipe', method: 'weight' }, { id: cueroId, name: 'Cuero crocante', qty: '0.8', unit: 'kg', treatment: 'sale', method: 'weight' }] });
      rec('papas', { name: 'Papas cuña', category: 'Guarniciones', expectedFinal: '4', portions: '20', description: 'Se cocinan con la grasa recuperada de la porchetta.',
        ingredients: [ing('papa', 5, 'kg'), { kind: 'b', ref: R.porchetta.id, bp: grasaId, qty: '0.3', unit: 'kg' }], indirects: [{ indirectId: I.gas.id, qty: '0.3', unit: 'kg', basis: 'batch' }] });
      rec('mayo', { name: 'Mayonesa cítrica de hierbas', category: 'Salsas', expectedFinal: '0.9',
        ingredients: [ing('aceite', 750, 'ml'), ing('huevo', 4, 'un'), ing('limon', 60, 'g'), ing('romero', 2, 'g')] });
      rec('pan', { name: 'Pan ciabatta', category: 'Panificados', yieldUnit: 'un', expectedFinal: '20', prep: '40', cook: '25', temp: '230',
        ingredients: [ing('harina', 2, 'kg'), ing('levadura', 15, 'g'), ing('sal', 40, 'g'), ing('aceite', 0.1, 'l')],
        indirects: [{ indirectId: I.gas.id, qty: '0.5', unit: 'kg', basis: 'batch' }, { indirectId: I.mo.id, qty: '1.5', unit: 'h', basis: 'batch' }] });
      rec('cebolla', { name: 'Cebolla morada encurtida', category: 'Encurtidos', expectedFinal: '2',
        ingredients: [ing('cebolla', 2, 'kg'), ing('vinagre', 0.5, 'l'), ing('sal', 40, 'g')] });

      const comp = (c) => c;
      const variant = (name, g1, g2, g3, g4, price) => ({ id: id(), name, salePrice: String(price), fees: Object.assign({}, S.settings.fees), components: [
        comp({ kind: 'r', ref: R.pan.id, qty: '1', unit: 'un' }), comp({ kind: 'r', ref: R.porchetta.id, qty: String(g1), unit: 'g' }), comp({ kind: 'r', ref: R.mayo.id, qty: String(g2), unit: 'g' }),
        comp({ kind: 'r', ref: R.cebolla.id, qty: String(g3), unit: 'g' }), comp({ kind: 'b', ref: R.porchetta.id, bp: cueroId, qty: String(g4), unit: 'g' }), comp({ kind: 'm', ref: M.caja.id, qty: '1', unit: 'un', packaging: true })] });
      S.products.push(Object.assign({ id: id(), name: 'SCASSO Signature', category: 'Sándwiches', description: 'Ciabatta, porchetta, mayonesa cítrica, cebolla morada y cuero crocante.', photo: '', variants: [variant('Estándar', 140, 25, 30, 15, 9500), variant('Grande', 200, 35, 40, 20, 12500)] }, base));

      // tandas reales de porchetta con precios del momento (la carne subió después)
      const mk = (cerdoPrice) => { const mats = {}; S.materials.forEach((m) => (mats[m.id] = Object.assign({}, m))); mats[M.cerdo.id].price = String(cerdoPrice); const rs = {}; S.recipes.forEach((r) => (rs[r.id] = r)); const is = {}; S.indirects.forEach((x) => (is[x.id] = x)); return { materials: mats, recipes: rs, indirects: is, batches: [], over: null, cache: {} }; };
      [[21, 10.2, 7000], [14, 9.75, 7000], [7, 10.5, 7500]].forEach(([days, fin, cp]) => {
        const r = R.porchetta, rc = E.batchCompute(r, mk(cp), { items: r.ingredients.map((x) => Object.assign({}, x)), indirects: r.indirects.map((x) => Object.assign({}, x)), finalQty: String(fin), initialOverride: '', bps: r.byproducts.map((b) => Object.assign({}, b)) });
        S.batches.push(Object.assign({ id: id(), recipeId: r.id, recipeName: r.name, date: iso(days).slice(0, 10), factor: '1', notes: 'Tanda de ejemplo', photo: '', calc: E.snapshotOf(rc), priceBasis: 'Precios de ejemplo' }, base, { createdAt: iso(days) }));
      });
      return { materials: S.materials, indirects: S.indirects, recipes: S.recipes, products: S.products, batches: S.batches, scenarios: [] };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
