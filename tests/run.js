// Pruebas matemáticas del motor SCASSO. Ejecutar: node tests/run.js
const fs = require('fs'), vm = require('vm'), path = require('path');
['decimal', 'units', 'format', 'engine'].forEach((f) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), { filename: f }));
const { D, units: U, fmt: F, engine: E } = globalThis.SC;
let pass = 0, fail = 0;
function eq(name, got, exp) {
  const g = got === null ? 'null' : String(got), e = String(exp);
  if (g === e) { pass++; } else { fail++; console.log('✗', name, '\n   obtenido:', g, '\n   esperado:', e); }
}
function throws(name, fn, re) { try { fn(); fail++; console.log('✗', name, '(no lanzó error)'); } catch (e) { if (re && !re.test(e.message)) { fail++; console.log('✗', name, 'mensaje:', e.message); } else pass++; } }
const d = (x) => D.of(x);

/* ---------- Decimales ---------- */
eq('0,1+0,2 exacto', d('0.1').add('0.2'), '0.3');
eq('1/3*3 redondea a 1', d(1).div(3).mul(3).toFixed(10), '1.0000000000');
eq('1e-7', d(1e-7), '0.0000001');
throws('división por cero', () => d(1).div(0), /cero/);
eq('toFixed neg', d('-1234.565').toFixed(2), '-1234.57');
eq('formato dinero', F.money(d('12500.5')), '$ 12.500,50');
eq('formato dinero neg', F.money(d('-1500')), '-$ 1.500,00');
eq('pct', F.pct(d(1).div(3)), '33,33 %');
eq('parse 12.500,50', F.parse('12.500,50'), '12500.5');
eq('parse 7.500', F.parse('7.500'), '7500');
eq('parse 7.5', F.parse('7.5'), '7.5');
eq('parse 0.250', F.parse('0.250'), '0.25');
eq('parse 1,5', F.parse('1,5'), '1.5');
eq('parse inválido', F.parse('1,5,3'), 'null');
eq('parse vacío', F.parse(''), 'null');

eq('fecha sin hora no se corre un día', F.date('2026-10-31'), '31/10/2026');

/* ---------- Unidades ---------- */
eq('250 g -> kg', U.convert(d(250), 'g', 'kg'), '0.25');
eq('2 l -> ml', U.convert(d(2), 'l', 'ml'), '2000');
eq('2 docenas -> un', U.convert(d(2), 'docena', 'un'), '24');
throws('g -> ml bloqueado', () => U.convert(d(1), 'g', 'ml'), /magnitudes distintas/);

/* ---------- Datos de prueba (precios de ejemplo, SOLO para test) ---------- */
const mats = {
  cerdo: { id: 'cerdo', name: 'Carne de cerdo', unit: 'kg', qty: '1', price: '7500' },
  sal: { id: 'sal', name: 'Sal', unit: 'kg', qty: '1', price: '800' },
  ajo: { id: 'ajo', name: 'Ajo', unit: 'kg', qty: '1', price: '6000' },
  romero: { id: 'romero', name: 'Romero seco', unit: 'g', qty: '250', price: '5000' },     // $20/g, $20.000/kg
  pimienta: { id: 'pimienta', name: 'Pimienta', unit: 'g', qty: '100', price: '4000' },   // $40/g
  hinojo: { id: 'hinojo', name: 'Hinojo', unit: 'g', qty: '100', price: '2500' },         // $25/g
  aceite: { id: 'aceite', name: 'Aceite', unit: 'l', qty: '5', price: '15000' },          // $3000/l
  huevo: { id: 'huevo', name: 'Huevos', unit: 'docena', qty: '1', price: '3600' },        // $300 c/u
  limon: { id: 'limon', name: 'Limón', unit: 'kg', qty: '1', price: '1500' },
  harina: { id: 'harina', name: 'Harina 000', unit: 'kg', qty: '25', price: '20000' },    // $800/kg
  levadura: { id: 'levadura', name: 'Levadura', unit: 'g', qty: '500', price: '4000' },   // $8/g
  agua: { id: 'agua', name: 'Agua (costo nulo)', unit: 'l', qty: '1', price: '0' },
  papa: { id: 'papa', name: 'Papa', unit: 'kg', qty: '1', price: '1000' },
  cebolla: { id: 'cebolla', name: 'Cebolla morada', unit: 'kg', qty: '1', price: '2000' },
  piel: { id: 'piel', name: 'Cuero (de otro proveedor)', unit: 'kg', qty: '1', price: '3000' },
  caja: { id: 'caja', name: 'Caja sándwich', unit: 'un', qty: '100', price: '30000' },   // $300 c/u
  gas: { id: 'gas', name: 'Gas (garrafa 10 kg)', unit: 'kg', qty: '10', price: '9000' },  // $900/kg
};
const inds = {
  gas: { id: 'gas', name: 'Gas', unit: 'kg', qty: '10', price: '9000' },
  mo: { id: 'mo', name: 'Mano de obra', unit: 'h', qty: '1', price: '6000' },
};
const R = {};
R.porchetta = {
  id: 'porchetta', name: 'Porchetta SCASSO', yieldUnit: 'kg', expectedFinal: '10', portions: '', useHistoric: true,
  ingredients: [
    { kind: 'm', ref: 'cerdo', qty: '15', unit: 'kg' }, { kind: 'm', ref: 'sal', qty: '300', unit: 'g' },
    { kind: 'm', ref: 'ajo', qty: '250', unit: 'g' }, { kind: 'm', ref: 'romero', qty: '50', unit: 'g' },
    { kind: 'm', ref: 'pimienta', qty: '30', unit: 'g' }, { kind: 'm', ref: 'hinojo', qty: '40', unit: 'g' },
  ],
  indirects: [], byproducts: [{ id: 'grasa', name: 'Grasa recuperada', qty: '1.5', unit: 'kg', treatment: 'recipe', method: 'weight' }],
};
R.papas = {
  id: 'papas', name: 'Papas cuña', yieldUnit: 'kg', expectedFinal: '4', portions: '20',
  ingredients: [{ kind: 'm', ref: 'papa', qty: '5', unit: 'kg' }, { kind: 'b', ref: 'porchetta', bp: 'grasa', qty: '0.3', unit: 'kg' }],
  indirects: [], byproducts: [],
};
R.mayo = {
  id: 'mayo', name: 'Mayonesa cítrica', yieldUnit: 'kg', expectedFinal: '0.9', portions: '',
  ingredients: [{ kind: 'm', ref: 'aceite', qty: '750', unit: 'ml' }, { kind: 'm', ref: 'huevo', qty: '4', unit: 'un' }, { kind: 'm', ref: 'limon', qty: '60', unit: 'g' }],
  indirects: [], byproducts: [],
};
R.pan = {
  id: 'pan', name: 'Ciabatta', yieldUnit: 'un', expectedFinal: '20', portions: '',
  ingredients: [{ kind: 'm', ref: 'harina', qty: '2', unit: 'kg' }, { kind: 'm', ref: 'levadura', qty: '15', unit: 'g' }, { kind: 'm', ref: 'agua', qty: '1.4', unit: 'l' }, { kind: 'm', ref: 'aceite', qty: '0.1', unit: 'l' }],
  indirects: [{ indirectId: 'gas', qty: '0.5', unit: 'kg', basis: 'batch' }, { indirectId: 'mo', qty: '1.5', unit: 'h', basis: 'batch' }], byproducts: [],
};
const mk = () => ({ materials: JSON.parse(JSON.stringify(mats)), indirects: JSON.parse(JSON.stringify(inds)), recipes: JSON.parse(JSON.stringify(R)), batches: [], over: null, cache: {} });

/* ---------- Costo unitario ---------- */
let ctx = mk();
eq('romero $/g', E.unitCostOf(mats.romero, ctx, 'm').perBase, '20');
eq('romero $/kg', E.unitCostDisp(mats.romero, ctx, 'm').value, '20000');
eq('aceite $/l', E.unitCostDisp(mats.aceite, ctx, 'm').value, '3000');
eq('aceite unidad disp', E.unitCostDisp(mats.aceite, ctx, 'm').unit, 'l');
eq('huevo $/un', E.unitCostDisp(mats.huevo, ctx, 'm').value, '300');

/* ---------- Porchetta 15 kg ---------- */
let rc = E.recipeCalc(R.porchetta, ctx);
// 112500 + 240 + 1500 + 1000 + 1200 + 1000 = 117440
eq('porchetta costo ingredientes', rc.ingCost, '117440');
eq('porchetta peso inicial g', rc.initialW, '15670');
eq('porchetta final g', rc.finalBase, '10000');
// Grasa 1,5 kg por peso: share = 1,5/(10+1,5)
const alloc = d(117440).mul('1.5').div('11.5');
eq('asignado a grasa', rc.bps[0].alloc.toFixed(6), alloc.toFixed(6));
eq('principal + subproducto = total (sin duplicar)', rc.mainCost.add(rc.allocTotal), '117440');
eq('costo por kg terminado', rc.perKg.toFixed(6), d(117440).sub(alloc).div(10).toFixed(6));
eq('costo kg grasa', rc.bps[0].costPerBase.mul(1000).toFixed(6), alloc.div('1.5').toFixed(6));
eq('sin errores', rc.hasErrors, false);

// Merma/rendimiento del enunciado: 15 kg -> 10 kg  => 33,33 % / 66,67 %
const solo = { id: 's', name: 'solo carne', yieldUnit: 'kg', expectedFinal: '10', ingredients: [{ kind: 'm', ref: 'cerdo', qty: '15', unit: 'kg' }], indirects: [], byproducts: [] };
const rs = E.recipeCalc(solo, mk());
eq('merma %', F.pct(rs.mermaPct), '33,33 %');
eq('rendimiento %', F.pct(rs.yieldPct), '66,67 %');
eq('merma kg', rs.mermaBase, '5000');
eq('costo/kg terminado = costo/kg finales (no inicial)', rs.perKg, '11250');
eq('costo por 100 g', rs.per100g, '1125');
eq('costo/kg materia prima', rs.rawCostPerKg, '7500');

/* ---------- Papas cuña con grasa recuperada: no se recarga como compra ---------- */
ctx = mk();
const rp = E.recipeCalc(R.papas, ctx);
const grasaKg = alloc.div('1.5');
eq('línea grasa = 0,3 kg × costo asignado', rp.lines[1].cost.toFixed(6), grasaKg.mul('0.3').toFixed(6));
eq('papas total = papa + grasa asignada', rp.total.toFixed(6), d(5000).add(grasaKg.mul('0.3')).toFixed(6));
eq('papas costo por porción', rp.perPortion.toFixed(6), rp.total.div(20).toFixed(6));
// Conservación: lo cargado a papas por grasa ≤ lo asignado a grasa en porchetta; no existe una compra paralela
// Si la grasa se marca "interno sin asignación", no suma costo extra a papas ni resta a porchetta
const c2 = mk(); c2.recipes.porchetta.byproducts[0].method = 'none';
const rc2 = E.recipeCalc(c2.recipes.porchetta, c2), rp2 = E.recipeCalc(c2.recipes.papas, c2);
eq('método none: porchetta conserva todo el costo', rc2.mainCost, '117440');
eq('método none: grasa en papas cuesta 0', rp2.lines[1].cost, '0');
// descarte
const c3 = mk(); c3.recipes.porchetta.byproducts[0].treatment = 'waste';
eq('descarte: no asigna', E.recipeCalc(c3.recipes.porchetta, c3).allocTotal, '0');
// manual 10 %
const c4 = mk(); Object.assign(c4.recipes.porchetta.byproducts[0], { method: 'manual', manualPct: '10' });
eq('manual 10 %', E.recipeCalc(c4.recipes.porchetta, c4).bps[0].alloc, '11744');
// manual > 100
const c5 = mk(); Object.assign(c5.recipes.porchetta.byproducts[0], { method: 'manual', manualPct: '150' });
eq('manual >100 da error', E.recipeCalc(c5.recipes.porchetta, c5).hasErrors, true);
// valor de venta: principal $12.000/kg, grasa $2.000/kg => 10*12000=120000 ; 1,5*2000=3000 -> share 3000/123000
const c6 = mk(); Object.assign(c6.recipes.porchetta, { mainValueDisp: '12000' }); Object.assign(c6.recipes.porchetta.byproducts[0], { method: 'value', valueDisp: '2000' });
eq('valor relativo', E.recipeCalc(c6.recipes.porchetta, c6).bps[0].alloc.toFixed(6), d(117440).mul(3000).div(123000).toFixed(6));
const c7 = mk(); Object.assign(c7.recipes.porchetta.byproducts[0], { method: 'value' });
eq('valor sin precio = error', E.recipeCalc(c7.recipes.porchetta, c7).hasErrors, true);

/* ---------- Salsa (mayonesa): conversiones ml / docena / g ---------- */
ctx = mk();
const rm = E.recipeCalc(R.mayo, ctx);
// 750 ml * 3 = 2250 ; 4 huevos * 300 = 1200 ; 60 g limón * 1,5 = 90  => 3540
eq('mayo costo', rm.total, '3540');
eq('mayo $/kg', rm.perKg.toFixed(6), d(3540).div(0.9).toFixed(6));
// unidad incompatible: aceite (litros) cargado en gramos -> error, no se inventa conversión
const bad = { id: 'x', name: 'x', yieldUnit: 'kg', expectedFinal: '1', ingredients: [{ kind: 'm', ref: 'aceite', qty: '100', unit: 'g' }], indirects: [], byproducts: [] };
const rb = E.recipeCalc(bad, mk());
eq('g sobre un insumo en litros: error', rb.hasErrors, true);

/* ---------- Panificado ---------- */
ctx = mk();
const rpn = E.recipeCalc(R.pan, ctx);
// harina 2*800=1600 ; levadura 15*8=120 ; agua 0 ; aceite 0,1 l*3000=300 => 2020 ; gas 0,5*900=450 ; MO 1,5*6000=9000
eq('pan ingredientes', rpn.ingCost, '2020');
eq('pan indirectos', rpn.indCost, '9450');
eq('pan total', rpn.total, '11470');
eq('pan costo por unidad', rpn.perUnit, '573.5');
// indirecto duplicado -> error
const dup = JSON.parse(JSON.stringify(R.pan)); dup.indirects.push({ indirectId: 'gas', qty: '1', unit: 'kg', basis: 'batch' });
eq('indirecto duplicado detectado', E.recipeCalc(dup, mk()).hasErrors, true);
// indirecto por kg final
const ik = { id: 'ik', name: 'ik', yieldUnit: 'kg', expectedFinal: '8', ingredients: [{ kind: 'm', ref: 'sal', qty: '1', unit: 'kg' }], indirects: [{ indirectId: 'gas', qty: '0.2', unit: 'kg', basis: 'kg' }], byproducts: [] };
eq('indirecto por kg: 0,2 kg gas × 8 kg × $900', E.recipeCalc(ik, mk()).indCost, '1440');

/* ---------- Producto: SCASSO Signature ---------- */
R.ciab1 = { id: 'ciab1', name: 'Pan', yieldUnit: 'un', expectedFinal: '1', ingredients: [{ kind: 'm', ref: 'harina', qty: '0.1', unit: 'kg' }], indirects: [], byproducts: [] };
ctx = mk(); ctx.recipes.ciab1 = R.ciab1;
const variant = {
  id: 'v1', name: 'Estándar', salePrice: '14000', fees: { platform: '10', payment: '3', tax: '0', discount: '0', fixed: '0' },
  components: [
    { kind: 'r', ref: 'pan', qty: '1', unit: 'un' },
    { kind: 'r', ref: 'porchetta', qty: '140', unit: 'g' },
    { kind: 'r', ref: 'mayo', qty: '30', unit: 'g' },
    { kind: 'm', ref: 'cebolla', qty: '40', unit: 'g' },
    { kind: 'm', ref: 'piel', qty: '15', unit: 'g' },
    { kind: 'm', ref: 'caja', qty: '1', unit: 'un', packaging: true },
  ],
};
const vc = E.variantCalc(variant, ctx);
const pan1 = rpn.perUnit, porch = rc.perKg.div(1000).mul(140), mayo = rm.perKg.div(1000).mul(30);
const expected = pan1.add(porch).add(mayo).add(d('0.04').mul(2000)).add(d('0.015').mul(3000)).add(300);
eq('signature total', vc.total.toFixed(6), expected.toFixed(6));
eq('signature packaging', vc.packaging, '300');
eq('signature sin errores', vc.hasErrors, false);
// El pan, la porchetta etc. NO están doblemente contados: suma de líneas = total
eq('suma líneas = total', D.sum(vc.lines.map((l) => l.cost)).toFixed(6), vc.total.toFixed(6));

/* ---------- Rentabilidad ---------- */
eq('precio sugerido 5000/60% = 12500', E.priceForMargin(5000, '0.6'), '12500');
throws('margen 100 %', () => E.priceForMargin(5000, 1), /menor al 100/);
let m = E.metrics(5000, 12500, {});
eq('margen sobre venta 60 %', F.pct(m.marginPct), '60,00 %');
eq('food cost 40 %', F.pct(m.foodCost), '40,00 %');
eq('markup 150 % (≠ margen)', F.pct(m.markup), '150,00 %');
eq('ganancia', m.gross, '7500');
m = E.metrics(5000, 12500, { platform: '10', payment: '3', tax: '0', discount: '10', fixed: '100' });
// efectivo = 11250 ; ganancia bruta = 6250 ; var = 11250*0.13 + 100 = 1562.5 ; contrib = 4687.5
eq('precio efectivo c/descuento', m.effPrice, '11250');
eq('bruta c/descuento', m.gross, '6250');
eq('contribución', m.contribution, '4687.5');
const pc = E.priceForContribution(5000, '0.5', { platform: '10', payment: '3', tax: '0', discount: '0', fixed: '0' });
// (5000)/(1-0.5-0.13) = 13513.5135...
eq('precio por contribución → recalcula 50 %', E.metrics(5000, pc, { platform: '10', payment: '3' }).contributionPct.toFixed(9), '0.500000000');
eq('costo 0 → markup null (sin división por cero)', E.metrics(0, 100, {}).markup, 'null');
eq('precio 0 → margen null', E.metrics(100, 0, {}).marginPct, 'null');

/* ---------- Historial de tandas: rendimiento real y congelado ---------- */
ctx = mk();
const items = (f) => R.porchetta.ingredients.map((i) => Object.assign({}, i, { qty: d(i.qty).mul(f).toString() }));
function makeBatch(finalKg, ctx) {
  const r = ctx.recipes.porchetta;
  const rcb = E.batchCompute(r, ctx, { items: items(1), indirects: [], finalQty: String(finalKg), bps: [{ id: 'grasa', name: 'Grasa', qty: '1.5', unit: 'kg', treatment: 'recipe', method: 'weight' }] });
  return { id: 'b' + finalKg, recipeId: 'porchetta', calc: E.snapshotOf(rcb) };
}
const b1 = makeBatch(10.2, ctx), b2 = makeBatch(9.75, ctx), b3 = makeBatch(10.5, ctx);
ctx.batches = [b1, b2, b3];
eq('batch1 rendimiento', F.pct(d(b1.calc.yieldPct)), F.pct(d('10.2').div('15.67')));
eq('batch total', b1.calc.total, '117440');
// el costo histórico no cambia si sube la carne
const frozen = JSON.stringify(b1);
ctx.materials.cerdo.price = '9000'; ctx.cache = {};
eq('tanda congelada tras cambio de precio', JSON.stringify(b1), frozen);
eq('batch con precio nuevo (aparte)', E.batchCompute(ctx.recipes.porchetta, ctx, { items: items(1), indirects: [], finalQty: '10', bps: [] }).ingCost, '139940');
// rendimiento histórico ponderado se usa en la receta
const hy = E.histYield('porchetta', ctx);
eq('rendimiento histórico ponderado', hy.ratio.toFixed(9), d('30.45').div('47.01').toFixed(9));
eq('n tandas', hy.n, 3);
ctx.cache = {};
const rcH = E.recipeCalc(ctx.recipes.porchetta, ctx);
eq('receta usa rendimiento real', rcH.yieldSource.type, 'real');
eq('final = inicial × rend', rcH.finalBase.toFixed(6), d(15670).mul(hy.ratio).toFixed(6));

/* ---------- Receta con ingredientes mezclados (líquidos + gramos): sin rendimiento % inventado ---------- */
const rmix = E.recipeCalc(R.mayo, mk());
eq('mayo: sin peso inicial', rmix.initialW, '0');
eq('mayo: sin rendimiento % falso', rmix.yieldPct, 'null');
eq('mayo: costo/kg sigue calculándose', rmix.perKg.toFixed(6), d(3540).div(0.9).toFixed(6));

/* ---------- Planificador ---------- */
ctx = mk();
const plan = E.planRecipe(ctx.recipes.porchetta, ctx, 'final', '30');
eq('30 kg terminados -> factor 3', plan.factor, '3');
eq('tandas', plan.tandas, '3');
eq('materia prima cruda', plan.rawBase, '47010');
eq('cerdo a comprar (g)', plan.buy.find((b) => b.id === 'cerdo').needBase, '45000');
eq('romero: 150 g -> 1 paquete de 250 g', plan.buy.find((b) => b.id === 'romero').packs, '1');
eq('costo estimado', plan.costNeeded, '352320');
const plan2 = E.planRecipe(ctx.recipes.porchetta, ctx, 'raw', '31.34');
eq('31,34 kg crudos -> factor 2', plan2.factor.toFixed(9), '2.000000000');
eq('2,0 tandas = 2 (sin sobrar una por redondeo)', plan2.tandas, '2');
// planificador expande sub-recetas
ctx.recipes.sand = { id: 'sand', name: 'Combo', yieldUnit: 'kg', expectedFinal: '1', ingredients: [{ kind: 'r', ref: 'porchetta', qty: '1', unit: 'kg' }], indirects: [], byproducts: [] };
const plan3 = E.planRecipe(ctx.recipes.sand, ctx, 'final', '10');
eq('expande sub-receta: cerdo = 15 kg', plan3.buy.find((b) => b.id === 'cerdo').needBase, '15000');
// circular
const cc = mk(); cc.recipes.a = { id: 'a', name: 'A', yieldUnit: 'kg', expectedFinal: '1', ingredients: [{ kind: 'r', ref: 'b', qty: '1', unit: 'kg' }], indirects: [], byproducts: [] };
cc.recipes.b = { id: 'b', name: 'B', yieldUnit: 'kg', expectedFinal: '1', ingredients: [{ kind: 'r', ref: 'a', qty: '1', unit: 'kg' }], indirects: [], byproducts: [] };
eq('referencia circular detectada', E.recipeCalc(cc.recipes.a, cc).hasErrors, true);

/* ---------- Simulador de escenarios ---------- */
ctx = mk();
ctx.recipes.sig = { id: 'sig', name: 'x' }; delete ctx.recipes.sig;
const product = { id: 'p1', name: 'SCASSO Signature', variants: [variant] };
const snapshot = JSON.stringify({ m: ctx.materials, r: ctx.recipes, i: ctx.indirects });
// carne de $7.500 a $9.000 por kg => por g: 9
const over = { mat: { cerdo: d(9000).div(1000).toString() } };
const sim = E.simulate(ctx, over, Object.values(ctx.recipes), [product]);
eq('datos reales intactos tras simular', JSON.stringify({ m: ctx.materials, r: ctx.recipes, i: ctx.indirects }), snapshot);
const sp = sim.recipes.find((x) => x.id === 'porchetta');
// +1500 × 15 kg = +22.500 de costo total
eq('delta total porchetta', sp.totB.sub(sp.totA), '22500');
eq('costo/kg porchetta simulado', sp.costB.toFixed(6), d(139940).sub(d(139940).mul('1.5').div('11.5')).div(10).toFixed(6));
const sv = sim.products[0];
// delta del producto = 140 g × Δ costo/g de porchetta terminada
const dPerG = sp.costB.sub(sp.costA).div(1000);
eq('delta producto = 140 g × Δ/g', sv.delta.toFixed(6), dPerG.mul(140).toFixed(6));
eq('margen simulado < margen actual', sv.mB.marginPct.lt(sv.mA.marginPct), true);
eq('precio para mantener margen', E.metrics(sv.costB, sv.priceKeepMargin, variant.fees).marginPct.toFixed(9), sv.mA.marginPct.toFixed(9));
// papas (usa grasa de porchetta) se ve afectada por el escenario
const sPapas = sim.recipes.find((x) => x.id === 'papas');
eq('papas cuña sube por la grasa asignada', sPapas.totB.gt(sPapas.totA), true);
// sin overrides => delta cero
const sim0 = E.simulate(ctx, { mat: {}, ind: {} }, Object.values(ctx.recipes), [product]);
eq('sin cambios, delta 0', sim0.products[0].delta, '0');

/* ---------- Historial de precios ---------- */
const mh = { id: 'z', name: 'z', unit: 'kg', qty: '1', price: '7500' };
mh.history = [E.historyEntry(mh, '2026-10-01')];
mh.price = '9000'; mh.history.push(E.historyEntry(mh, '2026-11-01'));
const pc2 = E.priceChange(mh);
eq('variación de precio %', F.pct(pc2.pct), '20,00 %');
eq('se conserva el anterior', mh.history[0].price, '7500');

console.log(`\n${pass} pruebas OK, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
