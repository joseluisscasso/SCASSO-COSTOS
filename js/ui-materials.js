/* SCASSO — Materias primas, historial de precios y costos indirectos. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ui = SC.ui, esc = ui.esc;
  let catFilter = 'Todas';

  /* ---------- uso de una materia prima / indirecto ---------- */
  ui.usageOfMaterial = function (id) {
    const S = ui.S, out = [];
    S.recipes.forEach((r) => { if ((r.ingredients || []).some((i) => i.kind === 'm' && i.ref === id)) out.push('Receta: ' + r.name); });
    S.products.forEach((p) => (p.variants || []).forEach((v) => { if ((v.components || []).some((c) => c.kind === 'm' && c.ref === id)) out.push('Producto: ' + p.name + (v.name ? ' — ' + v.name : '')); }));
    return out;
  };
  ui.usageOfIndirect = (id) => ui.S.recipes.filter((r) => (r.indirects || []).some((x) => x.indirectId === id)).map((r) => 'Receta: ' + r.name);

  /* ---------- vista ---------- */
  ui.views.mat = function (parts) {
    const tab = parts[0] === 'ind' ? 'ind' : 'mat';
    const seg = ui.seg([['mat', 'Materias primas', '#/mat'], ['ind', 'Costos indirectos', '#/mat/ind']], tab);
    if (tab === 'ind') return indView(seg);
    const S = ui.S, ctx = ui.ctx();
    const cats = ['Todas'].concat(ui.CATS_MAT.filter((c) => S.materials.some((m) => m.category === c)));
    if (!cats.includes(catFilter)) catFilter = 'Todas';
    const list = S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const cards = list.map((m) => {
      const ch = E.priceChange(m);
      const badge = ch && !ch.pct.isZero() ? ' <span class="badge ' + (ch.pct.isPos() ? 'up' : 'down') + '">' + (ch.pct.isPos() ? '▲ ' : '▼ ') + F.pct(ch.pct.abs(), 1) + '</span>' : '';
      const txt = (m.name + ' ' + (m.category || '') + ' ' + (m.supplier || '') + ' ' + (m.brand || '')).toLowerCase();
      return '<div class="card click" data-a="matOpen" data-id="' + m.id + '" data-cat="' + esc(m.category || '') + '" data-q="' + esc(txt) + '"><div class="row top"><div class="grow"><strong>' + esc(m.name) + '</strong>' + badge + '<div class="muted small">' + esc([m.category, m.supplier, m.brand].filter(Boolean).join(' · ')) + '</div><div class="small mt-s">' + esc(ui.costText(m)) + '</div></div><div class="num small"><div>' + F.money(m.price) + '</div><div class="muted tiny">' + esc((m.envase ? m.envase + ' ' : '') + F.num(E.dn(m.qty)) + ' ' + U.label(m.unit)) + '</div><div class="muted tiny">' + F.date(m.updatedAt) + '</div></div></div></div>';
    }).join('');
    const html = seg +
      '<input class="search" id="matq" type="search" placeholder="Buscar materia prima, proveedor o marca…" autocomplete="off">' +
      '<div class="chips" id="matcats">' + cats.map((c) => '<span class="chip ' + (c === catFilter ? 'on' : '') + '" data-a="matCat" data-c="' + esc(c) + '">' + esc(c) + '</span>').join('') + '</div>' +
      (list.length ? '<div id="matlist">' + cards + '</div><div class="empty" id="matnone" style="display:none">Sin resultados</div>' : '<div class="empty">Todavía no cargaste materias primas.<br>Tocá <b>+</b> para agregar la primera.</div>') +
      '<div class="btns noprint"><button class="btn sec" data-a="priceUpdate" type="button">Actualizar un precio</button></div>';
    return {
      title: 'Materias primas', sub: list.length + ' registradas', html, fab: 'matNew',
      mount(root) { const q = ui.$('#matq', root); if (q) { q.oninput = filterMat; filterMat(); } },
    };
  };
  function filterMat() {
    const q = (ui.$('#matq') || { value: '' }).value.trim().toLowerCase();
    let n = 0;
    ui.$$('#matlist .card').forEach((c) => {
      const ok = (!q || c.dataset.q.includes(q)) && (catFilter === 'Todas' || c.dataset.cat === catFilter);
      c.style.display = ok ? '' : 'none'; if (ok) n++;
    });
    const none = ui.$('#matnone'); if (none) none.style.display = n ? 'none' : '';
  }
  ui.actions.matCat = (d) => {
    catFilter = d.c;
    ui.$$('#matcats .chip').forEach((c) => c.classList.toggle('on', c.dataset.c === catFilter));
    filterMat();
  };
  ui.actions.matNew = () => matForm(null);
  ui.actions.matOpen = (d) => matForm(d.id);
  ui.actions.priceUpdate = (d) => priceSheet(d.id);

  /* ---------- formulario de materia prima ---------- */
  function matForm(id) {
    const S = ui.S, cur = id ? S.materials.find((m) => m.id === id) : null;
    const m = cur || { name: '', category: 'Carnes', supplier: '', brand: '', envase: '', unit: 'kg', qty: '1', price: '', notes: '' };
    const hist = cur && (cur.history || []).length > 1 ? '<h3 class="mt">Historial de precios</h3><div class="scrollx"><table class="tbl"><thead><tr><th>Fecha</th><th class="num">Envase</th><th class="num">Costo</th><th class="num">Var.</th></tr></thead><tbody>' + cur.history.slice().map((h, i, a) => {
      const prev = i > 0 ? E.dn(a[i - 1].perBase) : null, now = E.dn(h.perBase);
      const dim = U.dim(h.unit), dp = now.mul(U.dispFactor(dim));
      const ch = prev && prev.isPos() ? now.sub(prev).div(prev) : null;
      return '<tr><td>' + F.date(h.date) + '</td><td class="num">' + F.money(h.price) + '</td><td class="num">' + F.money(dp) + '/' + U.label(U.dispUnit(dim)) + '</td><td class="num ' + (ch ? (ch.isPos() ? 'up' : ch.isNeg() ? 'down' : '') : '') + '">' + (ch ? (ch.isPos() ? '+' : '') + F.pct(ch, 1) : '—') + '</td></tr>';
    }).reverse().join('') + '</tbody></table></div>' : '';
    const html = '<form id="mf" novalidate><div class="errs"></div>' +
      ui.tf({ name: 'name', label: 'Nombre', value: m.name, ph: 'Ej.: Romero seco' }) +
      ui.sf({ name: 'category', label: 'Categoría', options: ui.CATS_MAT, value: m.category }) +
      '<div class="grid2">' + ui.tf({ name: 'supplier', label: 'Proveedor', value: m.supplier }) + ui.tf({ name: 'brand', label: 'Marca', value: m.brand }) + '</div>' +
      ui.tf({ name: 'envase', label: 'Presentación (opcional)', value: m.envase, ph: 'paquete, bidón, bolsa, caja…', hint: 'Solo descriptivo: la cantidad y unidad de abajo son las que cuentan.' }) +
      '<div class="grid2">' + ui.nf({ name: 'qty', label: 'Cantidad del envase', value: m.qty, ph: '250' }) + ui.sf({ name: 'unit', label: 'Unidad de compra', options: U.PURCHASE_UNITS.map((u) => [u, U.UNITS[u].long]), value: m.unit }) + '</div>' +
      ui.nf({ name: 'price', label: 'Precio total de compra ($)', value: m.price, ph: '5.000' }) +
      '<div class="info" id="mcost">—</div>' +
      ui.tf({ name: 'notes', label: 'Observaciones', value: m.notes, area: true }) +
      '<div class="btns"><button class="btn" type="submit">' + (cur ? 'Guardar cambios' : 'Guardar') + '</button>' + (cur ? '<button class="btn sec" type="button" data-p>Actualizar precio</button><button class="btn danger" type="button" data-del>Eliminar</button>' : '') + '</div></form>' + hist;
    ui.sheet({
      title: cur ? 'Materia prima' : 'Nueva materia prima', html,
      onMount(sh) {
        const f = ui.$('#mf', sh.el);
        const prev = () => {
          const v = ui.formVals(f), errs = [];
          const q = ui.readNum(v.qty, 'Cantidad', errs, { pos: true }), p = ui.readNum(v.price, 'Precio', errs, { nonneg: true });
          const box = ui.$('#mcost', sh.el);
          if (errs.length || !q || !p) { box.textContent = 'Completá cantidad y precio para ver el costo unitario.'; return; }
          try { box.innerHTML = '<b>Costo unitario calculado:</b><br>' + esc(ui.costText({ id: 'x', unit: v.unit, qty: q.toString(), price: p.toString() })); } catch (e) { box.textContent = e.message; }
        };
        f.addEventListener('input', prev); f.addEventListener('change', prev); prev();
        f.onsubmit = (ev) => {
          ev.preventDefault();
          const v = ui.formVals(f), errs = [];
          if (!v.name.trim()) errs.push('Completá el nombre');
          const dup = ui.S.materials.find((x) => x.name.trim().toLowerCase() === v.name.trim().toLowerCase() && x.id !== (cur && cur.id));
          if (dup) errs.push('Ya existe una materia prima con ese nombre');
          const q = ui.readNum(v.qty, 'Cantidad del envase', errs, { pos: true, required: true });
          const p = ui.readNum(v.price, 'Precio', errs, { nonneg: true, required: true });
          if (errs.length) return ui.showErrs(f, errs);
          if (cur && U.dim(cur.unit) !== U.dim(v.unit) && ui.usageOfMaterial(cur.id).length) {
            return ui.showErrs(f, ['No se puede cambiar la unidad a otra magnitud (' + U.DIMS[U.dim(cur.unit)].label + ' → ' + U.DIMS[U.dim(v.unit)].label + ') porque la usan recetas o productos. Creá una materia prima nueva.']);
          }
          const rec = cur || { id: ui.uid(), createdAt: SC.store.now(), ownerId: null, history: [] };
          const changed = !cur || String(E.dn(cur.price)) !== p.toString() || String(E.dn(cur.qty)) !== q.toString() || cur.unit !== v.unit;
          Object.assign(rec, { name: v.name.trim(), category: v.category, supplier: v.supplier.trim(), brand: v.brand.trim(), envase: v.envase.trim(), unit: v.unit, qty: q.toString(), price: p.toString(), notes: v.notes.trim(), updatedAt: SC.store.now() });
          if (changed) rec.history.push(E.historyEntry(rec));
          if (!cur) ui.S.materials.push(rec);
          ui.commit(); sh.close(); ui.toast('Guardado');
        };
        const pb = ui.$('[data-p]', sh.el); if (pb) pb.onclick = () => { sh.close(); priceSheet(cur.id); };
        const db = ui.$('[data-del]', sh.el);
        if (db) db.onclick = async () => {
          const use = ui.usageOfMaterial(cur.id);
          if (use.length) return ui.showErrs(f, ['No se puede eliminar: está en uso.', ...use.slice(0, 6)]);
          if (await ui.confirm('¿Eliminar "' + cur.name + '"? Esta acción no se puede deshacer.')) {
            ui.S.materials = ui.S.materials.filter((x) => x.id !== cur.id); ui.commit(); sh.close(); ui.toast('Eliminada');
          }
        };
      },
    });
  }

  /* ---------- actualizar precio (rápido) ---------- */
  function priceSheet(pre) {
    const S = ui.S;
    if (!S.materials.length) return ui.toast('Primero cargá una materia prima', true);
    const html = '<form id="pf" novalidate><div class="errs"></div>' +
      '<label class="f"><span>Materia prima</span><select class="in" name="id">' + ui.opts(S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((m) => [m.id, m.name]), pre) + '</select></label>' +
      '<div class="info" id="pcur"></div>' +
      ui.nf({ name: 'disp', label: 'Nuevo precio por unidad (kg / l / un)', ph: '9.000' }) +
      ui.nf({ name: 'pack', label: 'o nuevo precio del envase completo ($)', ph: '' }) +
      '<div class="small muted mb">Completá cualquiera de los dos: el otro se calcula. El precio anterior queda guardado en el historial.</div>' +
      '<button class="btn block" type="submit">Actualizar precio</button></form>';
    ui.sheet({
      title: 'Actualizar precio', html,
      onMount(sh) {
        const f = ui.$('#pf', sh.el); let last = 'disp';
        const mat = () => ui.S.materials.find((x) => x.id === f.elements.id.value);
        const info = () => { const m = mat(); ui.$('#pcur', sh.el).innerHTML = m ? 'Actual: <b>' + F.money(m.price) + '</b> por ' + F.num(E.dn(m.qty)) + ' ' + U.label(m.unit) + '<br>' + esc(ui.costText(m)) : ''; };
        const sync = (src) => {
          const m = mat(); if (!m) return; last = src;
          const qb = U.toBase(E.dn(m.qty), m.unit), df = U.dispFactor(U.dim(m.unit));
          const v = F.parse(f.elements[src].value);
          const other = src === 'disp' ? 'pack' : 'disp';
          if (v === null) { f.elements[other].value = ''; return; }
          f.elements[other].value = F.fixed(src === 'disp' ? v.mul(qb).div(df) : v.div(qb.div(df)), 2);
        };
        f.elements.id.onchange = () => { info(); f.elements.disp.value = ''; f.elements.pack.value = ''; };
        f.elements.disp.addEventListener('input', () => sync('disp'));
        f.elements.pack.addEventListener('input', () => sync('pack'));
        info();
        f.onsubmit = (ev) => {
          ev.preventDefault();
          const m = mat(), errs = [];
          const raw = last === 'disp' ? f.elements.disp.value : f.elements.pack.value;
          const v = ui.readNum(raw, 'Nuevo precio', errs, { nonneg: true, required: true });
          if (errs.length) return ui.showErrs(f, errs);
          const qb = U.toBase(E.dn(m.qty), m.unit), df = U.dispFactor(U.dim(m.unit));
          const newPack = last === 'disp' ? v.mul(qb).div(df) : v;
          if (newPack.eq(E.dn(m.price))) return ui.showErrs(f, ['El precio es igual al actual']);
          m.price = newPack.toString(); m.updatedAt = SC.store.now();
          (m.history = m.history || []).push(E.historyEntry(m));
          ui.commit(); sh.close(); ui.toast('Precio actualizado');
        };
      },
    });
  }
  ui.priceSheet = priceSheet;

  /* ---------- costos indirectos ---------- */
  function indView(seg) {
    const list = ui.S.indirects.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const html = seg + '<div class="info small">Gas, electricidad, leña, film, mano de obra, etc. Se asignan dentro de cada receta (por tanda, por kg o por unidad) y no se pueden duplicar en una misma receta.</div>' +
      (list.length ? list.map((x) => '<div class="card click" data-a="indOpen" data-id="' + x.id + '"><div class="row"><div class="grow"><strong>' + esc(x.name) + '</strong><div class="small mt-s">' + esc(ui.costText(x, 'i')) + '</div></div><div class="num small">' + F.money(x.price) + '<div class="muted tiny">' + F.num(E.dn(x.qty)) + ' ' + U.label(x.unit) + '</div></div></div></div>').join('') : '<div class="empty">No cargaste costos indirectos todavía.</div>');
    return { title: 'Costos indirectos', sub: list.length + ' registrados', html, fab: 'indNew' };
  }
  ui.actions.indNew = () => indForm(null);
  ui.actions.indOpen = (d) => indForm(d.id);
  function indForm(id) {
    const cur = id ? ui.S.indirects.find((x) => x.id === id) : null;
    const m = cur || { name: '', unit: 'kg', qty: '1', price: '', notes: '' };
    const html = '<form id="if" novalidate><div class="errs"></div>' + ui.tf({ name: 'name', label: 'Nombre', value: m.name, ph: 'Ej.: Gas (garrafa 10 kg)' }) +
      '<div class="grid2">' + ui.nf({ name: 'qty', label: 'Cantidad que cubre el precio', value: m.qty }) + ui.sf({ name: 'unit', label: 'Unidad', options: U.INDIRECT_UNITS.map((u) => [u, U.UNITS[u].long]), value: m.unit }) + '</div>' +
      ui.nf({ name: 'price', label: 'Precio ($)', value: m.price }) + '<div class="info" id="icost">—</div>' + ui.tf({ name: 'notes', label: 'Observaciones', value: m.notes, area: true }) +
      '<div class="small muted mb">Mano de obra: cargala por hora (ej. $6.000 por 1 h) y luego indicá cuántas horas usa cada receta.</div>' +
      '<div class="btns"><button class="btn" type="submit">Guardar</button>' + (cur ? '<button class="btn danger" type="button" data-del>Eliminar</button>' : '') + '</div></form>';
    ui.sheet({
      title: cur ? 'Costo indirecto' : 'Nuevo costo indirecto', html,
      onMount(sh) {
        const f = ui.$('#if', sh.el);
        const prev = () => { const v = ui.formVals(f), errs = []; const q = ui.readNum(v.qty, 'q', errs, { pos: true }), p = ui.readNum(v.price, 'p', errs, { nonneg: true }); ui.$('#icost', sh.el).innerHTML = !errs.length && q && p ? esc(ui.costText({ id: 'x', unit: v.unit, qty: q.toString(), price: p.toString() }, 'i')) : 'Completá cantidad y precio.'; };
        f.addEventListener('input', prev); f.addEventListener('change', prev); prev();
        f.onsubmit = (ev) => {
          ev.preventDefault();
          const v = ui.formVals(f), errs = [];
          if (!v.name.trim()) errs.push('Completá el nombre');
          const q = ui.readNum(v.qty, 'Cantidad', errs, { pos: true, required: true }), p = ui.readNum(v.price, 'Precio', errs, { nonneg: true, required: true });
          if (cur && U.dim(cur.unit) !== U.dim(v.unit) && ui.usageOfIndirect(cur.id).length) errs.push('No se puede cambiar a otra magnitud: lo usan recetas.');
          if (errs.length) return ui.showErrs(f, errs);
          const rec = cur || { id: ui.uid(), createdAt: SC.store.now(), ownerId: null };
          Object.assign(rec, { name: v.name.trim(), unit: v.unit, qty: q.toString(), price: p.toString(), notes: v.notes.trim(), updatedAt: SC.store.now() });
          if (!cur) ui.S.indirects.push(rec);
          ui.commit(); sh.close(); ui.toast('Guardado');
        };
        const db = ui.$('[data-del]', sh.el);
        if (db) db.onclick = async () => {
          const use = ui.usageOfIndirect(cur.id);
          if (use.length) return ui.showErrs(f, ['No se puede eliminar: está en uso.', ...use]);
          if (await ui.confirm('¿Eliminar "' + cur.name + '"?')) { ui.S.indirects = ui.S.indirects.filter((x) => x.id !== cur.id); ui.commit(); sh.close(); }
        };
      },
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
