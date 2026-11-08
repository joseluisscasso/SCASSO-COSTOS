/* SCASSO — Productos terminados (variantes), calculadora de precios y rentabilidad. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ui = SC.ui, esc = ui.esc, dn = E.dn;
  const dispv = (x) => (x === undefined || x === null || x === '' ? '' : F.num(D.of(x), 6));
  let PD = null;

  ui.marginClass = (m) => { if (!m || m.marginPct === null) return ''; return m.marginPct.lt(dn(ui.S.settings.lowMargin).div(100)) ? 'badc' : 'okc'; };
  ui.metricsHTML = function (m, opt) {
    opt = opt || {};
    const st = (k, v, c) => '<div class="stat"><div class="k">' + k + '</div><div class="v ' + (c || '') + '">' + v + '</div></div>';
    return '<div class="grid2">' + st('Costo total', ui.money(m.cost)) + st('Precio' + (opt.disc ? ' efectivo' : ' de venta'), ui.money(m.effPrice)) +
      st('Ganancia bruta', ui.money(m.gross), m.gross.isNeg() ? 'badc' : '') + st('Margen bruto (s/ venta)', m.marginPct === null ? '—' : ui.pct(m.marginPct), ui.marginClass(m)) +
      st('Food cost (costo / venta)', m.foodCost === null ? '—' : ui.pct(m.foodCost)) + st('Markup (recargo s/ costo)', m.markup === null ? '—' : ui.pct(m.markup)) + '</div>' +
      (opt.fees ? '<div class="grid2 mt-s">' + st('Costos de venta', ui.money(m.saleVar)) + st('Contribución', ui.money(m.contribution) + (m.contributionPct !== null ? ' · ' + ui.pct(m.contributionPct, 1) : ''), m.contribution.isNeg() ? 'badc' : '') + '</div>' : '');
  };
  const hasFees = (f) => f && ['platform', 'payment', 'tax', 'discount', 'fixed'].some((k) => dn(f[k]).isPos());
  const defaultFees = () => Object.assign({}, ui.S.settings.fees);

  /* ================= router ================= */
  ui.views.prod = function (p) {
    if (p[0] === 'view') return prodView(p[1]);
    if (p[0] === 'edit') return prodEditor(p[1]);
    const tab = p[0] === 'calc' ? 'calc' : 'prod';
    const seg = ui.seg([['prod', 'Productos', '#/prod'], ['calc', 'Calculadora', '#/prod/calc']], tab);
    return tab === 'calc' ? calc(seg) : prodList(seg);
  };

  function prodList(seg) {
    const S = ui.S, ctx = ui.ctx();
    const list = S.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const html = seg + (list.length ? list.map((p) => {
      const rows = (p.variants || []).map((v) => {
        const vc = E.variantCalc(v, ctx), price = dn(v.salePrice), m = price.isPos() ? E.metrics(vc.total, price, v.fees) : null;
        return '<div class="row sb small" style="padding:3px 0"><span>' + esc(v.name || 'Estándar') + (vc.hasErrors ? ' <span class="badge up">revisar</span>' : '') + '</span><span class="num">' + ui.money(vc.total) + (m && m.marginPct !== null ? ' · <span class="' + ui.marginClass(m) + '">' + ui.pct(m.marginPct, 1) + '</span>' : '') + '</span></div>';
      }).join('');
      return '<div class="card click" data-a="go" data-h="#/prod/view/' + p.id + '"><div class="row">' + (p.photo ? '<img class="thumb" src="' + p.photo + '" alt="">' : '') + '<div class="grow"><strong>' + esc(p.name) + '</strong><div class="muted small">' + esc(p.category || '') + '</div></div></div><div class="mt-s">' + rows + '</div></div>';
    }).join('') : '<div class="empty">Todavía no creaste productos.<br>Un producto combina recetas y materias primas (ej.: SCASSO Signature).</div>');
    return { title: 'Productos', sub: list.length + ' productos', html, fab: 'prodNew' };
  }
  ui.actions.prodNew = () => { if (!ui.S.materials.length && !ui.S.recipes.length) return ui.toast('Primero cargá materias primas o recetas', true); location.hash = '#/prod/edit/new'; };

  /* ================= detalle ================= */
  function prodView(id) {
    const S = ui.S, p = S.products.find((x) => x.id === id);
    if (!p) return { title: 'Producto', back: '#/prod', html: '<div class="err">El producto no existe.</div>' };
    const ctx = ui.ctx(), target = dn(S.settings.targetMargin).div(100);
    const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
    const vs = (p.variants || []).map((v) => {
      const vc = E.variantCalc(v, ctx), price = dn(v.salePrice), m = price.isPos() ? E.metrics(vc.total, price, v.fees) : null;
      let sugg = ''; try { sugg = ui.money(E.priceForMargin(vc.total, target)); } catch (e) { sugg = '—'; }
      const lines = vc.lines.map((l) => '<tr><td>' + esc(l.name) + (l.packaging ? ' <span class="badge">packaging</span>' : '') + (l.error ? '<div class="badc tiny">' + esc(l.error) + '</div>' : '') + (l.incomplete ? '<div class="badc tiny">' + esc(l.incomplete) + '</div>' : '') + '</td><td class="num">' + ui.qty(l.qty, l.unit) + '</td><td class="num">' + ui.money(l.cost) + '</td></tr>').join('');
      return '<div class="card"><h3>' + esc(v.name || 'Estándar') + '</h3>' + (vc.hasErrors ? '<div class="err">Costo incompleto: ' + vc.errors.map(esc).join(' · ') + '</div>' : '') +
        '<div class="scrollx"><table class="tbl mt-s"><thead><tr><th>Componente</th><th class="num">Cantidad</th><th class="num">Costo</th></tr></thead><tbody>' + lines + '</tbody><tfoot><tr><td colspan="2">Elaboración (sin packaging)</td><td class="num">' + ui.money(vc.food) + '</td></tr><tr><td colspan="2">Packaging</td><td class="num">' + ui.money(vc.packaging) + '</td></tr><tr><td colspan="2">Costo total</td><td class="num">' + ui.money(vc.total) + '</td></tr></tfoot></table></div>' +
        kv('Precio sugerido (margen objetivo ' + ui.pct(target, 0) + ')', sugg) +
        (m ? '<div class="mt">' + ui.metricsHTML(m, { fees: hasFees(v.fees), disc: dn((v.fees || {}).discount).isPos() }) + '</div>' : '<div class="info small mt">Cargá un precio de venta (Editar) para ver margen y ganancia.</div>') + '</div>';
    }).join('');
    const html = (p.photo ? '<img class="photo" src="' + p.photo + '" alt="">' : '') + (p.description ? '<p class="muted">' + esc(p.description) + '</p>' : '') + vs +
      '<div class="btns noprint"><button class="btn" data-a="go" data-h="#/prod/edit/' + p.id + '" type="button">Editar</button><button class="btn sec" data-a="simFor" data-id="' + p.id + '" type="button">Simular costos</button><button class="btn sec" data-a="prodDup" data-id="' + p.id + '" type="button">Duplicar</button><button class="btn danger" data-a="prodDel" data-id="' + p.id + '" type="button">Eliminar</button></div>';
    return { title: p.name, sub: p.category, back: '#/prod', html };
  }
  ui.actions.simFor = () => { location.hash = '#/sim'; };
  ui.actions.prodDup = (d) => {
    const p = JSON.parse(JSON.stringify(ui.S.products.find((x) => x.id === d.id)));
    p.id = ui.uid(); p.name += ' (copia)'; p.createdAt = p.updatedAt = SC.store.now(); p.variants.forEach((v) => (v.id = ui.uid()));
    ui.S.products.push(p); ui.commit({ quiet: true }); location.hash = '#/prod/edit/' + p.id;
  };
  ui.actions.prodDel = async (d) => { const p = ui.S.products.find((x) => x.id === d.id); if (await ui.confirm('¿Eliminar el producto "' + p.name + '" y todas sus variantes?')) { ui.S.products = ui.S.products.filter((x) => x.id !== p.id); ui.commit({ quiet: true }); location.hash = '#/prod'; ui.toast('Producto eliminado'); } };

  /* ================= editor ================= */
  const blankVariant = (name) => ({ id: ui.uid(), name: name || 'Estándar', components: [], salePrice: '', fees: dispFees(defaultFees()) });
  const dispFees = (f) => { const o = {}; ['platform', 'payment', 'tax', 'discount', 'fixed'].forEach((k) => (o[k] = dispv(f && f[k]))); return o; };
  function toDraft(p) {
    const c = JSON.parse(JSON.stringify(p));
    c.variants.forEach((v) => { v.salePrice = dispv(v.salePrice); v.fees = dispFees(v.fees); v.components.forEach((x) => (x.qty = dispv(x.qty))); });
    return c;
  }
  function pcanon(d) {
    const errs = [];
    const P = (raw, label, o) => { const v = ui.readNum(raw, label, errs, o); return v === null ? '' : v.toString(); };
    const p = Object.assign({}, d, {
      variants: d.variants.map((v, vi) => {
        const n = (v.name || 'Variante ' + (vi + 1));
        const fees = {}; [['platform', 'Comisión plataforma'], ['payment', 'Comisión medio de pago'], ['tax', 'Impuestos'], ['discount', 'Descuento']].forEach(([k, l]) => (fees[k] = P(v.fees[k], n + ': ' + l, { nonneg: true, max: 99.99 })));
        fees.fixed = P(v.fees.fixed, n + ': costo de venta fijo', { nonneg: true });
        return Object.assign({}, v, { salePrice: P(v.salePrice, n + ': precio de venta', { nonneg: true }), fees, components: v.components.map((x, i) => Object.assign({}, x, { qty: P(x.qty, n + ' · componente ' + (i + 1) + ': cantidad', { nonneg: true }) })) });
      }),
    });
    return { p, errs };
  }
  function prodEditor(id) {
    const isNew = id === 'new', orig = isNew ? null : ui.S.products.find((x) => x.id === id);
    if (!isNew && !orig) return { title: 'Producto', back: '#/prod', html: '<div class="err">El producto no existe.</div>' };
    PD = { d: isNew ? { id: ui.uid(), name: '', category: 'Sándwiches', description: '', photo: '', variants: [blankVariant('Estándar')], createdAt: SC.store.now(), ownerId: null } : toDraft(orig), isNew };
    return { title: isNew ? 'Nuevo producto' : 'Editar producto', back: isNew ? '#/prod' : '#/prod/view/' + id, html: '<div id="pe"></div>', mount() { ppaint(); ui.inputHandler = pInput; } };
  }
  function ppaint() {
    const sy = g.scrollY;
    ui.$('#pe').innerHTML = pHTML(PD.d);
    ui.bindPhoto(ui.$('#pe'), () => PD.d.photo, (v) => (PD.d.photo = v));
    plive(); g.scrollTo(0, sy);
  }
  function pHTML(d) {
    const B = (p) => ' data-bind="' + p + '"';
    const num = (p, v, ph) => '<input class="in" type="text" inputmode="decimal" autocomplete="off" data-num placeholder="' + esc(ph || '') + '" value="' + esc(v || '') + '"' + B(p) + '>';
    const vars = d.variants.map((v, vi) => {
      const comps = v.components.map((x, i) => {
        const units = x.ref ? ui.unitsForRef(x.kind, x.ref, x.bp) : [], base = 'variants.' + vi + '.components.' + i;
        return '<div class="line"><div class="row"><select class="in grow" data-ref="' + base + '"' + B(base + '.refv') + '>' + ui.refSelect(ui.refValue(x)) + '</select><button class="x" type="button" data-a="pRemoveComp" data-v="' + vi + '" data-i="' + i + '">×</button></div>' +
          '<div class="grid3 mt-s">' + num(base + '.qty', x.qty, 'Cantidad') + '<select class="in"' + B(base + '.unit') + '>' + ui.unitOpts(units, x.unit) + '</select><div class="num small"><span class="ci" data-v="' + vi + '" data-i="' + i + '">—</span></div></div>' +
          '<label class="row mt-s small"><input type="checkbox" ' + (x.packaging ? 'checked' : '') + B(base + '.packaging') + ' style="width:20px;height:20px"> Es packaging</label></div>';
      }).join('');
      return '<div class="card" style="border-color:var(--olive)"><div class="row"><input class="in grow" type="text" placeholder="Nombre de la variante (Estándar, Grande, Porción…)" value="' + esc(v.name) + '"' + B('variants.' + vi + '.name') + '>' + (d.variants.length > 1 ? '<button class="x" type="button" data-a="pRemoveVar" data-v="' + vi + '">×</button>' : '') + '</div>' +
        '<div class="mt">' + (comps || '<div class="muted small">Agregá componentes: materias primas, recetas o subproductos.</div>') + '</div><button class="btn sec block" type="button" data-a="pAddComp" data-v="' + vi + '">+ Agregar componente</button>' +
        '<h3 class="mt">Precio y costos de venta</h3><label class="f mt-s"><span>Precio de venta ($)</span>' + num('variants.' + vi + '.salePrice', v.salePrice, 'Ej.: 12.500') + '</label>' +
        '<div class="grid2"><label class="f"><span>Comisión plataforma %</span>' + num('variants.' + vi + '.fees.platform', v.fees.platform) + '</label><label class="f"><span>Medios de pago %</span>' + num('variants.' + vi + '.fees.payment', v.fees.payment) + '</label><label class="f"><span>Impuestos %</span>' + num('variants.' + vi + '.fees.tax', v.fees.tax) + '</label><label class="f"><span>Descuento %</span>' + num('variants.' + vi + '.fees.discount', v.fees.discount) + '</label></div>' +
        '<label class="f"><span>Otros costos de venta por unidad ($)</span>' + num('variants.' + vi + '.fees.fixed', v.fees.fixed) + '</label>' +
        '<div class="info small" data-sum="' + vi + '"></div></div>';
    }).join('');
    return '<div class="errs"></div><div class="card">' + ui.tf({ name: 'name', label: 'Nombre del producto', value: d.name, bind: 'name', ph: 'Ej.: SCASSO Signature' }) + ui.sf({ name: 'category', label: 'Categoría', options: ui.CATS_PROD, value: d.category, bind: 'category' }) + ui.tf({ name: 'description', label: 'Descripción', value: d.description, bind: 'description', area: true }) + ui.photoField(d.photo) + '</div>' +
      vars + '<button class="btn sec block" type="button" data-a="pAddVar">+ Agregar variante / tamaño</button>' +
      '<div class="btns mt"><button class="btn" type="button" data-a="pSave">Guardar producto</button><button class="btn sec" type="button" data-a="edCancel">Cancelar</button></div>';
  }
  function pInput(e, type) {
    if (!PD) return;
    const el = e.target, path = el.dataset && el.dataset.bind; if (!path) return;
    if (el.dataset.ref !== undefined) {
      if (type !== 'change') return;
      const row = ui.getPath(PD.d, el.dataset.ref), ref = ui.parseRef(el.value);
      Object.assign(row, { kind: ref.kind, ref: ref.ref, bp: ref.bp }); row.unit = ui.defaultUnit(ref.kind, ref.ref, ref.bp);
      return ppaint();
    }
    ui.setPath(PD.d, path, el.type === 'checkbox' ? el.checked : el.value);
    plive();
  }
  function plive() {
    const pe = ui.$('#pe'); if (!pe || !PD) return;
    const { p, errs } = pcanon(PD.d), ctx = ui.ctx(), target = dn(ui.S.settings.targetMargin).div(100);
    p.variants.forEach((v, vi) => {
      const vc = E.variantCalc(v, ctx);
      ui.$$('.ci[data-v="' + vi + '"]', pe).forEach((c) => { const l = vc.lines[+c.dataset.i]; if (l) c.innerHTML = l.error ? '<span class="badc tiny">' + esc(l.error) + '</span>' : ui.money(l.cost); });
      let s = '<b>Costo total: ' + ui.money(vc.total) + '</b> · packaging ' + ui.money(vc.packaging);
      try { s += '<br>Precio sugerido (margen objetivo ' + ui.pct(target, 0) + '): <b>' + ui.money(E.priceForMargin(vc.total, target)) + '</b>'; } catch (e) { /* sin sugerencia */ }
      const price = dn(v.salePrice);
      if (price.isPos()) { const m = E.metrics(vc.total, price, v.fees); s += '<br>Margen bruto: <b class="' + ui.marginClass(m) + '">' + (m.marginPct === null ? '—' : ui.pct(m.marginPct, 1)) + '</b> · Ganancia: <b>' + ui.money(m.gross) + '</b>' + (hasFees(v.fees) ? ' · Contribución: <b>' + ui.money(m.contribution) + '</b>' : ''); }
      const box = ui.$('[data-sum="' + vi + '"]', pe); if (box) box.innerHTML = s;
    });
    const box = ui.$('.errs', pe); box.innerHTML = errs.length ? '<div class="warn">' + errs.map((x) => '• ' + esc(x)).join('<br>') + '</div>' : '';
  }
  ui.actions.pAddComp = (d) => { PD.d.variants[+d.v].components.push({ kind: 'm', ref: '', unit: 'g', qty: '', packaging: false }); ppaint(); };
  ui.actions.pRemoveComp = (d) => { PD.d.variants[+d.v].components.splice(+d.i, 1); ppaint(); };
  ui.actions.pAddVar = () => {
    const last = PD.d.variants[PD.d.variants.length - 1], v = last ? JSON.parse(JSON.stringify(last)) : blankVariant();
    v.id = ui.uid(); v.name = ''; PD.d.variants.push(v); ppaint(); ui.toast('Variante copiada de la anterior: ajustá cantidades y precio');
  };
  ui.actions.pRemoveVar = async (d) => { if (await ui.confirm('¿Quitar esta variante?', { ok: 'Quitar' })) { PD.d.variants.splice(+d.v, 1); ppaint(); } };
  ui.actions.pSave = () => {
    const { p, errs } = pcanon(PD.d), ctx = ui.ctx();
    if (!p.name.trim()) errs.push('Completá el nombre del producto');
    if (!p.variants.length) errs.push('Agregá al menos una variante');
    p.variants.forEach((v, vi) => {
      const n = v.name.trim() || 'Variante ' + (vi + 1);
      if (!v.components.length) errs.push(n + ': agregá componentes');
      v.components.forEach((x, i) => { if (!x.ref) errs.push(n + ' · componente ' + (i + 1) + ': elegí qué es'); else if (!dn(x.qty).isPos()) errs.push(n + ' · componente ' + (i + 1) + ': cantidad mayor a cero'); });
      const vc = E.variantCalc(v, ctx); vc.errors.forEach((x) => errs.push(n + ': ' + x));
      v.name = v.name.trim();
    });
    const names = p.variants.map((v) => v.name.toLowerCase()); if (new Set(names).size !== names.length) errs.push('Dos variantes tienen el mismo nombre');
    if (errs.length) return ui.showErrs(ui.$('#pe'), errs);
    p.name = p.name.trim(); p.updatedAt = SC.store.now();
    p.variants.forEach((v) => (v.components.forEach((c) => delete c.refv)));
    const i = ui.S.products.findIndex((x) => x.id === p.id);
    if (i >= 0) ui.S.products[i] = p; else ui.S.products.push(p);
    ui.commit({ quiet: true }); PD = null; ui.inputHandler = null; location.hash = '#/prod/view/' + p.id; ui.toast('Producto guardado');
  };

  /* ================= calculadora de precios ================= */
  let CALC = null;
  function calc(seg) {
    const S = ui.S, f0 = dispFees(S.settings.fees);
    if (!CALC) CALC = { src: 'manual', cost: '', mode: 'A', price: '', margin: S.settings.targetMargin ? dispv(S.settings.targetMargin) : '', fees: f0 };
    const variants = []; S.products.forEach((p) => (p.variants || []).forEach((v) => variants.push([p.id + '|' + v.id, p.name + (v.name ? ' — ' + v.name : '')])));
    const html = seg + '<div class="card"><label class="f"><span>Costo de partida</span><select class="in" id="csrc"><option value="manual">Ingresar costo manualmente</option>' + variants.map(([v, l]) => '<option value="' + esc(v) + '"' + (CALC.src === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>' +
      '<div id="cmanual">' + ui.nf({ name: 'cost', label: 'Costo total ($)', value: CALC.cost, ph: '5.000' }) + '</div><div id="csrcinfo" class="info small" style="display:none"></div>' +
      '<div class="seg"><a href="javascript:void 0" id="cmA" class="' + (CALC.mode === 'A' ? 'on' : '') + '">Tengo el precio</a><a href="javascript:void 0" id="cmB" class="' + (CALC.mode === 'B' ? 'on' : '') + '">Tengo el margen</a></div>' +
      '<div id="cinA">' + ui.nf({ name: 'price', label: 'Precio de venta ($)', value: CALC.price, ph: '12.500' }) + '</div><div id="cinB">' + ui.nf({ name: 'margin', label: 'Margen bruto deseado (% sobre la venta)', value: CALC.margin, ph: '60' }) + '</div></div>' +
      '<div class="card"><h3>Costos comerciales (opcional)</h3><div class="grid2 mt-s">' + ui.nf({ name: 'platform', label: 'Comisión plataforma %', value: CALC.fees.platform }) + ui.nf({ name: 'payment', label: 'Medios de pago %', value: CALC.fees.payment }) + ui.nf({ name: 'tax', label: 'Impuestos %', value: CALC.fees.tax }) + ui.nf({ name: 'discount', label: 'Descuento %', value: CALC.fees.discount }) + '</div>' + ui.nf({ name: 'fixed', label: 'Otros costos de venta por unidad ($)', value: CALC.fees.fixed }) + '</div>' +
      '<div id="cout"></div><div class="info small"><b>Margen ≠ markup.</b> Margen = ganancia ÷ precio de venta. Markup = ganancia ÷ costo. Con costo $5.000 y precio $12.500: margen 60 %, markup 150 %. Precio = costo ÷ (1 − margen).</div>';
    return {
      title: 'Calculadora', sub: 'Precio y rentabilidad', html,
      mount(root) {
        const $ = (s) => ui.$(s, root);
        const sync = () => {
          $('#cinA').style.display = CALC.mode === 'A' ? '' : 'none'; $('#cinB').style.display = CALC.mode === 'B' ? '' : 'none';
          $('#cmanual').style.display = CALC.src === 'manual' ? '' : 'none'; $('#csrcinfo').style.display = CALC.src === 'manual' ? 'none' : '';
          $('#cmA').classList.toggle('on', CALC.mode === 'A'); $('#cmB').classList.toggle('on', CALC.mode === 'B');
        };
        const val = (n) => ui.$('[name=' + n + ']', root).value;
        const run = () => {
          CALC.cost = val('cost'); CALC.price = val('price'); CALC.margin = val('margin'); ['platform', 'payment', 'tax', 'discount', 'fixed'].forEach((k) => (CALC.fees[k] = val(k)));
          const errs = []; let cost = null, v = null;
          if (CALC.src === 'manual') cost = ui.readNum(CALC.cost, 'Costo', errs, { pos: true, required: true });
          else { const [pid, vid] = CALC.src.split('|'), pr = ui.S.products.find((x) => x.id === pid); v = pr && pr.variants.find((x) => x.id === vid); if (v) { const vc = E.variantCalc(v, ui.ctx()); cost = vc.total; $('#csrcinfo').innerHTML = 'Costo calculado: <b>' + ui.money(cost) + '</b> (packaging ' + ui.money(vc.packaging) + ')' + (vc.hasErrors ? '<br><span class="badc">Costo incompleto: revisá el producto</span>' : ''); } }
          const fees = {}; [['platform', 'Comisión plataforma'], ['payment', 'Medios de pago'], ['tax', 'Impuestos'], ['discount', 'Descuento']].forEach(([k, l]) => { const x = ui.readNum(CALC.fees[k], l, errs, { nonneg: true, max: 99.99 }); fees[k] = x ? x.toString() : '0'; });
          const fx = ui.readNum(CALC.fees.fixed, 'Costos de venta fijos', errs, { nonneg: true }); fees.fixed = fx ? fx.toString() : '0';
          let price = null, note = '';
          if (CALC.mode === 'A') price = ui.readNum(CALC.price, 'Precio de venta', errs, { pos: true, required: true });
          else {
            const mg = ui.readNum(CALC.margin, 'Margen', errs, { nonneg: true, required: true, max: 99.99 });
            if (!errs.length && cost && mg) {
              try {
                const m1 = mg.div(100), grossP = E.priceForMargin(cost, m1); price = grossP;
                if (hasFees(fees)) { const lp = E.priceForContribution(cost, m1, fees); note = '<div class="info small">Para que la <b>contribución</b> (después de comisiones, impuestos y descuento) sea ' + ui.pct(m1, 0) + ': precio de lista <b>' + ui.money(lp) + '</b>.</div>'; }
              } catch (e) { errs.push(e.message); }
            }
          }
          const out = $('#cout');
          if (errs.length || !cost || !price) { out.innerHTML = errs.length ? '<div class="warn">' + errs.map(esc).join('<br>') + '</div>' : ''; return; }
          const m = E.metrics(cost, price, fees), sugg = CALC.mode === 'B' ? '<div class="card hero"><div class="muted small">Precio de venta sugerido (margen bruto ' + ui.pct(dn(F.parse(CALC.margin)).div(100), 0) + ')</div><div class="big" style="color:#fff;font-size:1.9rem">' + ui.money(price) + '</div></div>' : '';
          out.innerHTML = sugg + '<div class="card"><h3>Resultado</h3><div class="mt-s">' + ui.metricsHTML(m, { fees: hasFees(fees), disc: dn(fees.discount).isPos() }) + '</div>' + note +
            (v ? '<div class="btns mt"><button class="btn sm sec" data-a="calcApply" data-p="' + price.toString() + '" type="button">Usar este precio en el producto</button></div>' : '') + '</div>';
        };
        $('#csrc').onchange = () => { CALC.src = $('#csrc').value; sync(); run(); };
        $('#cmA').onclick = () => { CALC.mode = 'A'; sync(); run(); };
        $('#cmB').onclick = () => { CALC.mode = 'B'; sync(); run(); };
        root.addEventListener('input', run);
        sync(); run();
      },
    };
  }
  ui.actions.calcApply = async (d) => {
    const [pid, vid] = CALC.src.split('|'), pr = ui.S.products.find((x) => x.id === pid), v = pr && pr.variants.find((x) => x.id === vid);
    if (!v) return;
    if (await ui.confirm('¿Guardar ' + ui.money(D.of(d.p)) + ' como precio de venta de "' + pr.name + (v.name ? ' — ' + v.name : '') + '"?', { ok: 'Guardar', danger: false })) { v.salePrice = D.of(d.p).toString(); pr.updatedAt = SC.store.now(); ui.commit({ quiet: true }); ui.toast('Precio guardado en el producto'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
