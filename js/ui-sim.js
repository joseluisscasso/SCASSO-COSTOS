/* SCASSO — Simulador de escenarios: cambia precios en memoria y muestra el impacto en recetas y productos.
   NO modifica ningún dato guardado (salvo que el usuario elija explícitamente "Aplicar a datos reales"). */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ui = SC.ui, esc = ui.esc, dn = E.dn;
  let SIM = { name: '', mat: {}, ind: {}, showAll: false };
  let sbulk = { cat: 'Todas', pct: '' };

  const dispFactor = (item) => U.dispFactor(U.dim(item.unit));
  const dispCur = (item, ctx, kind) => E.unitCostDisp(item, ctx, kind).value;
  const classDelta = (x) => (x === null ? '' : x.isPos() ? 'up' : x.isNeg() ? 'down' : '');
  const sgn = (x) => (x.isPos() ? '+' : '');

  // Overrides listos para el motor (por unidad base), validando el texto
  function buildOver() {
    const S = ui.S, over = { mat: {}, ind: {} }, errs = [];
    ['mat', 'ind'].forEach((k) => {
      Object.keys(SIM[k]).forEach((id) => {
        const item = (k === 'mat' ? S.materials : S.indirects).find((x) => x.id === id); if (!item) return;
        const v = F.parse(SIM[k][id]);
        if (v === null || v.isNeg()) { if (String(SIM[k][id]).trim()) errs.push(item.name + ': valor inválido'); return; }
        over[k][id] = v.div(dispFactor(item)).toString();
      });
    });
    return { over, errs };
  }

  ui.views.sim = function () {
    const S = ui.S;
    if (!S.materials.length) return { title: 'Simulador', sub: 'Escenarios de precios', back: '#/dash', html: '<div class="empty">Cargá materias primas, recetas y productos para poder simular.</div>' };
    const cats = ['Todas'].concat(ui.CATS_MAT.filter((c) => S.materials.some((m) => m.category === c)));
    const saved = S.scenarios.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const html = '<div class="sim-banner">SIMULACIÓN · No modifica tus datos reales</div>' +
      '<div class="card"><h3>1 · ¿Qué precio querés probar?</h3><div id="simin" class="mt-s"></div>' +
      '<div class="grid2 mt-s"><select class="in" id="simaddm"><option value="">+ Materia prima…</option>' + ui.opts(S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((m) => [m.id, m.name])) + '</select>' +
      '<select class="in" id="simaddi"' + (S.indirects.length ? '' : ' disabled') + '><option value="">+ Costo indirecto…</option>' + ui.opts(S.indirects.map((m) => [m.id, m.name])) + '</select></div>' +
      '<details class="mt"><summary class="small" style="cursor:pointer;font-weight:600">Cambio porcentual por categoría</summary><div class="grid2 mt-s"><select class="in" id="sbcat">' + ui.opts(cats, sbulk.cat) + '</select><input class="in" id="sbpct" data-num type="text" inputmode="decimal" placeholder="% (ej. 15 o -10)" value="' + esc(sbulk.pct) + '"></div><button class="btn sec block mt-s" type="button" data-a="simBulk">Aplicar variación a la categoría</button></details></div>' +
      '<div id="simout"></div>' +
      '<div class="card"><h3>Escenarios guardados</h3>' +
      '<div class="row mt-s"><input class="in grow" id="simname" type="text" placeholder="Nombre (ej.: Carne a $9.000)" value="' + esc(SIM.name) + '"><button class="btn sm" type="button" data-a="simSave">Guardar</button></div>' +
      (saved.length ? '<div class="mt">' + saved.map((sc) => '<div class="line"><div class="row sb"><div><strong>' + esc(sc.name) + '</strong><div class="muted tiny">' + ui.date(sc.createdAt) + ' · ' + (Object.keys(sc.mat || {}).length + Object.keys(sc.ind || {}).length) + ' cambios</div></div></div><div class="btns mt-s"><button class="btn sm sec" type="button" data-a="simLoad" data-id="' + sc.id + '">Cargar</button><button class="btn sm danger" type="button" data-a="simDel" data-id="' + sc.id + '">Eliminar</button></div></div>').join('') + '</div>' : '<div class="muted small mt-s">Guardá escenarios para compararlos después. Guardar un escenario tampoco cambia tus precios reales.</div>') + '</div>';
    return {
      title: 'Simulador de escenarios', sub: 'Probá precios sin tocar tus datos', back: '#/dash', html,
      mount(root) {
        const rebuild = () => { paintInputs(); run(); };
        ui.$('#simaddm', root).onchange = (e) => { const m = S.materials.find((x) => x.id === e.target.value); if (m && SIM.mat[m.id] === undefined) SIM.mat[m.id] = F.num(dispCur(m, ui.ctx(), 'm'), 4); e.target.value = ''; rebuild(); };
        ui.$('#simaddi', root).onchange = (e) => { const m = S.indirects.find((x) => x.id === e.target.value); if (m && SIM.ind[m.id] === undefined) SIM.ind[m.id] = F.num(dispCur(m, ui.ctx(), 'i'), 4); e.target.value = ''; rebuild(); };
        ui.$('#simname', root).oninput = (e) => (SIM.name = e.target.value);
        ui.$('#sbcat', root).onchange = (e) => (sbulk.cat = e.target.value);
        ui.$('#sbpct', root).oninput = (e) => (sbulk.pct = e.target.value);
        ui.inputHandler = (e, type) => {
          if (type === 'change') return; // evita redibujar al soltar el foco (se perdía el primer toque en los botones)
          const el = e.target, k = el.dataset && el.dataset.sim; if (!k) return;
          const [kind, id] = k.split('.'); SIM[kind][id] = el.value;
          const item = (kind === 'mat' ? S.materials : S.indirects).find((x) => x.id === id), v = F.parse(el.value);
          const lab = ui.$('[data-dl="' + k + '"]', root);
          if (item && lab) { const cur = dispCur(item, ui.ctx(), kind === 'mat' ? 'm' : 'i'); if (v && cur.isPos()) { const dl = v.sub(cur).div(cur); lab.className = 'small ' + classDelta(dl); lab.textContent = sgn(dl) + ui.pct(dl, 1) + ' vs hoy'; } else lab.textContent = ''; }
          run();
        };
        ui.simRebuild = rebuild;
        paintInputs(); run();
      },
    };
  };

  function paintInputs() {
    const box = ui.$('#simin'), S = ui.S; if (!box) return;
    const rows = [];
    [['mat', S.materials, 'm'], ['ind', S.indirects, 'i']].forEach(([k, arr, kk]) => {
      Object.keys(SIM[k]).forEach((id) => {
        const item = arr.find((x) => x.id === id); if (!item) { delete SIM[k][id]; return; }
        const cur = dispCur(item, ui.ctx(), kk), du = U.label(U.dispUnit(U.dim(item.unit))), v = F.parse(SIM[k][id]);
        const dl = v && cur.isPos() ? v.sub(cur).div(cur) : null;
        rows.push('<div class="line"><div class="row sb"><strong>' + esc(item.name) + '</strong><button class="x" type="button" data-a="simRemove" data-k="' + k + '" data-id="' + id + '" aria-label="Quitar">×</button></div>' +
          '<div class="small muted">Hoy: ' + ui.money(cur) + ' / ' + du + '</div><div class="row mt-s"><input class="in grow" type="text" inputmode="decimal" data-num autocomplete="off" data-sim="' + k + '.' + id + '" value="' + esc(SIM[k][id]) + '"><span class="small muted">$ / ' + du + '</span></div>' +
          '<div class="small ' + classDelta(dl) + '" data-dl="' + k + '.' + id + '">' + (dl ? sgn(dl) + ui.pct(dl, 1) + ' vs hoy' : '') + '</div></div>');
      });
    });
    box.innerHTML = rows.length ? rows.join('') : '<div class="muted small">Agregá una materia prima y escribí el nuevo precio por kg / l / unidad. Ej.: carne de cerdo de $7.500 a $9.000.</div>';
  }
  ui.actions.simRemove = (d) => { delete SIM[d.k][d.id]; paintInputs(); run(); };
  ui.actions.simBulk = () => {
    const errs = [], pct = ui.readNum(sbulk.pct, 'Porcentaje', errs, { required: true });
    if (errs.length) return ui.toast(errs[0], true);
    const f = D.of(1).add(pct.div(100)); if (f.isNeg()) return ui.toast('La baja no puede superar el 100 %', true);
    const ctx = ui.ctx(); let n = 0;
    ui.S.materials.forEach((m) => { if (sbulk.cat === 'Todas' || m.category === sbulk.cat) { SIM.mat[m.id] = F.num(dispCur(m, ctx, 'm').mul(f), 4); n++; } });
    ui.toast(n + ' materias primas modificadas en la simulación'); paintInputs(); run();
  };

  function run() {
    const out = ui.$('#simout'); if (!out) return;
    const S = ui.S, { over, errs } = buildOver();
    const n = Object.keys(over.mat).length + Object.keys(over.ind).length;
    if (!n) { out.innerHTML = (errs.length ? '<div class="warn">' + errs.map(esc).join('<br>') + '</div>' : '') + '<div class="card muted small">Cuando agregues un cambio vas a ver acá el impacto en cada receta y producto.</div>'; return; }
    const sim = E.simulate(ui.ctx(), over, S.recipes, S.products);
    const target = dn(S.settings.targetMargin).div(100);
    const changed = (x) => x.delta !== null && !x.delta.isZero();
    const prods = sim.products.filter((x) => SIM.showAll || changed(x)).sort((a, b) => (b.deltaPct ? b.deltaPct.toNumber() : 0) - (a.deltaPct ? a.deltaPct.toNumber() : 0));
    const recs = sim.recipes.filter((x) => SIM.showAll || changed(x)).sort((a, b) => (b.deltaPct ? b.deltaPct.toNumber() : 0) - (a.deltaPct ? a.deltaPct.toNumber() : 0));
    const affected = sim.products.filter(changed);
    const worst = affected.length ? affected.reduce((a, b) => (b.deltaPct && a.deltaPct && b.deltaPct.gt(a.deltaPct) ? b : a)) : null;
    const lowNow = affected.filter((x) => x.mB && x.mB.marginPct !== null && x.mB.marginPct.lt(dn(S.settings.lowMargin).div(100)) && !(x.mA.marginPct.lt(dn(S.settings.lowMargin).div(100))));
    const pcard = prods.map((x) => {
      let h = '<div class="card"><div class="row sb"><strong>' + esc(x.name) + '</strong><span class="' + classDelta(x.delta) + '"><b>' + (x.deltaPct ? sgn(x.deltaPct) + ui.pct(x.deltaPct, 1) : '—') + '</b></span></div>' +
        '<div class="kv"><span class="k">Costo hoy → simulado</span><span class="v">' + ui.money(x.costA) + ' → ' + ui.money(x.costB) + '</span></div>' +
        '<div class="kv"><span class="k">Diferencia por unidad</span><span class="v ' + classDelta(x.delta) + '">' + sgn(x.delta) + ui.money(x.delta) + '</span></div>';
      if (x.hasPrice) {
        h += '<div class="kv"><span class="k">Margen con precio ' + ui.money(x.price) + '</span><span class="v">' + (x.mA.marginPct !== null ? ui.pct(x.mA.marginPct, 1) : '—') + ' → <span class="' + (x.mB.marginPct !== null && x.mB.marginPct.lt(dn(S.settings.lowMargin).div(100)) ? 'badc' : '') + '">' + (x.mB.marginPct !== null ? ui.pct(x.mB.marginPct, 1) : '—') + '</span></span></div>' +
          '<div class="kv"><span class="k">Ganancia bruta por unidad</span><span class="v">' + ui.money(x.mA.gross) + ' → ' + ui.money(x.mB.gross) + '</span></div>';
        if (x.priceKeepMargin) { const dp = x.priceKeepMargin.sub(x.price).div(x.price); h += '<div class="kv"><span class="k">Precio para mantener el margen actual</span><span class="v"><b>' + ui.money(x.priceKeepMargin) + '</b> <span class="muted tiny">(' + sgn(dp) + ui.pct(dp, 1) + ')</span></span></div>'; }
      } else h += '<div class="small muted mt-s">Sin precio de venta cargado: no se puede calcular el margen.</div>';
      try { const tp = E.priceForMargin(x.costB, target); h += '<div class="kv"><span class="k">Precio para margen objetivo ' + ui.pct(target, 0) + '</span><span class="v">' + ui.money(tp) + '</span></div>'; } catch (e) { /* sin objetivo */ }
      if (x.b.hasErrors) h += '<div class="warn small">Costo incompleto: ' + esc(x.b.errors[0]) + '</div>';
      return h + '</div>';
    }).join('');
    const rtable = recs.length ? '<details class="card"><summary style="cursor:pointer;font-weight:600">Recetas afectadas (' + recs.length + ')</summary><div class="scrollx"><table class="tbl mt-s"><thead><tr><th>Receta</th><th class="num">Hoy</th><th class="num">Simulado</th><th class="num">Var.</th></tr></thead><tbody>' + recs.map((x) => '<tr><td>' + esc(x.name) + '</td><td class="num">' + (x.costA ? ui.money(x.costA) : '—') + '<div class="muted tiny">por ' + x.unit + '</div></td><td class="num">' + (x.costB ? ui.money(x.costB) : '—') + '</td><td class="num ' + classDelta(x.deltaPct) + '">' + (x.deltaPct ? sgn(x.deltaPct) + ui.pct(x.deltaPct, 1) : '—') + '</td></tr>').join('') + '</tbody></table></div></details>' : '';
    const rep = { title: 'Simulación de escenario', file: 'simulacion', note: 'SIMULACIÓN: precios hipotéticos. No modifica los datos guardados. Cambios simulados: ' + [].concat(Object.keys(over.mat).map((id) => { const m = S.materials.find((x) => x.id === id); return m ? m.name + ' ' + ui.money(dispCur(m, ui.ctx(), 'm')) + ' -> ' + ui.money(D.of(over.mat[id]).mul(dispFactor(m))) : null; }), Object.keys(over.ind).map((id) => { const m = S.indirects.find((x) => x.id === id); return m ? m.name + ' ' + ui.money(dispCur(m, ui.ctx(), 'i')) + ' -> ' + ui.money(D.of(over.ind[id]).mul(dispFactor(m))) : null; })).filter(Boolean).join('; '),
      cols: [{ h: 'Producto', t: 's' }, { h: 'Costo hoy', t: '$' }, { h: 'Costo simulado', t: '$' }, { h: 'Diferencia', t: '$' }, { h: 'Variación %', t: '%' }, { h: 'Precio de venta', t: '$' }, { h: 'Margen hoy %', t: '%' }, { h: 'Margen simulado %', t: '%' }, { h: 'Precio para mantener margen', t: '$' }],
      rows: sim.products.filter(changed).map((x) => [x.name, x.costA, x.costB, x.delta, x.deltaPct, x.hasPrice ? x.price : null, x.mA ? x.mA.marginPct : null, x.mB ? x.mB.marginPct : null, x.priceKeepMargin || null]) };
    ui.lastSimReport = rep;
    out.innerHTML = (errs.length ? '<div class="warn">' + errs.map(esc).join('<br>') + '</div>' : '') +
      '<div class="card hero"><h2>2 · Impacto</h2><div class="muted small mt-s">' + affected.length + ' producto(s) y ' + sim.recipes.filter(changed).length + ' receta(s) cambian de costo.' + (worst && worst.deltaPct ? ' Mayor suba: <b>' + esc(worst.name) + '</b> ' + sgn(worst.deltaPct) + ui.pct(worst.deltaPct, 1) + '.' : '') + '</div>' + (lowNow.length ? '<div class="mt-s"><b>⚠ ' + lowNow.length + ' producto(s) pasarían a margen bajo (&lt; ' + ui.pct(dn(S.settings.lowMargin).div(100), 0) + ')</b></div>' : '') + '</div>' +
      '<label class="row small" style="margin:0 0 10px"><input type="checkbox" id="simall" ' + (SIM.showAll ? 'checked' : '') + ' style="width:20px;height:20px"> Mostrar también lo que no cambia</label>' +
      (pcard || '<div class="card muted small">Ningún producto usa los insumos modificados.</div>') + rtable +
      '<div class="btns noprint"><button class="btn sec" type="button" data-a="simPdf">Compartir PDF</button><button class="btn sec" type="button" data-a="simCsv">Exportar CSV</button><button class="btn sec" type="button" data-a="simXlsx">Exportar Excel</button><button class="btn terra" type="button" data-a="simApply">Aplicar a precios reales…</button></div>' +
      '<div class="small muted mt">“Aplicar” es opcional y pide confirmación; recién ahí se actualizan los precios guardados (con historial).</div>';
    const ck = ui.$('#simall'); if (ck) ck.onchange = () => { SIM.showAll = ck.checked; run(); };
  }

  ui.actions.simPdf = () => ui.exportReport(ui.lastSimReport, 'share');
  ui.actions.simCsv = () => ui.exportReport(ui.lastSimReport, 'csv');
  ui.actions.simXlsx = () => ui.exportReport(ui.lastSimReport, 'xlsx');
  ui.actions.simSave = () => {
    const { over } = buildOver();
    if (!Object.keys(over.mat).length && !Object.keys(over.ind).length) return ui.toast('Agregá al menos un cambio antes de guardar', true);
    const name = (ui.$('#simname').value || '').trim(); if (!name) return ui.toast('Poné un nombre al escenario', true);
    ui.S.scenarios.push({ id: ui.uid(), name, mat: over.mat, ind: over.ind, createdAt: SC.store.now(), ownerId: null });
    SIM.name = ''; ui.commit(); ui.toast('Escenario guardado');
  };
  ui.actions.simLoad = (d) => {
    const sc = ui.S.scenarios.find((x) => x.id === d.id); if (!sc) return;
    SIM = { name: '', mat: {}, ind: {}, showAll: false };
    Object.keys(sc.mat || {}).forEach((id) => { const m = ui.S.materials.find((x) => x.id === id); if (m) SIM.mat[id] = F.num(D.of(sc.mat[id]).mul(dispFactor(m)), 4); });
    Object.keys(sc.ind || {}).forEach((id) => { const m = ui.S.indirects.find((x) => x.id === id); if (m) SIM.ind[id] = F.num(D.of(sc.ind[id]).mul(dispFactor(m)), 4); });
    ui.render(); ui.toast('Escenario cargado: "' + sc.name + '"');
  };
  ui.actions.simDel = async (d) => { if (await ui.confirm('¿Eliminar este escenario guardado?')) { ui.S.scenarios = ui.S.scenarios.filter((x) => x.id !== d.id); ui.commit(); } };
  ui.actions.simApply = async () => {
    const { over } = buildOver(), S = ui.S;
    const mats = Object.keys(over.mat).map((id) => S.materials.find((m) => m.id === id)).filter(Boolean), inds = Object.keys(over.ind).map((id) => S.indirects.find((m) => m.id === id)).filter(Boolean);
    if (!mats.length && !inds.length) return;
    const msg = 'Esto ACTUALIZA los precios reales de ' + (mats.length + inds.length) + ' insumo(s). Los precios anteriores quedan en el historial. Las tandas ya registradas no cambian. ¿Continuar?';
    if (!(await ui.confirm(msg, { ok: 'Aplicar precios', danger: false, title: 'Aplicar a datos reales' }))) return;
    mats.forEach((m) => { const np = D.of(over.mat[m.id]).mul(U.toBase(dn(m.qty), m.unit)); if (!np.eq(dn(m.price))) { m.price = np.toString(); m.updatedAt = SC.store.now(); (m.history = m.history || []).push(E.historyEntry(m)); } });
    inds.forEach((m) => { m.price = D.of(over.ind[m.id]).mul(U.toBase(dn(m.qty), m.unit)).toString(); m.updatedAt = SC.store.now(); });
    SIM = { name: '', mat: {}, ind: {}, showAll: false };
    ui.commit(); ui.toast('Precios actualizados');
  };
  ui.simSeed = (matId) => { const m = ui.S.materials.find((x) => x.id === matId); if (m && SIM.mat[matId] === undefined) SIM.mat[matId] = F.num(dispCur(m, ui.ctx(), 'm'), 4); };
})(typeof window !== 'undefined' ? window : globalThis);
