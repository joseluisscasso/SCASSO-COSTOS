/* SCASSO — Motor de costos. Funciones puras: reciben datos + contexto y devuelven números decimales exactos.
   Nada de acá modifica datos guardados. El simulador usa el mismo motor con precios "override" en memoria. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units;
  const Z = D.of(0), ONE = D.of(1), HUNDRED = D.of(100);
  const dn = (x) => (x === undefined || x === null || x === '' ? Z : D.of(x));
  const pr = (x) => dn(x).div(HUNDRED); // "5" (%) -> 0,05

  /* ---------- costo unitario (por unidad base: g, ml, un...) de materias primas e indirectos ---------- */
  function unitCostOf(item, ctx, kind) {
    const dim = U.dim(item.unit);
    const map = ctx.over && (kind === 'm' ? ctx.over.mat : ctx.over.ind);
    if (map && map[item.id] !== undefined) return { dim, perBase: D.of(map[item.id]), overridden: true };
    const base = U.toBase(dn(item.qty), item.unit);
    if (!base.isPos()) throw new Error('La cantidad del envase debe ser mayor a cero');
    return { dim, perBase: dn(item.price).div(base), overridden: false };
  }
  // Costo por unidad de visualización (kg, l, un, h...)
  function unitCostDisp(item, ctx, kind) {
    const uc = unitCostOf(item, ctx || {}, kind || 'm');
    return { dim: uc.dim, unit: U.dispUnit(uc.dim), value: uc.perBase.mul(U.dispFactor(uc.dim)), perBase: uc.perBase };
  }

  /* ---------- una línea de ingrediente / componente ---------- */
  function lineCost(ln, ctx, stack) {
    const out = { kind: ln.kind, ref: ln.ref, bp: ln.bp, qty: dn(ln.qty), unit: ln.unit, name: '?', unitCostBase: Z, cost: Z, dim: null, error: null };
    try {
      if (!ln.ref) throw new Error('Falta elegir el ingrediente');
      const dimU = U.dim(ln.unit);
      if (out.qty.isNeg()) throw new Error('Cantidad negativa');
      if (ln.kind === 'm') {
        const m = ctx.materials[ln.ref];
        if (!m) throw new Error('La materia prima fue eliminada');
        out.name = m.name;
        const uc = unitCostOf(m, ctx, 'm');
        out.dim = uc.dim;
        if (dimU !== uc.dim) throw new Error('Unidad ' + U.label(ln.unit) + ' incompatible con ' + m.name + ' (se compra en ' + U.label(m.unit) + ')');
        out.unitCostBase = uc.perBase;
      } else if (ln.kind === 'r') {
        const sub = ctx.recipes[ln.ref];
        if (!sub) throw new Error('La receta fue eliminada');
        out.name = sub.name;
        const rc = recipeCalc(sub, ctx, stack);
        if (rc.circular) throw new Error('Referencia circular entre recetas');
        if (rc.hasErrors) out.incomplete = 'la receta "' + sub.name + '" tiene errores de cálculo: ' + rc.errors[0];
        if (ln.unit === 'porc') {
          if (rc.perPortion === null) throw new Error('"' + sub.name + '" no tiene porciones ni rendimiento definidos');
          out.dim = 'porcion'; out.unitCostBase = rc.perPortion;
        } else {
          if (rc.costPerBase === null) throw new Error('"' + sub.name + '" no tiene rendimiento definido');
          if (dimU !== rc.yieldDim) throw new Error('"' + sub.name + '" se mide en ' + U.DIMS[rc.yieldDim].label + ', no en ' + U.label(ln.unit));
          out.dim = rc.yieldDim; out.unitCostBase = rc.costPerBase;
        }
      } else if (ln.kind === 'b') {
        const sub = ctx.recipes[ln.ref];
        if (!sub) throw new Error('La receta de origen fue eliminada');
        const rc = recipeCalc(sub, ctx, stack);
        if (rc.circular) throw new Error('Referencia circular entre recetas');
        if (rc.hasErrors) out.incomplete = 'la receta "' + sub.name + '" tiene errores de cálculo: ' + rc.errors[0];
        const b = rc.byproducts.find((x) => x.id === ln.bp);
        if (!b) throw new Error('El subproducto ya no existe en "' + sub.name + '"');
        out.name = b.name + ' (de ' + sub.name + ')';
        if (b.costPerBase === null) throw new Error('El subproducto no tiene cantidad definida');
        if (dimU !== b.dim) throw new Error('Unidad incompatible con el subproducto');
        out.dim = b.dim; out.unitCostBase = b.costPerBase;
      } else throw new Error('Tipo de componente desconocido');
      out.cost = U.toBase(out.qty, ln.unit).mul(out.unitCostBase);
    } catch (e) { out.error = e.message; out.cost = Z; }
    return out;
  }

  /* ---------- asignación de costo a subproductos (coproductos) ---------- */
  // bps: [{qtyBase, dim, treatment, method, valueDisp, manualPct}]
  function allocate(total, mainQty, mainDim, mainValueDisp, bps) {
    const errors = [], allocs = bps.map(() => Z);
    const elig = (b) => b.treatment !== 'waste' && b.qtyBase.isPos();
    const w = bps.filter((b) => b.method === 'weight' && elig(b));
    if (w.length) {
      if (w.some((b) => b.dim !== mainDim)) errors.push('Asignación por peso: el subproducto debe medirse en la misma magnitud que el producto principal');
      else {
        const den = w.reduce((a, b) => a.add(b.qtyBase), mainQty);
        if (den.isPos()) w.forEach((b) => { allocs[bps.indexOf(b)] = total.mul(b.qtyBase).div(den); });
      }
    }
    const v = bps.filter((b) => b.method === 'value' && elig(b));
    if (v.length) {
      const mv = dn(mainValueDisp);
      if (!mv.isPos()) errors.push('Asignación por valor: falta el valor de venta del producto principal');
      else if (v.some((b) => !dn(b.valueDisp).isPos())) errors.push('Asignación por valor: falta el valor de venta de un subproducto');
      else {
        const mainVal = mainQty.div(U.dispFactor(mainDim)).mul(mv);
        const vals = v.map((b) => b.qtyBase.div(U.dispFactor(b.dim)).mul(dn(b.valueDisp)));
        const den = vals.reduce((a, x) => a.add(x), mainVal);
        v.forEach((b, i) => { allocs[bps.indexOf(b)] = total.mul(vals[i]).div(den); });
      }
    }
    bps.forEach((b, i) => {
      if (b.method === 'manual' && b.treatment !== 'waste') {
        const p = dn(b.manualPct);
        if (p.isNeg() || p.gt(HUNDRED)) errors.push('Asignación manual: el porcentaje debe estar entre 0 y 100');
        else allocs[i] = total.mul(p).div(HUNDRED);
      }
    });
    const sum = D.sum(allocs);
    if (sum.gt(total)) errors.push('La suma asignada a subproductos supera el costo total de la elaboración');
    return { allocs, errors };
  }

  /* ---------- rendimiento histórico real (ponderado: Σ peso final / Σ peso inicial) ---------- */
  function histYield(recipeId, ctx) {
    const bs = (ctx.batches || []).filter((b) => b.recipeId === recipeId && b.calc && b.calc.yieldDim === 'masa' && dn(b.calc.initialG).isPos() && dn(b.calc.finalBase).isPos());
    if (!bs.length) return null;
    const ini = D.sum(bs.map((b) => dn(b.calc.initialG))), fin = D.sum(bs.map((b) => dn(b.calc.finalBase)));
    return { ratio: fin.div(ini), n: bs.length };
  }

  /* ---------- receta ---------- */
  function recipeCalc(r, ctx, stack, opts) {
    stack = stack || []; opts = opts || {};
    if (!opts.noCache) { ctx.cache = ctx.cache || {}; if (ctx.cache[r.id]) return ctx.cache[r.id]; }
    if (stack.includes(r.id)) return { circular: true, costPerBase: null, perPortion: null, byproducts: [], errors: ['Referencia circular'], yieldDim: null, yieldSource: { type: 'n/a' } };
    const st = stack.concat([r.id]);
    const errors = [];
    const yieldUnit = r.yieldUnit || 'kg', yieldDim = U.dim(yieldUnit);

    const lines = (r.ingredients || []).map((i) => lineCost(i, ctx, st));
    lines.forEach((l) => (l.error || l.incomplete) && errors.push(l.name + ': ' + (l.error || l.incomplete)));
    const ingCost = D.sum(lines.map((l) => l.cost));
    // Peso inicial = suma de ingredientes SOLO si todos se miden en peso. Si hay líquidos o unidades mezclados,
    // sumar solo los gramos daría un rendimiento falso (ej. 1.451 %): en ese caso no se calcula merma ni rendimiento %.
    let initialW = Z;
    const allMass = lines.length > 0 && lines.every((l) => l.unit !== 'porc' && U.dim(l.unit) === 'masa');
    if (allMass) lines.forEach((l) => { initialW = initialW.add(U.toBase(l.qty, l.unit)); });
    const hasOverride = r.initialOverride !== undefined && r.initialOverride !== null && r.initialOverride !== '';
    if (hasOverride) initialW = U.toBase(dn(r.initialOverride), 'kg');

    // producción final aprovechable
    let finalBase = null, ySrc = { type: 'estimado', n: 0 };
    if (opts.finalBase !== undefined) { finalBase = opts.finalBase; ySrc = { type: 'tanda', n: 1 }; }
    else {
      const hist = yieldDim === 'masa' && r.useHistoric !== false ? histYield(r.id, ctx) : null;
      if (hist && initialW.isPos()) { finalBase = initialW.mul(hist.ratio); ySrc = { type: 'real', n: hist.n }; }
      else {
        const ef = dn(r.expectedFinal);
        if (ef.isPos()) finalBase = U.toBase(ef, yieldUnit);
        else errors.push('Falta definir la producción prevista (cantidad final)');
      }
    }
    if (finalBase !== null && !finalBase.isPos()) { errors.push('La producción final debe ser mayor a cero'); finalBase = null; }
    const portions = dn(r.portions);

    // costos indirectos
    const seen = {};
    const indLines = (r.indirects || []).map((x) => {
      const ln = { id: x.indirectId, name: '?', qty: dn(x.qty), unit: x.unit, basis: x.basis || 'batch', cost: Z, error: null };
      try {
        const ind = ctx.indirects[x.indirectId];
        if (!ind) throw new Error('El costo indirecto fue eliminado');
        ln.name = ind.name;
        if (seen[x.indirectId]) throw new Error('Este costo ya está incluido en la receta (evita duplicarlo)');
        seen[x.indirectId] = true;
        const uc = unitCostOf(ind, ctx, 'i');
        if (U.dim(x.unit) !== uc.dim) throw new Error('Unidad incompatible con ' + ind.name);
        let mult = ONE;
        if (ln.basis === 'kg') {
          if (yieldDim !== 'masa' || finalBase === null) throw new Error('"Por kg" requiere una elaboración medida en peso con rendimiento definido');
          mult = finalBase.div(U.dispFactor('masa'));
        } else if (ln.basis === 'unit') {
          if (yieldDim === 'cant' && finalBase !== null) mult = finalBase;
          else if (portions.isPos()) mult = portions;
          else throw new Error('"Por unidad" requiere rendimiento en unidades o porciones');
        }
        ln.cost = U.toBase(ln.qty, x.unit).mul(uc.perBase).mul(mult);
      } catch (e) { ln.error = e.message; ln.cost = Z; errors.push(ln.name + ': ' + e.message); }
      return ln;
    });
    const indCost = D.sum(indLines.map((l) => l.cost));
    const total = ingCost.add(indCost);

    // subproductos
    const bps = (r.byproducts || []).map((b) => ({
      id: b.id, name: b.name || 'Subproducto', qty: dn(b.qty), unit: b.unit || 'kg', dim: U.dim(b.unit || 'kg'),
      qtyBase: U.toBase(dn(b.qty), b.unit || 'kg'), treatment: b.treatment || 'internal', method: b.method || 'none',
      valueDisp: b.valueDisp, manualPct: b.manualPct, targetRecipeId: b.targetRecipeId,
    }));
    let al = { allocs: bps.map(() => Z), errors: [] };
    if (finalBase !== null) al = allocate(total, finalBase, yieldDim, r.mainValueDisp, bps);
    al.errors.forEach((e) => errors.push(e));
    bps.forEach((b, i) => {
      b.alloc = al.allocs[i];
      b.costPerBase = b.qtyBase.isPos() ? b.alloc.div(b.qtyBase) : null;
    });
    const allocTotal = D.sum(al.allocs);
    const mainCost = total.sub(allocTotal);
    const costPerBase = finalBase !== null ? mainCost.div(finalBase) : null;
    const res = {
      recipe: r, yieldUnit, yieldDim, lines, ingCost, indLines, indCost, total, initialW, initialIsManual: hasOverride,
      finalBase, yieldSource: ySrc, bps, byproducts: bps, allocTotal, mainCost, costPerBase, portions,
      yieldPct: yieldDim === 'masa' && initialW.isPos() && finalBase !== null ? finalBase.div(initialW) : null,
      errors, hasErrors: errors.length > 0,
    };
    res.mermaPct = res.yieldPct === null ? null : ONE.sub(res.yieldPct);
    res.mermaBase = res.yieldPct === null ? null : initialW.sub(finalBase);
    res.perKg = yieldDim === 'masa' && costPerBase ? costPerBase.mul(1000) : null;
    res.per100g = yieldDim === 'masa' && costPerBase ? costPerBase.mul(100) : null;
    res.perLiter = yieldDim === 'vol' && costPerBase ? costPerBase.mul(1000) : null;
    res.perUnit = yieldDim === 'cant' && costPerBase ? costPerBase : null;
    res.perPortion = portions.isPos() && finalBase !== null ? mainCost.div(portions) : null;
    res.rawCostPerKg = initialW.isPos() ? ingCost.div(initialW.div(1000)) : null; // costo por kg de materia prima (peso inicial)
    // costo "por unidad de visualización" (kg, l o un)
    res.perDisp = costPerBase ? costPerBase.mul(U.dispFactor(yieldDim)) : null;
    res.dispUnit = U.dispUnit(yieldDim);
    if (!opts.noCache) ctx.cache[r.id] = res;
    return res;
  }

  /* ---------- producto (variante) ---------- */
  function variantCalc(v, ctx) {
    const lines = (v.components || []).map((c) => Object.assign(lineCost(c, ctx, []), { packaging: !!c.packaging }));
    const errors = [];
    lines.forEach((l) => (l.error || l.incomplete) && errors.push(l.name + ': ' + (l.error || l.incomplete)));
    const total = D.sum(lines.map((l) => l.cost));
    const packaging = D.sum(lines.filter((l) => l.packaging).map((l) => l.cost));
    return { lines, total, packaging, food: total.sub(packaging), errors, hasErrors: errors.length > 0 };
  }

  /* ---------- rentabilidad ---------- */
  function feePct(f) { f = f || {}; return pr(f.platform).add(pr(f.payment)).add(pr(f.tax)); }
  function metrics(cost, price, fees) {
    fees = fees || {};
    cost = D.of(cost); price = D.of(price);
    const eff = price.mul(ONE.sub(pr(fees.discount)));
    const gross = eff.sub(cost);
    const m = { cost, price, effPrice: eff, gross };
    m.marginPct = eff.isPos() ? gross.div(eff) : null;       // margen sobre venta
    m.foodCost = eff.isPos() ? cost.div(eff) : null;           // costo sobre venta
    m.markup = cost.isPos() ? gross.div(cost) : null;          // recargo sobre costo
    m.saleVar = eff.mul(feePct(fees)).add(dn(fees.fixed));     // comisiones, impuestos y costos de venta
    m.contribution = gross.sub(m.saleVar);
    m.contributionPct = eff.isPos() ? m.contribution.div(eff) : null;
    return m;
  }
  // Precio = costo / (1 - margen deseado)
  function priceForMargin(cost, margin) {
    margin = D.of(margin); cost = D.of(cost);
    if (margin.gte(ONE)) throw new Error('El margen debe ser menor al 100 %');
    if (margin.isNeg()) throw new Error('El margen no puede ser negativo');
    return cost.div(ONE.sub(margin));
  }
  // Precio de lista para lograr un margen de contribución (después de comisiones, impuestos y descuento)
  function priceForContribution(cost, margin, fees) {
    fees = fees || {};
    const den = ONE.sub(D.of(margin)).sub(feePct(fees));
    if (!den.isPos()) throw new Error('Margen + comisiones + impuestos deben sumar menos de 100 %');
    const eff = D.of(cost).add(dn(fees.fixed)).div(den);
    const k = ONE.sub(pr(fees.discount));
    if (!k.isPos()) throw new Error('El descuento debe ser menor a 100 %');
    return eff.div(k);
  }

  /* ---------- planificador ---------- */
  function planRecipe(r, ctx, mode, amount) {
    const rc = recipeCalc(r, ctx);
    if (rc.costPerBase === null || rc.finalBase === null) throw new Error('La receta no tiene rendimiento definido');
    amount = D.of(amount);
    if (!amount.isPos()) throw new Error('La cantidad debe ser mayor a cero');
    let factor;
    if (mode === 'raw') {
      if (!rc.initialW.isPos()) throw new Error('La receta no tiene peso inicial (ingredientes en peso)');
      factor = U.toBase(amount, 'kg').div(rc.initialW);
    } else factor = U.toBase(amount, rc.yieldUnit).div(rc.finalBase);
    const mats = {};
    (function expand(rec, f, stack) {
      if (stack.includes(rec.id)) return;
      (rec.ingredients || []).forEach((l) => {
        const q = U.toBase(dn(l.qty), l.unit).mul(f);
        if (l.kind === 'm') { mats[l.ref] = (mats[l.ref] || Z).add(q); }
        else if (l.kind === 'r') {
          const sub = ctx.recipes[l.ref]; if (!sub) return;
          const src = recipeCalc(sub, ctx, stack);
          if (!src.finalBase) return;
          const subF = l.unit === 'porc' ? (src.portions.isPos() ? q.div(src.portions) : Z) : q.div(src.finalBase);
          expand(sub, subF, stack.concat([rec.id]));
        }
      });
    })(r, factor, []);
    const buy = Object.keys(mats).map((id) => {
      const m = ctx.materials[id]; if (!m) return null;
      const uc = unitCostOf(m, ctx, 'm');
      const need = mats[id], packBase = U.toBase(dn(m.qty), m.unit);
      const packs = need.div(packBase).sub(D.of('0.000000001')).ceil();
      const packsN = D.max(packs, need.isPos() ? ONE : Z);
      return { id, name: m.name, dim: uc.dim, needBase: need, needDisp: need.div(U.dispFactor(uc.dim)), dispUnit: U.dispUnit(uc.dim), packs: packsN, packLabel: dn(m.qty).toString() + ' ' + U.label(m.unit), costNeeded: need.mul(uc.perBase), costPacks: packsN.mul(dn(m.price)) };
    }).filter(Boolean);
    const tandas = D.max(factor.sub(D.of('0.000000001')).ceil(), ONE);
    return {
      rc, factor, tandas, buy, costNeeded: rc.total.mul(factor), mainCost: rc.mainCost.mul(factor),
      finalBase: rc.finalBase.mul(factor), rawBase: rc.initialW.mul(factor), yieldPct: rc.yieldPct,
      costPacksTotal: D.sum(buy.map((b) => b.costPacks)),
      bps: rc.bps.map((b) => ({ name: b.name, qtyBase: b.qtyBase.mul(factor), dim: b.dim })),
    };
  }

  /* ---------- tanda real: se calcula con precios del momento y se congela ---------- */
  function batchCompute(r, ctx, inp) {
    const pseudo = {
      id: '__batch__' + r.id, name: r.name, yieldUnit: r.yieldUnit, ingredients: inp.items, indirects: inp.indirects,
      byproducts: inp.bps, portions: r.portions, mainValueDisp: r.mainValueDisp, initialOverride: inp.initialOverride,
    };
    const finalBase = U.toBase(dn(inp.finalQty), r.yieldUnit || 'kg');
    return recipeCalc(pseudo, Object.assign({}, ctx, { over: null, cache: {} }), [], { finalBase, noCache: true });
  }
  function ser(x) {
    if (x instanceof D) return x.toString();
    if (Array.isArray(x)) return x.map(ser);
    if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach((k) => { if (k !== 'recipe') o[k] = ser(x[k]); }); return o; }
    return x;
  }
  function snapshotOf(rc) {
    return ser({
      yieldDim: rc.yieldDim, yieldUnit: rc.yieldUnit, lines: rc.lines, indLines: rc.indLines, ingCost: rc.ingCost, indCost: rc.indCost,
      total: rc.total, initialG: rc.initialW, finalBase: rc.finalBase, yieldPct: rc.yieldPct, mermaPct: rc.mermaPct, mermaBase: rc.mermaBase,
      bps: rc.bps, allocTotal: rc.allocTotal, mainCost: rc.mainCost, costPerBase: rc.costPerBase, perKg: rc.perKg, per100g: rc.per100g,
      perUnit: rc.perUnit, perLiter: rc.perLiter, perPortion: rc.perPortion,
    });
  }

  /* ---------- simulador de escenarios (no toca datos reales) ---------- */
  function simulate(ctx, over, recipes, products) {
    const base = Object.assign({}, ctx, { over: null, cache: {} });
    const sim = Object.assign({}, ctx, { over, cache: {} });
    const rOut = recipes.map((r) => {
      const a = recipeCalc(r, base), b = recipeCalc(r, sim);
      return { id: r.id, name: r.name, a, b, unit: a.dispUnit, costA: a.perDisp, costB: b.perDisp, totA: a.total, totB: b.total, delta: a.perDisp && b.perDisp ? b.perDisp.sub(a.perDisp) : null, deltaPct: a.perDisp && a.perDisp.isPos() && b.perDisp ? b.perDisp.sub(a.perDisp).div(a.perDisp) : null };
    });
    const pOut = [];
    products.forEach((p) => (p.variants || []).forEach((v) => {
      const a = variantCalc(v, base), b = variantCalc(v, sim);
      const price = dn(v.salePrice);
      const row = { productId: p.id, variantId: v.id, name: p.name + (v.name ? ' — ' + v.name : ''), a, b, costA: a.total, costB: b.total, delta: b.total.sub(a.total), deltaPct: a.total.isPos() ? b.total.sub(a.total).div(a.total) : null, price, hasPrice: price.isPos() };
      if (row.hasPrice) {
        row.mA = metrics(a.total, price, v.fees); row.mB = metrics(b.total, price, v.fees);
        if (row.mA.marginPct !== null && row.mA.marginPct.lt(ONE)) row.priceKeepMargin = b.total.div(ONE.sub(row.mA.marginPct));
      }
      pOut.push(row);
    }));
    return { recipes: rOut, products: pOut };
  }

  /* ---------- historial de precios ---------- */
  function priceChange(m) {
    const h = m.history || [];
    if (h.length < 2) return null;
    const a = h[h.length - 2], b = h[h.length - 1];
    const pa = dn(a.perBase), pb = dn(b.perBase);
    if (!pa.isPos()) return null;
    return { from: pa, to: pb, pct: pb.sub(pa).div(pa), date: b.date };
  }
  function historyEntry(m, date) {
    return { date: date || new Date().toISOString(), price: String(m.price), qty: String(m.qty), unit: m.unit, perBase: unitCostOf(m, {}, 'm').perBase.toString() };
  }

  SC.engine = { dn, unitCostOf, unitCostDisp, lineCost, allocate, histYield, recipeCalc, variantCalc, metrics, priceForMargin, priceForContribution, feePct, planRecipe, batchCompute, snapshotOf, simulate, priceChange, historyEntry };
})(typeof window !== 'undefined' ? window : globalThis);
