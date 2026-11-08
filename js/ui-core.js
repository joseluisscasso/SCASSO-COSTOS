/* SCASSO — Núcleo de interfaz: estado, router, hojas, confirmaciones, formularios, utilidades. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ST = SC.store;
  const ui = (SC.ui = { S: null, views: {}, actions: {}, inputHandler: null, saveError: null, sheets: [] });
  const doc = g.document;

  ui.esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = ui.esc;
  ui.uid = ST.uid;
  ui.$ = (s, r) => (r || doc).querySelector(s);
  ui.$$ = (s, r) => Array.from((r || doc).querySelectorAll(s));
  ui.dn = E.dn;

  /* ---------- contexto de cálculo (datos reales) ---------- */
  ui.ctx = function (over, extra) {
    const S = ui.S, byId = (a) => a.reduce((o, x) => ((o[x.id] = x), o), {});
    const c = { materials: byId(S.materials), recipes: byId(S.recipes), indirects: byId(S.indirects), batches: S.batches, over: over || null, cache: {} };
    if (extra) Object.assign(c.recipes, extra);
    return c;
  };

  /* ---------- guardado ---------- */
  let timer = null, saving = Promise.resolve();
  ui.commit = function (opts) {
    opts = opts || {};
    ui.S.meta.updatedAt = ST.now();
    clearTimeout(timer);
    timer = setTimeout(ui.flush, 120);
    if (!opts.quiet) ui.render();
  };
  ui.flush = function () {
    clearTimeout(timer);
    saving = saving.then(() => ST.adapter.save(ui.S)).then(() => { ui.saveError = null; }).catch((e) => {
      ui.saveError = e.message || String(e);
      ui.toast('No se pudo guardar: ' + ui.saveError, true);
      const b = ui.$('#savebanner'); if (b) b.style.display = 'block';
    });
    return saving;
  };
  g.addEventListener('pagehide', () => { if (timer) ui.flush(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden' && timer) ui.flush(); });

  /* ---------- toasts, hojas, confirmación ---------- */
  ui.toast = function (msg, bad) {
    const t = doc.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; doc.body.appendChild(t);
    setTimeout(() => t.remove(), bad ? 5000 : 2400);
  };
  ui.sheet = function (o) {
    const bg = doc.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><header><h2>' + esc(o.title || '') + '</h2><button class="iconbtn" data-close aria-label="Cerrar" type="button"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="body">' + (o.html || '') + '</div></div>';
    doc.body.appendChild(bg);
    const api = { el: bg, body: bg.querySelector('.body'), close() { bg.remove(); ui.sheets = ui.sheets.filter((s) => s !== api); if (o.onClose) o.onClose(); } };
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) api.close(); });
    ui.sheets.push(api);
    if (o.onMount) o.onMount(api);
    return api;
  };
  ui.closeSheets = () => ui.sheets.slice().forEach((s) => s.close());
  ui.confirm = function (msg, o) {
    o = o || {};
    return new Promise((res) => {
      let done = false;
      const sh = ui.sheet({
        title: o.title || 'Confirmar',
        html: '<p>' + esc(msg) + '</p><div class="btns mt"><button class="btn sec" data-no type="button">Cancelar</button><button class="btn ' + (o.danger === false ? '' : 'danger') + '" data-yes type="button">' + esc(o.ok || 'Eliminar') + '</button></div>',
        onClose() { if (!done) { done = true; res(false); } },
        onMount(a) {
          a.el.querySelector('[data-no]').onclick = () => a.close();
          a.el.querySelector('[data-yes]').onclick = () => { done = true; a.close(); res(true); };
        },
      });
    });
  };

  /* ---------- números: lectura y validación ---------- */
  // devuelve D o null; agrega mensaje a errs si es inválido
  ui.readNum = function (raw, label, errs, o) {
    o = o || {};
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (empty) { if (o.required) errs.push('Completá: ' + label); return null; }
    const v = F.parse(raw);
    if (v === null) { errs.push(label + ': número inválido'); return null; }
    if (o.pos && !v.isPos()) { errs.push(label + ' debe ser mayor a cero'); return null; }
    if (o.nonneg && v.isNeg()) { errs.push(label + ' no puede ser negativa'); return null; }
    if (o.max && v.gt(o.max)) { errs.push(label + ' no puede superar ' + o.max); return null; }
    return v;
  };
  ui.nf = function (o) {
    return '<label class="f"><span>' + esc(o.label) + '</span><input class="in" type="text" inputmode="decimal" autocomplete="off" data-num name="' + esc(o.name) + '" value="' + esc(o.value === undefined || o.value === null ? '' : o.value) + '" placeholder="' + esc(o.ph || '') + '"' + (o.bind ? ' data-bind="' + esc(o.bind) + '"' : '') + '>' + '<span class="hint prev">' + (o.hint ? esc(o.hint) : '') + '</span></label>';
  };
  ui.tf = function (o) {
    return '<label class="f"><span>' + esc(o.label) + '</span>' + (o.area ? '<textarea class="in" name="' + esc(o.name) + '"' + (o.bind ? ' data-bind="' + esc(o.bind) + '"' : '') + '>' + esc(o.value || '') + '</textarea>' : '<input class="in" type="text" name="' + esc(o.name) + '" value="' + esc(o.value || '') + '" placeholder="' + esc(o.ph || '') + '"' + (o.bind ? ' data-bind="' + esc(o.bind) + '"' : '') + ' autocomplete="off">') + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</label>';
  };
  ui.opts = (list, sel) => list.map((x) => { const v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  ui.sf = (o) => '<label class="f"><span>' + esc(o.label) + '</span><select class="in" name="' + esc(o.name) + '"' + (o.bind ? ' data-bind="' + esc(o.bind) + '"' : '') + (o.rerender ? ' data-rerender' : '') + '>' + ui.opts(o.options, o.value) + '</select></label>';
  // vista previa de números ("= 7.500") para evitar errores de tipeo
  doc.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input[data-num]')) {
      const hint = t.closest('label') && t.closest('label').querySelector('.prev');
      const raw = t.value.trim();
      t.classList.remove('bad');
      if (!hint) return;
      if (!raw) { hint.textContent = ''; return; }
      const v = F.parse(raw);
      if (v === null) { hint.textContent = 'Número no válido'; t.classList.add('bad'); } else hint.textContent = '= ' + F.num(v, 6);
    }
  });
  ui.formVals = (root) => { const o = {}; ui.$$('[name]', root).forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };
  ui.showErrs = (root, errs) => {
    let box = ui.$('.errs', root);
    if (!box) { box = doc.createElement('div'); box.className = 'errs'; root.prepend(box); }
    box.innerHTML = errs.length ? '<div class="err">' + errs.map((e) => '• ' + esc(e)).join('<br>') + '</div>' : '';
    if (errs.length) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /* ---------- referencias a ingredientes (materias / recetas / subproductos) ---------- */
  ui.refSelect = function (sel, o) {
    o = o || {};
    const S = ui.S;
    let h = '<option value="">— Elegir —</option>';
    if (!o.noMat && S.materials.length) h += '<optgroup label="Materias primas">' + S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((m) => '<option value="m:' + m.id + '"' + (sel === 'm:' + m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</optgroup>';
    const recs = S.recipes.filter((r) => r.id !== o.excludeRecipe);
    if (recs.length) h += '<optgroup label="Recetas / elaboraciones">' + recs.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((r) => '<option value="r:' + r.id + '"' + (sel === 'r:' + r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</optgroup>';
    const bs = [];
    recs.forEach((r) => (r.byproducts || []).forEach((b) => bs.push([r, b])));
    if (bs.length) h += '<optgroup label="Subproductos recuperados">' + bs.map(([r, b]) => { const v = 'b:' + r.id + ':' + b.id; return '<option value="' + v + '"' + (sel === v ? ' selected' : '') + '>' + esc(b.name) + ' (de ' + esc(r.name) + ')</option>'; }).join('') + '</optgroup>';
    return h;
  };
  ui.refValue = (x) => (!x.ref ? '' : x.kind === 'b' ? 'b:' + x.ref + ':' + x.bp : x.kind + ':' + x.ref);
  ui.parseRef = function (v) {
    if (!v) return { kind: 'm', ref: '', bp: undefined };
    const p = v.split(':');
    return { kind: p[0], ref: p[1], bp: p[2] };
  };
  ui.unitsForRef = function (kind, ref, bp) {
    const S = ui.S;
    if (kind === 'm') { const m = S.materials.find((x) => x.id === ref); return m ? U.unitsOfDim(U.dim(m.unit)) : U.PURCHASE_UNITS; }
    if (kind === 'r') {
      const r = S.recipes.find((x) => x.id === ref); if (!r) return ['kg', 'g'];
      const l = U.unitsOfDim(U.dim(r.yieldUnit || 'kg'));
      if (E.dn(r.portions).isPos()) l.push('porc');
      return l;
    }
    if (kind === 'b') { const r = S.recipes.find((x) => x.id === ref); const b = r && (r.byproducts || []).find((x) => x.id === bp); return b ? U.unitsOfDim(U.dim(b.unit)) : ['kg', 'g']; }
    return ['kg', 'g'];
  };
  ui.unitOpts = (list, sel) => ui.opts(list.map((u) => [u, U.UNITS[u].l]), sel);
  ui.defaultUnit = (kind, ref, bp) => { const l = ui.unitsForRef(kind, ref, bp); return l.includes('g') ? 'g' : l.includes('ml') ? 'ml' : l[0]; };

  /* ---------- formato ---------- */
  ui.money = F.money; ui.pct = F.pct; ui.num = F.num; ui.date = F.date;
  ui.qty = (d, unit) => F.num(d, 3) + ' ' + U.label(unit);
  // cantidad en unidad base -> texto cómodo (g -> kg si >= 1000)
  ui.baseQty = function (qtyBase, dim) {
    qtyBase = D.of(qtyBase);
    if ((dim === 'masa' || dim === 'vol') && qtyBase.abs().gte(1000)) return F.num(qtyBase.div(1000), 3) + ' ' + (dim === 'masa' ? 'kg' : 'l');
    return F.num(qtyBase, 3) + ' ' + U.label(U.baseUnit(dim));
  };
  ui.cost = (m) => { try { return E.unitCostDisp(m, ui.ctx(), 'm'); } catch (e) { return null; } };
  ui.costText = function (item, kind) {
    try {
      const c = E.unitCostDisp(item, ui.ctx(), kind || 'm');
      let t = F.money(c.value) + ' / ' + U.label(c.unit);
      if (c.dim === 'masa' || c.dim === 'vol') t += '  ·  ' + F.money(c.perBase) + ' / ' + U.label(U.baseUnit(c.dim));
      return t;
    } catch (e) { return 'cantidad inválida'; }
  };
  ui.CATS_MAT = ['Carnes', 'Verduras', 'Frutas', 'Lácteos', 'Quesos', 'Aceites y grasas', 'Especias y condimentos', 'Harinas y panificados', 'Bebidas', 'Envases y packaging', 'Otros'];
  ui.CATS_REC = ['Elaboraciones base', 'Carnes', 'Salsas', 'Panificados', 'Guarniciones', 'Encurtidos', 'Otros'];
  ui.CATS_PROD = ['Sándwiches', 'Porciones', 'Bandejas / por kg', 'Combos', 'Otros'];

  /* ---------- fotos ---------- */
  ui.pickPhoto = function (file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('No se pudo leer la imagen'));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => rej(new Error('Imagen no válida'));
        im.onload = () => {
          const max = 800, k = Math.min(1, max / Math.max(im.width, im.height));
          const c = doc.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  ui.photoField = (cur) => '<div class="f"><span class="small" style="font-weight:600;color:var(--olive-d)">Fotografía (opcional)</span>' + (cur ? '<img class="photo mt-s" data-photo-img src="' + cur + '" alt="">' : '<img class="photo mt-s" data-photo-img style="display:none" alt="">') + '<div class="btns mt-s"><label class="btn sec sm" style="cursor:pointer">Sacar / elegir foto<input type="file" accept="image/*" capture="environment" data-photo-in style="display:none"></label>' + '<button class="btn sec sm" type="button" data-photo-clear>Quitar</button></div></div>';
  ui.bindPhoto = function (root, get, set) {
    const inp = ui.$('[data-photo-in]', root), img = ui.$('[data-photo-img]', root);
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      try { const d = await ui.pickPhoto(inp.files[0]); set(d); img.src = d; img.style.display = 'block'; } catch (e) { ui.toast(e.message, true); }
    };
    ui.$('[data-photo-clear]', root).onclick = () => { set(''); img.style.display = 'none'; img.removeAttribute('src'); };
  };

  /* ---------- descargas / compartir ---------- */
  ui.download = function (blob, name) {
    const a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  ui.share = async function (blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: title || name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    ui.download(blob, name);
    ui.toast('Este dispositivo no permite compartir directo: se descargó el archivo');
  };

  /* ---------- gráfico de líneas SVG simple ---------- */
  ui.lineChart = function (series, labels, o) {
    o = o || {};
    const W = 320, H = 150, pl = 38, pr = 10, pt = 10, pb = 22;
    const all = series.flatMap((s) => s.values.filter((v) => v !== null));
    if (!all.length) return '';
    let mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
    const x = (i) => pl + (labels.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (labels.length - 1));
    const y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    for (let k = 0; k <= 3; k++) { const v = mn + ((mx - mn) * k) / 3, yy = y(v); s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e3dccb"/><text x="' + (pl - 4) + '" y="' + (yy + 3) + '" font-size="9" text-anchor="end" fill="#8b8578">' + esc(o.fmt ? o.fmt(v) : Math.round(v)) + '</text>'; }
    series.forEach((se) => {
      const pts = se.values.map((v, i) => (v === null ? null : [x(i), y(v)]));
      const path = pts.filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      s += '<path d="' + path + '" fill="none" stroke="' + se.color + '" stroke-width="2.2"/>';
      pts.forEach((p) => { if (p) s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.2" fill="' + se.color + '"/>'; });
    });
    labels.forEach((l, i) => { s += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="9" text-anchor="middle" fill="#8b8578">' + esc(l) + '</text>'; });
    return s + '</svg>';
  };

  /* ---------- router y layout ---------- */
  const ICONS = {
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    chart: '<path d="M4 20V6M10 20V10M16 20v-6M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
  };
  ui.icon = (n) => '<svg viewBox="0 0 24 24">' + ICONS[n] + '</svg>';
  const NAV = [['dash', 'Inicio', 'home'], ['mat', 'Materias', 'box'], ['rec', 'Recetas', 'book'], ['prod', 'Productos', 'tag'], ['inf', 'Informes', 'chart']];
  ui.route = function () { const p = (location.hash || '#/dash').slice(2).split('/').filter(Boolean); return p.length ? p : ['dash']; };
  ui.go = (h) => { if (location.hash === h) ui.render(); else location.hash = h; };
  ui.seg = (items, cur) => '<div class="seg">' + items.map(([k, l, h]) => '<a href="' + h + '" class="' + (k === cur ? 'on' : '') + '">' + esc(l) + '</a>').join('') + '</div>';

  ui.render = function () {
    const app = ui.$('#app');
    const parts = ui.route(), name = parts[0];
    ui.inputHandler = null;
    const view = ui.views[name];
    if (!view) { location.hash = '#/dash'; return; }
    let v;
    try { v = view(parts.slice(1)); } catch (e) { console.error(e); v = { title: 'Error', html: '<div class="err">Ocurrió un error al mostrar esta pantalla: ' + esc(e.message) + '</div>' }; }
    const navKey = name === 'sim' || name === 'cfg' ? 'dash' : name;
    const sy = g.scrollY;
    app.innerHTML =
      '<div class="top">' +
      (v.back ? '<a class="iconbtn" href="' + v.back + '" aria-label="Volver">' + ui.icon('back') + '</a>' : '<img class="logo" src="icons/mark.png" alt="SCASSO">') +
      '<div class="ttl"><h1>' + esc(v.title || '') + '</h1>' + (v.sub ? '<div class="sub">' + esc(v.sub) + '</div>' : '') + '</div>' +
      (v.topRight || '') + '</div>' +
      '<div id="savebanner" class="err" style="display:' + (ui.saveError ? 'block' : 'none') + ';margin:6px 16px">No se está guardando: ' + esc(ui.saveError || '') + '. Exportá una copia de seguridad desde Configuración.</div>' +
      '<main>' + v.html + '</main>' +
      (v.fab ? '<button class="fab" data-a="' + v.fab + '" aria-label="Agregar">+</button>' : '') +
      '<nav class="bottom">' + NAV.map(([k, l, ic]) => '<a href="#/' + k + '" class="' + (k === navKey ? 'on' : '') + '">' + ui.icon(ic) + '<span>' + l + '</span></a>').join('') + '</nav>';
    if (v.mount) v.mount(ui.$('main'));
    if (v.keepScroll) g.scrollTo(0, sy); else g.scrollTo(0, 0);
  };
  g.addEventListener('hashchange', () => ui.render());

  doc.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = ui.actions[el.dataset.a];
    if (fn) { e.preventDefault(); try { const r = fn(el.dataset, el, e); if (r && r.catch) r.catch((er) => { console.error(er); ui.toast(er.message, true); }); } catch (er) { console.error(er); ui.toast(er.message, true); } }
  });
  doc.addEventListener('input', (e) => { if (ui.inputHandler) ui.inputHandler(e, 'input'); });
  doc.addEventListener('change', (e) => { if (ui.inputHandler) ui.inputHandler(e, 'change'); });

  // set por ruta "a.b.0.c"
  ui.setPath = function (o, path, v) { const p = path.split('.'); let t = o; for (let i = 0; i < p.length - 1; i++) t = t[p[i]]; t[p[p.length - 1]] = v; };
  ui.getPath = function (o, path) { return path.split('.').reduce((t, k) => (t === undefined || t === null ? t : t[k]), o); };
})(typeof window !== 'undefined' ? window : globalThis);
