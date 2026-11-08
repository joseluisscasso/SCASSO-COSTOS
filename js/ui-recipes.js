/* SCASSO — Recetas, rendimiento, subproductos, tandas (historial) y planificador. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ui = SC.ui, esc = ui.esc, dn = E.dn;
  const METHODS = { none: 'Aprovechamiento interno sin asignación adicional', weight: 'Asignación por peso', value: 'Asignación por valor relativo de venta', manual: 'Asignación manual (% del costo)' };
  const TREAT = { internal: 'Aprovechamiento interno', recipe: 'Se usa en otra receta', sale: 'Producto comercializable', waste: 'Descarte' };
  ui.METHODS = METHODS; ui.TREAT = TREAT;
  const dispv = (x) => (x === undefined || x === null || x === '' ? '' : F.num(D.of(x), 6));
  const today = () => F.today();
  let recCat = 'Todas', ED = null, BD = null;

  ui.usageOfRecipe = function (id) {
    const S = ui.S, out = [];
    S.recipes.forEach((r) => { if (r.id !== id && (r.ingredients || []).some((i) => (i.kind === 'r' || i.kind === 'b') && i.ref === id)) out.push('Receta: ' + r.name); });
    S.products.forEach((p) => (p.variants || []).forEach((v) => { if ((v.components || []).some((c) => (c.kind === 'r' || c.kind === 'b') && c.ref === id)) out.push('Producto: ' + p.name + (v.name ? ' — ' + v.name : '')); }));
    return out;
  };
  const yieldBadge = (rc) => rc.yieldSource.type === 'real' ? '<span class="badge real">rend. real · ' + rc.yieldSource.n + ' tanda' + (rc.yieldSource.n > 1 ? 's' : '') + '</span>' : '<span class="badge est">rend. estimado</span>';
  const mainCostText = (rc) => rc.perDisp ? ui.money(rc.perDisp) + ' / ' + rc.dispUnit : '—';

  /* ================= router de la sección ================= */
  ui.views.rec = function (p) {
    const tab = p[0] === 'bat' || p[0] === 'batchview' ? 'bat' : p[0] === 'plan' ? 'plan' : 'rec';
    if (p[0] === 'view') return recView(p[1]);
    if (p[0] === 'edit') return editor(p[1]);
    if (p[0] === 'batch') return batchEditor(p[1]);
    if (p[0] === 'batchview') return batchView(p[1]);
    const seg = ui.seg([['rec', 'Recetas', '#/rec'], ['bat', 'Producciones', '#/rec/bat'], ['plan', 'Planificador', '#/rec/plan']], tab);
    if (tab === 'bat') return batchList(seg);
    if (tab === 'plan') return planner(seg);
    return recList(seg);
  };

  /* ================= listado ================= */
  function recList(seg) {
    const S = ui.S, ctx = ui.ctx();
    const cats = ['Todas'].concat(ui.CATS_REC.filter((c) => S.recipes.some((r) => r.category === c)));
    if (!cats.includes(recCat)) recCat = 'Todas';
    const list = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const cards = list.map((r) => {
      const rc = E.recipeCalc(r, ctx);
      return '<div class="card click" data-a="go" data-h="#/rec/view/' + r.id + '" data-cat="' + esc(r.category || '') + '" data-q="' + esc((r.name + ' ' + (r.category || '')).toLowerCase()) + '"><div class="row">' +
        (r.photo ? '<img class="thumb" src="' + r.photo + '" alt="">' : '') +
        '<div class="grow"><strong>' + esc(r.name) + '</strong>' + (rc.hasErrors ? ' <span class="badge up">revisar</span>' : '') + '<div class="muted small">' + esc(r.category || '') + '</div><div class="mt-s">' + yieldBadge(rc) + (rc.yieldPct ? ' <span class="badge">rend. ' + ui.pct(rc.yieldPct, 1) + '</span>' : '') + '</div></div>' +
        '<div class="num"><div class="big" style="font-size:1.15rem">' + mainCostText(rc) + '</div><div class="muted tiny">costo terminado</div></div></div></div>';
    }).join('');
    const html = seg + '<input class="search" id="recq" type="search" placeholder="Buscar receta…" autocomplete="off">' +
      '<div class="chips" id="reccats">' + cats.map((c) => '<span class="chip ' + (c === recCat ? 'on' : '') + '" data-a="recCat" data-c="' + esc(c) + '">' + esc(c) + '</span>').join('') + '</div>' +
      (list.length ? '<div id="reclist">' + cards + '</div>' : '<div class="empty">Todavía no creaste recetas.<br>Cargá primero tus materias primas y luego tocá <b>+</b>.</div>');
    return { title: 'Recetas', sub: list.length + ' elaboraciones', html, fab: 'recNew', mount() { const q = ui.$('#recq'); if (q) { q.oninput = filterRec; filterRec(); } } };
  }
  function filterRec() {
    const q = ui.$('#recq').value.trim().toLowerCase();
    ui.$$('#reclist .card').forEach((c) => { c.style.display = (!q || c.dataset.q.includes(q)) && (recCat === 'Todas' || c.dataset.cat === recCat) ? '' : 'none'; });
  }
  ui.actions.recCat = (d) => { recCat = d.c; ui.$$('#reccats .chip').forEach((c) => c.classList.toggle('on', c.dataset.c === recCat)); filterRec(); };
  ui.actions.go = (d) => { location.hash = d.h; };
  ui.actions.recNew = () => { if (!ui.S.materials.length) return ui.toast('Primero cargá al menos una materia prima', true); location.hash = '#/rec/edit/new'; };

  /* ================= detalle de receta ================= */
  function recView(id) {
    const S = ui.S, r = S.recipes.find((x) => x.id === id);
    if (!r) return { title: 'Receta', back: '#/rec', html: '<div class="err">La receta no existe.</div>' };
    const ctx = ui.ctx(), rc = E.recipeCalc(r, ctx);
    const hasW = rc.initialW.isPos();
    const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    const lines = rc.lines.map((l) => '<tr><td>' + esc(l.name) + (l.error ? '<div class="badc tiny">' + esc(l.error) + '</div>' : '') + (l.incomplete ? '<div class="badc tiny">' + esc(l.incomplete) + '</div>' : '') + '</td><td class="num">' + ui.qty(l.qty, l.unit) + '</td><td class="num">' + ui.money(l.cost) + '</td></tr>').join('');
    const ind = rc.indLines.map((l) => '<tr><td>' + esc(l.name) + '<div class="muted tiny">' + ({ batch: 'por tanda', kg: 'por kg terminado', unit: 'por unidad' }[l.basis]) + (l.error ? ' · <span class="badc">' + esc(l.error) + '</span>' : '') + '</div></td><td class="num">' + ui.qty(l.qty, l.unit) + '</td><td class="num">' + ui.money(l.cost) + '</td></tr>').join('');
    const used = (b) => { const o = []; S.recipes.forEach((x) => (x.ingredients || []).forEach((i) => { if (i.kind === 'b' && i.ref === r.id && i.bp === b.id) o.push(x.name + ' (' + F.num(dn(i.qty)) + ' ' + U.label(i.unit) + ')'); })); S.products.forEach((pp) => (pp.variants || []).forEach((v) => (v.components || []).forEach((c) => { if (c.kind === 'b' && c.ref === r.id && c.bp === b.id) o.push(pp.name); }))); return o; };
    const bps = rc.bps.map((b) => {
      const u = used(b);
      return '<div class="line"><div class="row sb"><strong>' + esc(b.name) + '</strong><span class="num">' + ui.qty(b.qty, b.unit) + '</span></div><div class="small muted">' + TREAT[b.treatment] + '</div><div class="mt-s"><span class="method">' + (b.treatment === 'waste' ? 'Descarte: sin costo asignado' : METHODS[b.method]) + '</span></div>' +
        '<div class="kv mt-s"><span class="k">Costo asignado</span><span class="v">' + ui.money(b.alloc) + '</span></div>' +
        (b.costPerBase ? '<div class="kv"><span class="k">Costo por ' + U.label(U.dispUnit(b.dim)) + '</span><span class="v">' + ui.money(b.costPerBase.mul(U.dispFactor(b.dim))) + '</span></div>' : '') +
        (u.length ? '<div class="small mt-s">Transferido a: ' + esc(u.join(', ')) + '</div>' : '') + '</div>';
    }).join('');
    const batches = S.batches.filter((b) => b.recipeId === r.id).sort((a, b) => b.date.localeCompare(a.date));
    const lastB = batches[0];
    const html = (r.photo ? '<img class="photo" src="' + r.photo + '" alt="">' : '') +
      (r.description ? '<p class="muted">' + esc(r.description) + '</p>' : '') +
      (rc.hasErrors ? '<div class="err"><b>Costo incompleto o con errores:</b><br>' + rc.errors.map(esc).join('<br>') + '</div>' : '') +
      '<div class="card hero"><div class="muted small">Costo por ' + rc.dispUnit + ' terminado ' + (rc.yieldSource.type === 'real' ? '(rend. real)' : '(estimado)') + '</div><div class="big" style="color:#fff;font-size:1.9rem">' + mainCostText(rc) + '</div><div class="muted small">Precios actuales · ' + esc(rc.allocTotal.isPos() ? 'ya descontado el costo asignado a subproductos' : 'sin subproductos asignados') + '</div></div>' +
      '<div class="card"><h3>Resumen</h3>' +
      kv('Costo total de la receta', ui.money(rc.total)) + kv('Ingredientes', ui.money(rc.ingCost)) + kv('Costos indirectos', ui.money(rc.indCost)) +
      (rc.allocTotal.isPos() ? kv('(–) Asignado a subproductos', ui.money(rc.allocTotal)) + kv('Costo imputado al producto principal', ui.money(rc.mainCost)) : '') +
      (hasW ? kv('Costo por kg de materia prima', ui.money(rc.rawCostPerKg)) + kv('Peso inicial', ui.baseQty(rc.initialW, 'masa') + (rc.initialIsManual ? ' (manual)' : '')) : '') +
      kv('Producción final aprovechable', ui.baseQty(rc.finalBase || 0, rc.yieldDim) + ' ' + yieldBadge(rc)) +
      (rc.yieldPct ? kv('Merma', ui.pct(rc.mermaPct) + ' · ' + ui.baseQty(rc.mermaBase, 'masa')) + kv('Rendimiento', ui.pct(rc.yieldPct)) : '') +
      (rc.perKg ? kv('Costo por kg terminado', ui.money(rc.perKg)) + kv('Costo por 100 g', ui.money(rc.per100g)) : '') +
      (rc.perLiter ? kv('Costo por litro', ui.money(rc.perLiter)) : '') + (rc.perUnit ? kv('Costo por unidad', ui.money(rc.perUnit)) : '') +
      (rc.perPortion ? kv('Costo por porción (' + F.num(rc.portions) + ')', ui.money(rc.perPortion)) : '') +
      (lastB ? kv('Última tanda real (' + ui.date(lastB.date) + ')', (lastB.calc.perKg ? ui.money(lastB.calc.perKg) + ' / kg' : ui.money(lastB.calc.total)) + ' · <a href="#/rec/batchview/' + lastB.id + '">ver</a>') : '') + '</div>' +
      '<div class="card"><h3>Ingredientes <span class="badge est">precios actuales</span></h3><div class="scrollx"><table class="tbl"><thead><tr><th>Ingrediente</th><th class="num">Cantidad</th><th class="num">Costo</th></tr></thead><tbody>' + lines + '</tbody><tfoot><tr><td colspan="2">Total ingredientes</td><td class="num">' + ui.money(rc.ingCost) + '</td></tr></tfoot></table></div>' +
      (ind ? '<h3 class="mt">Costos indirectos</h3><div class="scrollx"><table class="tbl"><tbody>' + ind + '</tbody><tfoot><tr><td colspan="2">Total indirectos</td><td class="num">' + ui.money(rc.indCost) + '</td></tr></tfoot></table></div>' : '') + '</div>' +
      (bps ? '<div class="card"><h3>Subproductos y coproductos</h3><div class="mt-s">' + bps + '</div></div>' : '') +
      ((r.procedure || r.prep || r.cook || r.temp || r.notes) ? '<div class="card"><h3>Elaboración</h3>' + ((r.prep || r.cook || r.temp) ? '<div class="small muted">' + [r.prep && 'Preparación: ' + esc(r.prep) + ' min', r.cook && 'Cocción: ' + esc(r.cook) + ' min', r.temp && 'Temperatura: ' + esc(r.temp) + ' °C'].filter(Boolean).join(' · ') + '</div>' : '') + (r.procedure ? '<p style="white-space:pre-wrap">' + esc(r.procedure) + '</p>' : '') + (r.notes ? '<p class="small muted" style="white-space:pre-wrap">' + esc(r.notes) + '</p>' : '') + '</div>' : '') +
      '<div class="btns noprint"><button class="btn terra" data-a="batchNew" data-id="' + r.id + '" type="button">Registrar tanda</button><button class="btn" data-a="go" data-h="#/rec/edit/' + r.id + '" type="button">Editar</button><button class="btn sec" data-a="recPlan" data-id="' + r.id + '" type="button">Planificar</button><button class="btn sec" data-a="recDup" data-id="' + r.id + '" type="button">Duplicar</button><button class="btn danger" data-a="recDel" data-id="' + r.id + '" type="button">Eliminar</button></div>';
    return { title: r.name, sub: r.category, back: '#/rec', html };
  }
  ui.actions.batchNew = (d) => { location.hash = '#/rec/batch/' + d.id; };
  ui.actions.recPlan = (d) => { ui.planPre = d.id; location.hash = '#/rec/plan'; };
  ui.actions.recDup = (d) => {
    const r = JSON.parse(JSON.stringify(ui.S.recipes.find((x) => x.id === d.id)));
    r.id = ui.uid(); r.name += ' (copia)'; r.createdAt = SC.store.now(); r.updatedAt = r.createdAt;
    (r.byproducts || []).forEach((b) => (b.id = ui.uid()));
    ui.S.recipes.push(r); ui.commit({ quiet: true }); location.hash = '#/rec/edit/' + r.id; ui.toast('Receta duplicada');
  };
  ui.actions.recDel = async (d) => {
    const r = ui.S.recipes.find((x) => x.id === d.id), use = ui.usageOfRecipe(r.id);
    if (use.length) return ui.sheet({ title: 'No se puede eliminar', html: '<div class="err">"' + esc(r.name) + '" está en uso:<br>' + use.map(esc).join('<br>') + '</div>' });
    const nb = ui.S.batches.filter((b) => b.recipeId === r.id).length;
    if (await ui.confirm('¿Eliminar la receta "' + r.name + '"?' + (nb ? ' Sus ' + nb + ' tanda(s) registradas se conservan en el historial.' : ''))) {
      ui.S.recipes = ui.S.recipes.filter((x) => x.id !== r.id); ui.commit({ quiet: true }); location.hash = '#/rec'; ui.toast('Receta eliminada');
    }
  };

  /* ================= editor de receta ================= */
  function toDraft(r) {
    const c = JSON.parse(JSON.stringify(r));
    ['expectedFinal', 'portions', 'initialOverride', 'mainValueDisp'].forEach((k) => (c[k] = dispv(c[k])));
    c.ingredients.forEach((i) => (i.qty = dispv(i.qty)));
    c.indirects.forEach((i) => (i.qty = dispv(i.qty)));
    c.byproducts.forEach((b) => { b.qty = dispv(b.qty); b.valueDisp = dispv(b.valueDisp); b.manualPct = dispv(b.manualPct); });
    return c;
  }
  const blankRecipe = () => ({ id: ui.uid(), name: '', category: 'Elaboraciones base', description: '', photo: '', yieldUnit: 'kg', expectedFinal: '', portions: '', initialOverride: '', useHistoric: true, prep: '', cook: '', temp: '', procedure: '', notes: '', ingredients: [], indirects: [], byproducts: [], mainValueDisp: '', createdAt: SC.store.now(), ownerId: null });
  // draft (texto) -> receta con números canónicos para el motor
  function canon(d) {
    const errs = [];
    const P = (raw, label, o) => { const v = ui.readNum(raw, label, errs, o); return v === null ? '' : v.toString(); };
    const r = Object.assign({}, d, {
      expectedFinal: P(d.expectedFinal, 'Producción prevista', { nonneg: true }), portions: P(d.portions, 'Porciones', { nonneg: true }),
      initialOverride: P(d.initialOverride, 'Peso inicial', { nonneg: true }), mainValueDisp: P(d.mainValueDisp, 'Valor de venta del producto principal', { nonneg: true }),
      ingredients: d.ingredients.map((x, i) => Object.assign({}, x, { qty: P(x.qty, 'Ingrediente ' + (i + 1) + ': cantidad', { nonneg: true }) })),
      indirects: d.indirects.map((x, i) => Object.assign({}, x, { qty: P(x.qty, 'Indirecto ' + (i + 1) + ': cantidad', { nonneg: true }) })),
      byproducts: d.byproducts.map((b, i) => Object.assign({}, b, { qty: P(b.qty, 'Subproducto ' + (i + 1) + ': cantidad', { nonneg: true }), valueDisp: P(b.valueDisp, 'Subproducto ' + (i + 1) + ': valor de venta', { nonneg: true }), manualPct: P(b.manualPct, 'Subproducto ' + (i + 1) + ': porcentaje', { nonneg: true, max: 100 }) })),
    });
    return { r, errs };
  }
  function editor(id) {
    const S = ui.S, isNew = id === 'new', orig = isNew ? null : S.recipes.find((r) => r.id === id);
    if (!isNew && !orig) return { title: 'Receta', back: '#/rec', html: '<div class="err">La receta no existe.</div>' };
    ED = { d: isNew ? blankRecipe() : toDraft(orig), orig, isNew };
    const html = '<div id="ed"></div>';
    return {
      title: isNew ? 'Nueva receta' : 'Editar receta', back: isNew ? '#/rec' : '#/rec/view/' + id, html,
      mount() { paint(); ui.inputHandler = edInput; },
    };
  }
  function paint() {
    const sy = g.scrollY;
    ui.$('#ed').innerHTML = edHTML(ED.d);
    ui.bindPhoto(ui.$('#ed'), () => ED.d.photo, (v) => (ED.d.photo = v));
    live(); g.scrollTo(0, sy);
  }
  function edHTML(d) {
    const B = (p) => ' data-bind="' + p + '"';
    const numIn = (p, v, ph) => '<input class="in" type="text" inputmode="decimal" autocomplete="off" data-num placeholder="' + esc(ph || '') + '" value="' + esc(v || '') + '"' + B(p) + '>';
    const ing = d.ingredients.map((x, i) => {
      const units = x.ref ? ui.unitsForRef(x.kind, x.ref, x.bp) : [];
      return '<div class="line"><div class="row"><select class="in grow" data-ref="ingredients.' + i + '"' + B('ingredients.' + i + '.refv') + '>' + ui.refSelect(ui.refValue(x), { excludeRecipe: d.id }) + '</select><button class="x" type="button" data-a="edRemove" data-list="ingredients" data-i="' + i + '" aria-label="Quitar">×</button></div>' +
        '<div class="grid3 mt-s">' + numIn('ingredients.' + i + '.qty', x.qty, 'Cantidad') + '<select class="in"' + B('ingredients.' + i + '.unit') + '>' + ui.unitOpts(units, x.unit) + '</select><div class="num small"><span class="ci" data-k="ing" data-i="' + i + '">—</span></div></div></div>';
    }).join('');
    const ind = d.indirects.map((x, i) => {
      const ii = S().indirects.find((y) => y.id === x.indirectId), units = ii ? U.unitsOfDim(U.dim(ii.unit)) : [];
      return '<div class="line"><div class="row"><select class="in grow" data-indsel="' + i + '"' + B('indirects.' + i + '.indirectId') + '><option value="">— Elegir costo —</option>' + ui.opts(S().indirects.map((y) => [y.id, y.name]), x.indirectId) + '</select><button class="x" type="button" data-a="edRemove" data-list="indirects" data-i="' + i + '">×</button></div>' +
        '<div class="grid3 mt-s">' + numIn('indirects.' + i + '.qty', x.qty, 'Cantidad') + '<select class="in"' + B('indirects.' + i + '.unit') + '>' + ui.unitOpts(units, x.unit) + '</select><div class="num small"><span class="ci" data-k="ind" data-i="' + i + '">—</span></div></div>' +
        '<select class="in mt-s"' + B('indirects.' + i + '.basis') + '>' + ui.opts([['batch', 'Cantidad por tanda completa'], ['kg', 'Cantidad por kg terminado'], ['unit', 'Cantidad por unidad / porción']], x.basis) + '</select></div>';
    }).join('');
    const bps = d.byproducts.map((b, i) => '<div class="line">' +
      '<div class="row"><input class="in grow" type="text" placeholder="Nombre (ej. Grasa recuperada)" value="' + esc(b.name) + '"' + B('byproducts.' + i + '.name') + '><button class="x" type="button" data-a="edRemove" data-list="byproducts" data-i="' + i + '">×</button></div>' +
      '<div class="grid2 mt-s">' + numIn('byproducts.' + i + '.qty', b.qty, 'Cantidad recuperada') + '<select class="in"' + B('byproducts.' + i + '.unit') + '>' + ui.unitOpts(['kg', 'g', 'l', 'ml', 'un'], b.unit) + '</select></div>' +
      '<select class="in mt-s"' + B('byproducts.' + i + '.treatment') + ' data-rerender>' + ui.opts(Object.keys(TREAT).map((k) => [k, TREAT[k]]), b.treatment) + '</select>' +
      (b.treatment === 'recipe' ? '<div class="small muted mt-s">Para usarlo, agregalo como ingrediente en la otra receta (grupo “Subproductos recuperados”). Así no se carga como compra nueva.</div>' : '') +
      (b.treatment !== 'waste' ? '<select class="in mt-s"' + B('byproducts.' + i + '.method') + ' data-rerender>' + ui.opts(Object.keys(METHODS).map((k) => [k, METHODS[k]]), b.method) + '</select>' : '') +
      (b.method === 'value' && b.treatment !== 'waste' ? '<div class="mt-s small muted">Valor de venta por ' + U.label(U.dispUnit(U.dim(b.unit))) + ' del subproducto ($)</div>' + numIn('byproducts.' + i + '.valueDisp', b.valueDisp, 'Valor de venta') : '') +
      (b.method === 'manual' && b.treatment !== 'waste' ? '<div class="mt-s small muted">% del costo total que se le asigna</div>' + numIn('byproducts.' + i + '.manualPct', b.manualPct, 'Ej.: 10') : '') +
      '<div class="small mt-s"><span class="cb" data-i="' + i + '"></span></div></div>').join('');
    const needMainVal = d.byproducts.some((b) => b.method === 'value' && b.treatment !== 'waste');
    return '<div class="errs"></div><div class="card">' +
      ui.tf({ name: 'name', label: 'Nombre de la receta', value: d.name, bind: 'name', ph: 'Ej.: Porchetta SCASSO' }) +
      ui.sf({ name: 'category', label: 'Categoría', options: ui.CATS_REC, value: d.category, bind: 'category' }) +
      ui.tf({ name: 'description', label: 'Descripción', value: d.description, bind: 'description', area: true }) +
      ui.photoField(d.photo) + '</div>' +
      '<div class="card"><h3>Producción final</h3><div class="grid2 mt-s"><label class="f"><span>Producción prevista</span>' + numIn('expectedFinal', d.expectedFinal, 'Ej.: 10') + '</label><label class="f"><span>Unidad</span><select class="in"' + B('yieldUnit') + ' data-rerender>' + ui.unitOpts(U.YIELD_UNITS, d.yieldUnit) + '</select></label></div>' +
      '<div class="small muted mb">Es lo que sale terminado, ya sin merma (ej.: 15 kg de carne cruda → 10 kg cocidos).</div>' +
      '<label class="f"><span>Peso inicial total (kg) — opcional</span>' + numIn('initialOverride', d.initialOverride, 'Vacío = suma de ingredientes en peso') + '<span class="hint" id="iniHint"></span></label>' +
      '<label class="f"><span>Porciones por producción (opcional)</span>' + numIn('portions', d.portions, 'Ej.: 20') + '</label>' +
      '<label class="row" style="margin-bottom:8px"><input type="checkbox" ' + (d.useHistoric ? 'checked' : '') + B('useHistoric') + ' style="width:22px;height:22px"><span class="small">Usar el rendimiento real de las tandas registradas (si hay)</span></label></div>' +
      '<div class="card"><h3>Ingredientes</h3><div class="mt-s">' + (ing || '<div class="muted small">Agregá los ingredientes desde tu base de materias primas.</div>') + '</div><button class="btn sec block" type="button" data-a="edAdd" data-list="ingredients">+ Agregar ingrediente</button></div>' +
      '<div class="card"><h3>Subproductos / coproductos</h3><div class="small muted">Grasa, cuero, jugos, recortes… elegí qué hacer con cada uno. El costo asignado se resta de la elaboración principal para no duplicarlo.</div><div class="mt">' + bps + '</div>' + (needMainVal ? '<label class="f"><span>Valor de venta del producto principal por ' + U.label(U.dispUnit(U.dim(d.yieldUnit))) + ' ($)</span>' + numIn('mainValueDisp', d.mainValueDisp, '') + '</label>' : '') + '<button class="btn sec block" type="button" data-a="edAdd" data-list="byproducts">+ Agregar subproducto</button></div>' +
      '<div class="card"><h3>Costos indirectos</h3><div class="mt-s">' + (ind || '<div class="muted small">Gas, mano de obra, film, etc. No se pueden repetir en una misma receta.</div>') + '</div><button class="btn sec block" type="button" data-a="edAdd" data-list="indirects">+ Agregar costo indirecto</button></div>' +
      '<div class="card"><h3>Elaboración</h3><div class="grid3 mt-s"><label class="f"><span>Prep. (min)</span>' + numIn('prep', d.prep) + '</label><label class="f"><span>Cocción (min)</span>' + numIn('cook', d.cook) + '</label><label class="f"><span>Temp. (°C)</span>' + numIn('temp', d.temp) + '</label></div>' +
      ui.tf({ name: 'procedure', label: 'Procedimiento', value: d.procedure, bind: 'procedure', area: true }) + ui.tf({ name: 'notes', label: 'Observaciones', value: d.notes, bind: 'notes', area: true }) + '</div>' +
      '<div class="stickybar"><div class="grid3"><div><div class="k">Costo total</div><div class="v" id="lvTot">—</div></div><div><div class="k" id="lvKL">Costo / kg</div><div class="v" id="lvKg">—</div></div><div><div class="k">Rendimiento</div><div class="v" id="lvY">—</div></div></div></div>' +
      '<div class="btns mt"><button class="btn" type="button" data-a="edSave">Guardar receta</button><button class="btn sec" type="button" data-a="edCancel">Cancelar</button></div>';
  }
  const S = () => ui.S;

  function edInput(e, type) {
    if (!ED) return;
    const el = e.target, path = el.dataset && el.dataset.bind;
    if (!path) return;
    const d = ED.d;
    if (el.dataset.ref !== undefined) {
      if (type !== 'change') return;
      const row = ui.getPath(d, el.dataset.ref), ref = ui.parseRef(el.value);
      Object.assign(row, { kind: ref.kind, ref: ref.ref, bp: ref.bp });
      row.unit = ui.defaultUnit(ref.kind, ref.ref, ref.bp);
      return paint();
    }
    if (el.dataset.indsel !== undefined) {
      if (type !== 'change') return;
      const row = d.indirects[+el.dataset.indsel], ii = S().indirects.find((y) => y.id === el.value);
      row.indirectId = el.value; if (ii) row.unit = ii.unit;
      return paint();
    }
    ui.setPath(d, path, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.rerender !== undefined) { if (type === 'change') return paint(); return; }
    live();
  }
  function live() {
    const ed = ui.$('#ed'); if (!ed || !ED) return;
    const { r, errs } = canon(ED.d), ctx = ui.ctx(null, { [r.id]: r }), rc = E.recipeCalc(r, ctx);
    ui.$$('.ci', ed).forEach((c) => {
      const i = +c.dataset.i, l = c.dataset.k === 'ing' ? rc.lines[i] : rc.indLines[i];
      if (!l) return;
      c.innerHTML = l.error ? '<span class="badc tiny">' + esc(l.error) + '</span>' : ui.money(l.cost);
    });
    ui.$$('.cb', ed).forEach((c) => {
      const b = rc.bps[+c.dataset.i]; if (!b) return;
      c.innerHTML = b.treatment === 'waste' ? 'Sin costo asignado (descarte)' : 'Costo asignado: <b>' + ui.money(b.alloc) + '</b>' + (b.costPerBase ? ' · ' + ui.money(b.costPerBase.mul(U.dispFactor(b.dim))) + ' por ' + U.label(U.dispUnit(b.dim)) : '');
    });
    ui.$('#lvTot', ed).textContent = ui.money(rc.total);
    ui.$('#lvKL', ed).textContent = 'Costo / ' + rc.dispUnit + ' terminado';
    ui.$('#lvKg', ed).textContent = rc.perDisp ? ui.money(rc.perDisp) : '—';
    ui.$('#lvY', ed).textContent = rc.yieldPct ? ui.pct(rc.yieldPct, 1) : '—';
    const ih = ui.$('#iniHint', ed); if (ih) ih.textContent = 'Calculado desde ingredientes: ' + (rc.initialIsManual ? 'manual' : ui.baseQty(rc.initialW, 'masa'));
    const msgs = rc.errors.filter((x) => !/Falta definir la producción prevista/.test(x) || (ED.d.expectedFinal || '').trim());
    const box = ui.$('.errs', ed);
    box.innerHTML = (msgs.length || errs.length) ? '<div class="warn"><b>Revisar:</b><br>' + msgs.concat(errs).map((x) => '• ' + esc(x)).join('<br>') + '</div>' : '';
  }
  ui.actions.edAdd = (d) => {
    const list = ED.d[d.list];
    if (d.list === 'ingredients') list.push({ kind: 'm', ref: '', unit: 'g', qty: '' });
    if (d.list === 'indirects') list.push({ indirectId: '', unit: 'kg', basis: 'batch', qty: '' });
    if (d.list === 'byproducts') list.push({ id: ui.uid(), name: '', qty: '', unit: 'kg', treatment: 'internal', method: 'none', valueDisp: '', manualPct: '' });
    paint();
  };
  ui.actions.edRemove = (d) => { ED.d[d.list].splice(+d.i, 1); paint(); };
  ui.actions.edCancel = () => { history.back(); };
  ui.actions.edSave = () => {
    const d = ED.d, { r, errs } = canon(d), ctx = ui.ctx(null, { [r.id]: r });
    if (!d.name.trim()) errs.push('Completá el nombre de la receta');
    if (!r.ingredients.length) errs.push('Agregá al menos un ingrediente');
    r.ingredients.forEach((x, i) => { if (!x.ref) errs.push('Ingrediente ' + (i + 1) + ': elegí qué es'); else if (!dn(x.qty).isPos()) errs.push('Ingrediente ' + (i + 1) + ': la cantidad debe ser mayor a cero'); });
    r.indirects.forEach((x, i) => { if (!x.indirectId) errs.push('Costo indirecto ' + (i + 1) + ': elegí cuál'); else if (!dn(x.qty).isPos()) errs.push('Costo indirecto ' + (i + 1) + ': cantidad mayor a cero'); });
    r.byproducts.forEach((b, i) => { if (!b.name.trim()) errs.push('Subproducto ' + (i + 1) + ': falta el nombre'); if (!dn(b.qty).isPos()) errs.push('Subproducto ' + (i + 1) + ': cantidad mayor a cero'); });
    if (!dn(r.expectedFinal).isPos()) errs.push('Indicá la producción prevista (cantidad final aprovechable)');
    const rc = E.recipeCalc(r, ctx);
    rc.errors.forEach((x) => { if (!errs.includes(x) && !/producción prevista/.test(x)) errs.push(x); });
    if (!ED.isNew && U.dim(r.yieldUnit) !== U.dim(ED.orig.yieldUnit || 'kg') && ui.usageOfRecipe(r.id).length) errs.push('No se puede cambiar la unidad de rendimiento a otra magnitud: otras recetas o productos la usan.');
    const dupb = new Set(); r.byproducts.forEach((b) => dupb.add(b.name.trim().toLowerCase())); if (dupb.size !== r.byproducts.length) errs.push('Hay subproductos con el mismo nombre');
    if (errs.length) return ui.showErrs(ui.$('#ed'), errs);
    r.name = r.name.trim(); r.updatedAt = SC.store.now();
    delete r.refv;
    const S2 = ui.S, i = S2.recipes.findIndex((x) => x.id === r.id);
    if (i >= 0) S2.recipes[i] = r; else S2.recipes.push(r);
    ui.commit({ quiet: true }); ED = null; ui.inputHandler = null; location.hash = '#/rec/view/' + r.id; ui.toast('Receta guardada');
  };

  /* ================= registrar tanda ================= */
  function batchEditor(rid) {
    const S2 = ui.S, r = S2.recipes.find((x) => x.id === rid);
    if (!r) return { title: 'Tanda', back: '#/rec', html: '<div class="err">La receta no existe.</div>' };
    const ctx = ui.ctx(), rc = E.recipeCalc(r, ctx);
    const f0 = ui.pendingFactor ? ui.pendingFactor : '1'; ui.pendingFactor = null;
    BD = {
      r, rc, d: {
        date: today(), factor: F.num(D.of(f0), 6), finalQty: '', initialOverride: '', notes: '', photo: '',
        items: r.ingredients.map((x) => ({ kind: x.kind, ref: x.ref, bp: x.bp, unit: x.unit, base: x.qty, qty: '' })),
        indirects: (r.indirects || []).map((x) => ({ indirectId: x.indirectId, unit: x.unit, basis: x.basis, base: x.qty, qty: '' })),
        bps: (r.byproducts || []).map((b) => ({ id: b.id, name: b.name, unit: b.unit, treatment: b.treatment, method: b.method, valueDisp: b.valueDisp, manualPct: b.manualPct, base: b.qty, qty: '' })),
      },
    };
    scaleBatch();
    return { title: 'Registrar tanda', sub: r.name, back: '#/rec/view/' + rid, html: '<div id="bd"></div>', mount() { bpaint(); ui.inputHandler = bInput; } };
  }
  function scaleBatch() {
    const f = F.parse(BD.d.factor); if (!f || !f.isPos()) return;
    BD.d.items.forEach((x) => (x.qty = F.num(dn(x.base).mul(f), 6)));
    BD.d.indirects.forEach((x) => (x.qty = F.num(x.basis === 'batch' ? dn(x.base).mul(f) : dn(x.base), 6)));
    BD.d.bps.forEach((b) => (b.qty = F.num(dn(b.base).mul(f), 6)));
  }
  function bpaint() {
    const d = BD.d, r = BD.r, sy = g.scrollY, B = (p) => ' data-bind="' + p + '"';
    const num = (p, v, ph) => '<input class="in" type="text" inputmode="decimal" autocomplete="off" data-num placeholder="' + esc(ph || '') + '" value="' + esc(v || '') + '"' + B(p) + '>';
    const ctx = ui.ctx();
    const nm = (x) => { const l = E.lineCost({ kind: x.kind, ref: x.ref, bp: x.bp, qty: '0', unit: x.unit }, ctx, []); return l.name; };
    ui.$('#bd').innerHTML = '<div class="errs"></div><div class="info small">Cargá lo que <b>realmente</b> usaste y obtuviste. Los costos se congelan con los precios de hoy y no cambian si luego sube la materia prima.</div>' +
      '<div class="card"><div class="grid2"><label class="f"><span>Fecha</span><input class="in" type="date" value="' + d.date + '"' + B('date') + '></label><label class="f"><span>Tandas de la receta (multiplicador)</span><input class="in" type="text" inputmode="decimal" data-num value="' + esc(d.factor) + '"' + B('factor') + ' data-rescale></label></div><div class="small muted">Rellena las cantidades según la receta × el multiplicador. Podés corregir cada una.</div></div>' +
      '<div class="card"><h3>Ingredientes realmente usados</h3><div class="mt-s">' + d.items.map((x, i) => '<div class="line"><div class="row sb"><strong class="small">' + esc(nm(x)) + '</strong><span class="small num"><span class="ci" data-k="it" data-i="' + i + '"></span></span></div><div class="grid2 mt-s">' + num('items.' + i + '.qty', x.qty, 'Cantidad usada') + '<div class="in" style="display:flex;align-items:center;background:#f3eddb">' + U.label(x.unit) + '</div></div></div>').join('') + '</div></div>' +
      '<div class="card"><h3>Pesos y rendimiento</h3><div class="mt-s"><label class="f"><span>Peso inicial total (kg) — opcional</span>' + num('initialOverride', d.initialOverride, 'Vacío = suma de ingredientes en peso') + '</label>' +
      '<label class="f"><span>Producción final real (' + U.label(r.yieldUnit || 'kg') + ')</span>' + num('finalQty', d.finalQty, 'Ej.: 10,2') + '<span class="hint">Prevista en la receta: ' + F.num(dn(r.expectedFinal)) + ' ' + U.label(r.yieldUnit || 'kg') + '</span></label></div></div>' +
      (d.bps.length ? '<div class="card"><h3>Subproductos recuperados</h3><div class="mt-s">' + d.bps.map((b, i) => '<div class="line"><div class="row sb"><strong class="small">' + esc(b.name) + '</strong><span class="badge">' + esc(b.treatment === 'waste' ? 'Descarte' : METHODS[b.method].split(' ').slice(0, 3).join(' ')) + '</span></div><div class="grid2 mt-s">' + num('bps.' + i + '.qty', b.qty, 'Cantidad real') + '<div class="in" style="display:flex;align-items:center;background:#f3eddb">' + U.label(b.unit) + '</div></div><div class="small mt-s"><span class="cb" data-i="' + i + '"></span></div></div>').join('') + '</div></div>' : '') +
      (d.indirects.length ? '<div class="card"><h3>Costos indirectos de la tanda</h3><div class="mt-s">' + d.indirects.map((x, i) => '<div class="line"><div class="row sb"><strong class="small">' + esc((ui.S.indirects.find((y) => y.id === x.indirectId) || { name: '?' }).name) + '</strong><span class="small num"><span class="ci" data-k="in" data-i="' + i + '"></span></span></div><div class="grid2 mt-s">' + num('indirects.' + i + '.qty', x.qty, 'Cantidad') + '<div class="in" style="display:flex;align-items:center;background:#f3eddb">' + U.label(x.unit) + ' · ' + ({ batch: 'tanda', kg: 'por kg', unit: 'por unidad' }[x.basis]) + '</div></div></div>').join('') + '</div></div>' : '') +
      '<div class="card">' + ui.photoField(d.photo) + ui.tf({ name: 'notes', label: 'Observaciones de la tanda', value: d.notes, bind: 'notes', area: true }) + '</div>' +
      '<div class="stickybar"><div class="grid3"><div><div class="k">Costo total tanda</div><div class="v" id="bT">—</div></div><div><div class="k" id="bKL">Costo / kg</div><div class="v" id="bK">—</div></div><div><div class="k">Rendimiento</div><div class="v" id="bY">—</div></div></div></div>' +
      '<div class="btns mt"><button class="btn" type="button" data-a="batchSave">Guardar tanda</button><button class="btn sec" type="button" data-a="edCancel">Cancelar</button></div>';
    ui.bindPhoto(ui.$('#bd'), () => d.photo, (v) => (d.photo = v));
    blive(); g.scrollTo(0, sy);
  }
  function bInput(e, type) {
    if (!BD) return;
    const el = e.target, path = el.dataset && el.dataset.bind; if (!path) return;
    ui.setPath(BD.d, path, el.value);
    if (el.dataset.rescale !== undefined) { if (type === 'change') { scaleBatch(); return bpaint(); } return; }
    blive();
  }
  function bcanon(final) {
    const d = BD.d, r = BD.r, errs = [];
    const P = (raw, label, o) => { const v = ui.readNum(raw, label, errs, o); return v === null ? '' : v.toString(); };
    const items = d.items.map((x, i) => ({ kind: x.kind, ref: x.ref, bp: x.bp, unit: x.unit, qty: P(x.qty, 'Ingrediente ' + (i + 1), { nonneg: true, required: final }) }));
    const indirects = d.indirects.map((x, i) => ({ indirectId: x.indirectId, unit: x.unit, basis: x.basis, qty: P(x.qty, 'Indirecto ' + (i + 1), { nonneg: true, required: final }) }));
    const bps = d.bps.map((b, i) => ({ id: b.id, name: b.name, unit: b.unit, treatment: b.treatment, method: b.method, valueDisp: b.valueDisp, manualPct: b.manualPct, qty: P(b.qty, 'Subproducto ' + (i + 1), { nonneg: true, required: final }) }));
    const finalQty = P(d.finalQty, 'Producción final real', { pos: true, required: final });
    const initialOverride = P(d.initialOverride, 'Peso inicial', { pos: true });
    return { items, indirects, bps, finalQty, initialOverride, errs };
  }
  function blive() {
    const bd = ui.$('#bd'); if (!bd || !BD) return;
    const c = bcanon(false);
    if (!dn(c.finalQty).isPos()) { ui.$('#bT', bd).textContent = ui.money(E.recipeCalc(Object.assign({}, BD.r, { ingredients: c.items, indirects: c.indirects }), ui.ctx(null, {}), [], { finalBase: U.toBase(D.of(1), BD.r.yieldUnit || 'kg'), noCache: true }).total); ui.$('#bK', bd).textContent = '—'; ui.$('#bY', bd).textContent = '—'; ui.$$('.ci', bd).forEach((x) => (x.textContent = '')); return; }
    const rc = E.batchCompute(BD.r, ui.ctx(), c);
    ui.$$('.ci', bd).forEach((x) => { const l = (x.dataset.k === 'it' ? rc.lines : rc.indLines)[+x.dataset.i]; if (l) x.innerHTML = l.error ? '<span class="badc">' + esc(l.error) + '</span>' : ui.money(l.cost); });
    ui.$$('.cb', bd).forEach((x) => { const b = rc.bps[+x.dataset.i]; if (b) x.innerHTML = b.treatment === 'waste' ? 'Sin costo asignado' : 'Costo asignado: <b>' + ui.money(b.alloc) + '</b>'; });
    ui.$('#bT', bd).textContent = ui.money(rc.total);
    ui.$('#bKL', bd).textContent = 'Costo / ' + rc.dispUnit + ' terminado';
    ui.$('#bK', bd).textContent = rc.perDisp ? ui.money(rc.perDisp) : '—';
    ui.$('#bY', bd).textContent = rc.yieldPct ? ui.pct(rc.yieldPct, 1) : '—';
  }
  ui.actions.batchSave = () => {
    const c = bcanon(true), d = BD.d, errs = c.errs.slice();
    if (!d.date) errs.push('Completá la fecha');
    if (errs.length) return ui.showErrs(ui.$('#bd'), errs);
    const rc = E.batchCompute(BD.r, ui.ctx(), c);
    rc.errors.forEach((x) => errs.push(x));
    if (errs.length) return ui.showErrs(ui.$('#bd'), errs);
    const b = { id: ui.uid(), ownerId: null, createdAt: SC.store.now(), updatedAt: SC.store.now(), recipeId: BD.r.id, recipeName: BD.r.name, date: d.date, factor: String(F.parse(d.factor) || 1), notes: d.notes.trim(), photo: d.photo, calc: E.snapshotOf(rc), priceBasis: 'Precios vigentes al ' + F.date(SC.store.now()) };
    ui.S.batches.push(b); ui.commit({ quiet: true }); BD = null; ui.inputHandler = null; location.hash = '#/rec/batchview/' + b.id; ui.toast('Tanda registrada');
  };

  /* ================= historial de producciones ================= */
  let batRecipe = null;
  function batchList(seg) {
    const S2 = ui.S, bs = S2.batches.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const ids = [...new Set(bs.map((b) => b.recipeId))];
    if (!batRecipe || !ids.includes(batRecipe)) batRecipe = ids[0] || null;
    const name = (id) => { const r = S2.recipes.find((x) => x.id === id); if (r) return r.name; const b = bs.find((x) => x.recipeId === id); return b ? b.recipeName : '?'; };
    let cmp = '';
    if (batRecipe) {
      const rows = bs.filter((b) => b.recipeId === batRecipe).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      const labels = rows.map((_, i) => 'T' + (i + 1));
      const useKg = rows.every((b) => b.calc.perKg !== null && b.calc.perKg !== undefined);
      const yv = rows.map((b) => (b.calc.yieldPct ? D.of(b.calc.yieldPct).mul(100).toNumber() : null)), cv = rows.map((b) => (useKg ? D.of(b.calc.perKg).toNumber() : D.of(b.calc.total).toNumber()));
      const tr = rows.map((b, i) => { const prev = rows[i - 1], dc = prev && useKg ? D.of(b.calc.perKg).sub(D.of(prev.calc.perKg)) : null; return '<tr class="click" data-a="go" data-h="#/rec/batchview/' + b.id + '"><td>T' + (i + 1) + ' · ' + ui.date(b.date) + '</td><td class="num">' + (b.calc.yieldPct ? ui.pct(b.calc.yieldPct, 1) : '—') + '</td><td class="num">' + (useKg ? ui.money(b.calc.perKg) : ui.money(b.calc.total)) + (dc ? '<div class="tiny ' + (dc.isPos() ? 'up' : 'down') + '">' + (dc.isPos() ? '+' : '') + ui.money(dc, 0) + '</div>' : '') + '</td></tr>'; }).join('');
      cmp = '<div class="card"><div class="row sb"><h3>Comparar tandas</h3></div><select class="in mt-s" id="batsel">' + ui.opts(ids.map((i) => [i, name(i)]), batRecipe) + '</select>' +
        (rows.length > 1 ? '<div class="small muted mt">Rendimiento (%)</div>' + ui.lineChart([{ values: yv, color: '#3b4a2a' }], labels, { fmt: (v) => v.toFixed(0) }) + '<div class="small muted">' + (useKg ? 'Costo por kg terminado ($)' : 'Costo total de tanda ($)') + '</div>' + ui.lineChart([{ values: cv, color: '#c0603a' }], labels, { fmt: (v) => Math.round(v).toLocaleString('es-AR') }) : '<div class="small muted mt">Registrá al menos dos tandas de esta receta para ver la evolución.</div>') +
        '<div class="scrollx"><table class="tbl mt"><thead><tr><th>Tanda</th><th class="num">Rend.</th><th class="num">' + (useKg ? 'Costo/kg' : 'Costo') + '</th></tr></thead><tbody>' + tr + '</tbody></table></div></div>';
    }
    const html = seg + (bs.length ? cmp + '<h3 class="mb">Todas las tandas</h3>' + bs.map((b) => '<div class="card click" data-a="go" data-h="#/rec/batchview/' + b.id + '"><div class="row"><div class="grow"><strong>' + esc(name(b.recipeId)) + '</strong><div class="muted small">' + ui.date(b.date) + (b.calc.yieldPct ? ' · rend. ' + ui.pct(b.calc.yieldPct, 1) : '') + '</div></div><div class="num"><div><b>' + ui.money(b.calc.total) + '</b></div><div class="muted tiny">' + (b.calc.perKg ? ui.money(b.calc.perKg) + ' / kg' : (b.calc.perUnit ? ui.money(b.calc.perUnit) + ' / un' : '')) + '</div></div></div></div>').join('') : '<div class="empty">Todavía no registraste tandas.<br>Abrí una receta y tocá <b>Registrar tanda</b>.</div>');
    return { title: 'Producciones', sub: bs.length + ' tandas', html, mount() { const s = ui.$('#batsel'); if (s) s.onchange = () => { batRecipe = s.value; ui.render(); }; } };
  }
  function batchView(id) {
    const b = ui.S.batches.find((x) => x.id === id);
    if (!b) return { title: 'Tanda', back: '#/rec/bat', html: '<div class="err">La tanda no existe.</div>' };
    const c = b.calc, kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    const lines = c.lines.map((l) => '<tr><td>' + esc(l.name) + '</td><td class="num">' + ui.qty(D.of(l.qty), l.unit) + '</td><td class="num">' + ui.money(l.cost) + '</td></tr>').join('');
    const ind = c.indLines.map((l) => '<tr><td>' + esc(l.name) + '</td><td class="num">' + ui.qty(D.of(l.qty), l.unit) + '</td><td class="num">' + ui.money(l.cost) + '</td></tr>').join('');
    const html = (b.photo ? '<img class="photo" src="' + b.photo + '" alt="">' : '') +
      '<div class="info small"><b>Costo real de la tanda.</b> Calculado con los precios vigentes el ' + ui.date(b.createdAt) + '. No cambia si después sube la materia prima.</div>' +
      '<div class="card"><h3>' + esc(b.recipeName) + ' · ' + ui.date(b.date) + '</h3>' + kv('Costo total de tanda', ui.money(c.total)) + kv('Ingredientes', ui.money(c.ingCost)) + kv('Indirectos', ui.money(c.indCost)) +
      (D.of(c.allocTotal).isPos() ? kv('(–) Asignado a subproductos', ui.money(c.allocTotal)) + kv('Costo del producto principal', ui.money(c.mainCost)) : '') +
      (c.yieldDim === 'masa' ? kv('Peso inicial', ui.baseQty(c.initialG, 'masa')) : '') + kv('Producción final', ui.baseQty(c.finalBase, c.yieldDim)) +
      (c.yieldPct ? kv('Merma', ui.pct(c.mermaPct) + ' · ' + ui.baseQty(c.mermaBase, 'masa')) + kv('Rendimiento', ui.pct(c.yieldPct)) : '') +
      (c.perKg ? kv('Costo por kg terminado', ui.money(c.perKg)) + kv('Costo por 100 g', ui.money(c.per100g)) : '') + (c.perUnit ? kv('Costo por unidad', ui.money(c.perUnit)) : '') + (c.perPortion ? kv('Costo por porción', ui.money(c.perPortion)) : '') + '</div>' +
      '<div class="card"><h3>Ingredientes usados</h3><div class="scrollx"><table class="tbl"><tbody>' + lines + '</tbody></table></div>' + (ind ? '<h3 class="mt">Indirectos</h3><table class="tbl"><tbody>' + ind + '</tbody></table>' : '') + '</div>' +
      (c.bps.length ? '<div class="card"><h3>Subproductos recuperados</h3>' + c.bps.map((x) => '<div class="line"><div class="row sb"><strong>' + esc(x.name) + '</strong><span>' + ui.qty(D.of(x.qty), x.unit) + '</span></div><div class="small muted">' + (x.treatment === 'waste' ? 'Descarte' : METHODS[x.method]) + '</div><div class="kv"><span class="k">Costo asignado</span><span class="v">' + ui.money(x.alloc) + '</span></div></div>').join('') + '</div>' : '') +
      (b.notes ? '<div class="card small" style="white-space:pre-wrap">' + esc(b.notes) + '</div>' : '') +
      '<div class="btns noprint"><button class="btn danger" data-a="batchDel" data-id="' + b.id + '" type="button">Eliminar tanda</button></div>';
    return { title: 'Tanda', sub: b.recipeName, back: '#/rec/bat', html };
  }
  ui.actions.batchDel = async (d) => { if (await ui.confirm('¿Eliminar esta tanda del historial? No se puede deshacer.')) { ui.S.batches = ui.S.batches.filter((x) => x.id !== d.id); ui.commit({ quiet: true }); location.hash = '#/rec/bat'; } };

  /* ================= planificador ================= */
  function planner(seg) {
    const S2 = ui.S;
    if (!S2.recipes.length) return { title: 'Planificador', html: seg + '<div class="empty">Creá una receta para planificar producciones.</div>' };
    const pre = ui.planPre || S2.recipes[0].id; ui.planPre = null;
    const html = seg + '<div class="card"><label class="f"><span>Receta</span><select class="in" id="pr">' + ui.opts(S2.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((r) => [r.id, r.name]), pre) + '</select></label>' +
      '<div class="seg"><a href="javascript:void 0" id="pm1" class="on">Quiero terminado</a><a href="javascript:void 0" id="pm2">Tengo crudo</a></div>' +
      '<label class="f"><span id="plab">Cantidad de producto terminado</span><input class="in" id="pa" type="text" inputmode="decimal" data-num autocomplete="off" placeholder="Ej.: 30"><span class="hint prev"></span></label></div><div id="pout"></div>';
    return {
      title: 'Planificador', sub: 'Cuánto producir y comprar', html,
      mount() {
        let mode = 'final';
        const calc = () => {
          const r = ui.S.recipes.find((x) => x.id === ui.$('#pr').value), out = ui.$('#pout'), errs = [];
          const rc0 = E.recipeCalc(r, ui.ctx());
          ui.$('#plab').textContent = mode === 'raw' ? 'Cantidad de materia prima cruda (kg)' : 'Cantidad de producto terminado (' + U.label(r.yieldUnit || 'kg') + ')';
          const v = ui.readNum(ui.$('#pa').value, 'Cantidad', errs, { pos: true, required: true });
          if (errs.length || !v) { out.innerHTML = ''; return; }
          let p; try { p = E.planRecipe(r, ui.ctx(), mode, v.toString()); } catch (e) { out.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
          const kv = (k, x) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + x + '</span></div>';
          out.innerHTML = (p.rc.hasErrors ? '<div class="warn">La receta tiene advertencias de cálculo: ' + esc(p.rc.errors[0]) + '</div>' : '') +
            '<div class="card hero"><div class="muted small">Costo estimado de producción</div><div class="big" style="color:#fff;font-size:1.8rem">' + ui.money(p.costNeeded) + '</div><div class="muted small">' + F.num(p.factor, 3) + ' veces la receta · ' + F.num(p.tandas, 0) + ' tanda(s) completa(s)</div></div>' +
            '<div class="card">' + kv('Producción terminada esperada', ui.baseQty(p.finalBase, p.rc.yieldDim) + ' ' + yieldBadge(p.rc)) + (p.rawBase.isPos() ? kv('Materia prima cruda', ui.baseQty(p.rawBase, 'masa')) : '') + (p.yieldPct ? kv('Rendimiento considerado', ui.pct(p.yieldPct)) : '') + kv('Costo por ' + p.rc.dispUnit + ' terminado', ui.money(p.rc.perDisp)) + kv('Costo estimado (precios actuales)', ui.money(p.costNeeded)) + (p.rc.allocTotal.isPos() ? kv('Costo imputado al principal', ui.money(p.mainCost)) : '') +
            (p.bps.length ? kv('Subproductos esperados', p.bps.map((b) => esc(b.name) + ' ' + ui.baseQty(b.qtyBase, b.dim)).join(', ')) : '') + '</div>' +
            '<div class="card"><h3>Lista de compra</h3><div class="small muted">Cantidad necesaria y envases a comprar (redondeado hacia arriba). No se descuenta stock.</div><div class="scrollx"><table class="tbl mt"><thead><tr><th>Insumo</th><th class="num">Necesito</th><th class="num">Comprar</th><th class="num">Costo</th></tr></thead><tbody>' + p.buy.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((b) => '<tr><td>' + esc(b.name) + '</td><td class="num">' + F.num(b.needDisp, 3) + ' ' + U.label(b.dispUnit) + '</td><td class="num">' + F.num(b.packs, 0) + ' × ' + esc(b.packLabel) + '</td><td class="num">' + ui.money(b.costNeeded) + '<div class="muted tiny">envases: ' + ui.money(b.costPacks) + '</div></td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3">Total (uso exacto)</td><td class="num">' + ui.money(D.sum(p.buy.map((b) => b.costNeeded))) + '</td></tr><tr><td colspan="3">Total comprando envases completos</td><td class="num">' + ui.money(p.costPacksTotal) + '</td></tr></tfoot></table></div></div>' +
            '<div class="btns"><button class="btn terra" type="button" data-a="planBatch" data-id="' + r.id + '" data-f="' + p.factor.toString() + '">Registrar esta producción</button></div>';
        };
        ui.$('#pr').onchange = calc; ui.$('#pa').addEventListener('input', calc);
        ui.$('#pm1').onclick = () => { mode = 'final'; ui.$('#pm1').classList.add('on'); ui.$('#pm2').classList.remove('on'); calc(); };
        ui.$('#pm2').onclick = () => { mode = 'raw'; ui.$('#pm2').classList.add('on'); ui.$('#pm1').classList.remove('on'); calc(); };
      },
    };
  }
  ui.actions.planBatch = (d) => { ui.pendingFactor = d.f; location.hash = '#/rec/batch/' + d.id; };
})(typeof window !== 'undefined' ? window : globalThis);
