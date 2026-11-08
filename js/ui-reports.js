/* SCASSO — Informes y exportación (CSV, Excel .xlsx y PDF real, compartibles desde el teléfono).
   Cada informe es una tabla tipada: cols [{h, t}] con t = s (texto) | $ | % | n | d (fecha); filas con D, texto o null. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ui = SC.ui, esc = ui.esc, dn = E.dn;
  const ZERO = D.of(0);
  const today = () => F.today();

  /* ================= formato de celdas ================= */
  function norm(rep) {
    const cols = rep.cols.map((c, i) => {
      if (typeof c === 'object') return c;
      const first = rep.rows.map((r) => r[i]).find((v) => v !== null && v !== undefined && v !== '');
      return { h: c, t: typeof first === 'number' || first instanceof D ? 'n' : 's' };
    });
    return Object.assign({}, rep, { cols });
  }
  const isEmpty = (v) => v === null || v === undefined || v === '';
  function disp(col, v) {
    if (isEmpty(v)) return '—';
    if (col.t === 's') return String(v);
    if (col.t === 'd') return F.date(v);
    if (col.t === '$') return F.money(v);
    if (col.t === '%') return F.pct(v, 2);
    return F.num(D.of(v), 3);
  }
  // valor exportable: número real (no texto formateado) para que Excel pueda sumar y ordenar
  function expVal(col, v) {
    if (isEmpty(v)) return '';
    if (col.t === 's') return String(v);
    if (col.t === 'd') return F.date(v);
    let d = D.of(v);
    if (col.t === '%') d = d.mul(100);
    const dp = col.t === '$' && d.abs().lt(1) && !d.isZero() ? 4 : col.t === 'n' ? 4 : 2;
    return Number(d.toFixed(dp));
  }
  const csvNum = (n) => String(n).replace('.', ',');

  /* ================= generadores de informes ================= */
  const REPORTS = [
    { id: 'rec', icon: '📋', title: 'Costos por receta', desc: 'Costo total, merma, rendimiento y costo terminado' },
    { id: 'kg', icon: '⚖️', title: 'Costos por kilogramo', desc: 'Por kg de materia prima y por kg terminado' },
    { id: 'por', icon: '🍽️', title: 'Costos por porción', desc: 'Recetas con porciones y productos por unidad' },
    { id: 'prod', icon: '🥪', title: 'Costos por producto', desc: 'Elaboración, packaging, costo total y margen' },
    { id: 'mar', icon: '💹', title: 'Márgenes comerciales', desc: 'Margen bruto y contribución después de costos de venta' },
    { id: 'hist', icon: '🏷️', title: 'Historial de precios', desc: 'Cambios de precio de cada materia prima' },
    { id: 'evol', icon: '📈', title: 'Evolución de costos', desc: 'Costo real de cada tanda a lo largo del tiempo' },
    { id: 'rend', icon: '🔥', title: 'Rendimiento de producciones', desc: 'Peso inicial, final, merma y rendimiento por tanda' },
  ];
  let flt = { mat: 'all', rec: 'all' };

  function build(id) {
    const S = ui.S, ctx = ui.ctx(), low = dn(S.settings.lowMargin).div(100), target = dn(S.settings.targetMargin).div(100);
    const recs = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const rcs = recs.map((r) => [r, E.recipeCalc(r, ctx)]);
    const yieldTxt = (rc) => (rc.yieldSource.type === 'real' ? 'real (' + rc.yieldSource.n + ' tanda' + (rc.yieldSource.n > 1 ? 's' : '') + ')' : 'estimado');
    const prodRows = [];
    S.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach((p) => (p.variants || []).forEach((v) => {
      const vc = E.variantCalc(v, ctx), price = dn(v.salePrice), m = price.isPos() ? E.metrics(vc.total, price, v.fees) : null;
      let sugg = null; try { sugg = E.priceForMargin(vc.total, target); } catch (e) { /* sin objetivo */ }
      prodRows.push({ p, v, vc, price, m, sugg });
    }));
    const note = 'Costos ESTIMADOS con los precios ACTUALES de materias primas.';

    if (id === 'rec') {
      return { title: 'Costos por receta', file: 'costos-por-receta', note, cols: [{ h: 'Receta', t: 's' }, { h: 'Categoría', t: 's' }, { h: 'Costo total', t: '$' }, { h: 'Merma %', t: '%' }, { h: 'Rendimiento %', t: '%' }, { h: 'Costo terminado', t: '$' }, { h: 'Por', t: 's' }, { h: 'Costo por porción', t: '$' }, { h: 'Base del rendimiento', t: 's' }],
        rows: rcs.map(([r, rc]) => [r.name, r.category, rc.total, rc.mermaPct, rc.yieldPct, rc.perDisp, rc.dispUnit, rc.perPortion, yieldTxt(rc)]) };
    }
    if (id === 'kg') {
      const rows = rcs.filter(([, rc]) => rc.yieldDim === 'masa').map(([r, rc]) => [r.name, rc.total, rc.rawCostPerKg, rc.initialW.isPos() ? rc.initialW.div(1000) : null, rc.finalBase ? rc.finalBase.div(1000) : null, rc.perKg, rc.per100g, yieldTxt(rc)]);
      return { title: 'Costos por kilogramo', file: 'costos-por-kg', note: note + ' El costo por kg terminado se calcula sobre el peso final aprovechable, no sobre el inicial.', cols: [{ h: 'Receta', t: 's' }, { h: 'Costo total', t: '$' }, { h: 'Costo por kg de materia prima', t: '$' }, { h: 'Peso inicial (kg)', t: 'n' }, { h: 'Peso final (kg)', t: 'n' }, { h: 'Costo por kg terminado', t: '$' }, { h: 'Costo por 100 g', t: '$' }, { h: 'Base del rendimiento', t: 's' }], rows };
    }
    if (id === 'por') {
      const rows = [];
      rcs.forEach(([r, rc]) => { if (rc.perPortion) rows.push(['Receta', r.name, '', rc.portions, rc.perPortion]); });
      prodRows.forEach((x) => rows.push(['Producto', x.p.name, x.v.name || 'Estándar', 1, x.vc.total]));
      return { title: 'Costos por porción', file: 'costos-por-porcion', note: note + ' Los productos se informan por unidad vendida.', cols: [{ h: 'Tipo', t: 's' }, { h: 'Nombre', t: 's' }, { h: 'Variante', t: 's' }, { h: 'Porciones / unidades', t: 'n' }, { h: 'Costo por porción', t: '$' }], rows };
    }
    if (id === 'prod') {
      return { title: 'Costos por producto', file: 'costos-por-producto', note, cols: [{ h: 'Producto', t: 's' }, { h: 'Variante', t: 's' }, { h: 'Elaboración', t: '$' }, { h: 'Packaging', t: '$' }, { h: 'Costo total', t: '$' }, { h: 'Precio de venta', t: '$' }, { h: 'Ganancia bruta', t: '$' }, { h: 'Margen %', t: '%' }, { h: 'Food cost %', t: '%' }, { h: 'Markup %', t: '%' }, { h: 'Precio sugerido (margen objetivo)', t: '$' }],
        rows: prodRows.map((x) => [x.p.name, x.v.name || 'Estándar', x.vc.food, x.vc.packaging, x.vc.total, x.m ? x.price : null, x.m ? x.m.gross : null, x.m ? x.m.marginPct : null, x.m ? x.m.foodCost : null, x.m ? x.m.markup : null, x.sugg]) };
    }
    if (id === 'mar') {
      return { title: 'Márgenes comerciales', file: 'margenes-comerciales', note: note + ' Margen = ganancia / precio de venta (no es el recargo sobre costo). Contribución = ganancia bruta menos comisiones, impuestos y costos de venta.', cols: [{ h: 'Producto', t: 's' }, { h: 'Variante', t: 's' }, { h: 'Costo', t: '$' }, { h: 'Precio efectivo', t: '$' }, { h: 'Margen bruto %', t: '%' }, { h: 'Costos de venta', t: '$' }, { h: 'Contribución', t: '$' }, { h: 'Contribución %', t: '%' }, { h: 'Estado', t: 's' }],
        rows: prodRows.filter((x) => x.m).map((x) => [x.p.name, x.v.name || 'Estándar', x.vc.total, x.m.effPrice, x.m.marginPct, x.m.saleVar, x.m.contribution, x.m.contributionPct, x.m.marginPct !== null && x.m.marginPct.lt(low) ? 'Margen bajo' : 'OK']) };
    }
    if (id === 'hist') {
      const rows = [];
      S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).filter((m) => flt.mat === 'all' || m.id === flt.mat).forEach((m) => {
        (m.history || []).forEach((h, i, a) => {
          const dim = U.dim(h.unit), now = dn(h.perBase), prev = i ? dn(a[i - 1].perBase) : null;
          rows.push([m.name, h.date, dn(h.price), F.num(dn(h.qty)) + ' ' + U.label(h.unit), now.mul(U.dispFactor(dim)), U.label(U.dispUnit(dim)), prev && prev.isPos() ? now.sub(prev).div(prev) : null]);
        });
      });
      return { title: 'Historial de precios', file: 'historial-de-precios', note: 'Precios HISTÓRICOS registrados cada vez que se cargó o actualizó una materia prima.', cols: [{ h: 'Materia prima', t: 's' }, { h: 'Fecha', t: 'd' }, { h: 'Precio del envase', t: '$' }, { h: 'Envase', t: 's' }, { h: 'Costo por unidad', t: '$' }, { h: 'Unidad', t: 's' }, { h: 'Variación %', t: '%' }], rows };
    }
    if (id === 'evol' || id === 'rend') {
      const bs = S.batches.filter((b) => flt.rec === 'all' || b.recipeId === flt.rec).slice().sort((a, b) => a.recipeName.localeCompare(b.recipeName, 'es') || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      const per = (c) => (c.perKg !== null && c.perKg !== undefined ? c.perKg : c.perUnit !== null && c.perUnit !== undefined ? c.perUnit : c.perLiter);
      const cnt = {}, prev = {};
      const rows = bs.map((b) => {
        const c = b.calc; cnt[b.recipeId] = (cnt[b.recipeId] || 0) + 1;
        const pc = per(c), pp = prev[b.recipeId]; prev[b.recipeId] = pc;
        const unit = c.perKg ? 'kg' : c.perUnit ? 'un' : c.perLiter ? 'l' : '';
        if (id === 'evol') return [b.recipeName, 'T' + cnt[b.recipeId], b.date, dn(c.total), pc === undefined || pc === null ? null : dn(pc), unit, pc && pp && dn(pp).isPos() ? dn(pc).sub(dn(pp)).div(dn(pp)) : null];
        const ini = c.initialG && dn(c.initialG).isPos() ? dn(c.initialG).div(1000) : null;
        const fin = c.yieldDim === 'masa' ? dn(c.finalBase).div(1000) : dn(c.finalBase);
        return [b.recipeName, 'T' + cnt[b.recipeId], b.date, ini, fin, c.mermaPct === undefined ? null : c.mermaPct, c.yieldPct === undefined ? null : c.yieldPct, pc === undefined || pc === null ? null : dn(pc), (c.bps || []).map((x) => x.name + ' ' + F.num(dn(x.qty)) + ' ' + U.label(x.unit)).join(', ')];
      });
      const realNote = 'Costos REALES: se calcularon con los precios vigentes el día de cada tanda y NO cambian cuando sube una materia prima.';
      if (id === 'evol') return { title: 'Evolución de costos', file: 'evolucion-de-costos', note: realNote, cols: [{ h: 'Receta', t: 's' }, { h: 'Tanda', t: 's' }, { h: 'Fecha', t: 'd' }, { h: 'Costo total de tanda', t: '$' }, { h: 'Costo por kg / un terminado', t: '$' }, { h: 'Por', t: 's' }, { h: 'Variación vs tanda anterior %', t: '%' }], rows, chartRows: bs };
      return { title: 'Rendimiento de producciones', file: 'rendimiento-de-producciones', note: realNote, cols: [{ h: 'Receta', t: 's' }, { h: 'Tanda', t: 's' }, { h: 'Fecha', t: 'd' }, { h: 'Peso inicial (kg)', t: 'n' }, { h: 'Peso final', t: 'n' }, { h: 'Merma %', t: '%' }, { h: 'Rendimiento %', t: '%' }, { h: 'Costo por kg / un terminado', t: '$' }, { h: 'Subproductos recuperados', t: 's' }], rows, chartRows: bs };
    }
    throw new Error('Informe desconocido');
  }
  ui.buildReport = build;

  /* ================= PDF (generado a mano, sin librerías) ================= */
  const L1 = (s) => String(s).replace(/[—–]/g, '-').replace(/→/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/▲/g, '^').replace(/▼/g, 'v').replace(/…/g, '...').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  const pdfEsc = (s) => L1(s).replace(/[\\()]/g, '\\$&');
  function cw(ch) {
    if (/[0-9]/.test(ch)) return 556;
    if (' .,:;/!|\''.includes(ch)) return 278;
    if (ch === '-') return 333;
    if (ch === '%') return 889;
    if ('ilj'.includes(ch)) return 222;
    if ('mwMW'.includes(ch)) return 833;
    if (/[A-Z]/.test(ch)) return 667;
    return 500;
  }
  const tw = (s, size) => Array.from(L1(s)).reduce((a, c) => a + cw(c), 0) * size / 1000;
  function wrap(text, width, size) {
    const out = []; let cur = '';
    String(text).split(/\s+/).forEach((w) => {
      while (tw(w, size) > width && w.length > 1) { // palabra más ancha que la celda
        let k = w.length; while (k > 1 && tw(w.slice(0, k), size) > width) k--;
        if (cur) { out.push(cur); cur = ''; }
        out.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = cur ? cur + ' ' + w : w;
      if (tw(t, size) <= width || !cur) cur = t; else { out.push(cur); cur = w; }
    });
    if (cur || !out.length) out.push(cur);
    return out;
  }
  function pdfBuild(rep) {
    rep = norm(rep);
    const land = rep.cols.length > 6, W = land ? 842 : 595, H = land ? 595 : 842, M = 30, FS = 8, LH = 10.5, PAD = 4;
    const usable = W - 2 * M;
    const head = rep.cols.map((c) => c.h);
    const body = rep.rows.map((r) => r.map((v, i) => disp(rep.cols[i], v)));
    // anchos
    const nat = rep.cols.map((c, i) => Math.max(Math.max(...String(head[i]).split(/\s+/).map((w) => tw(w, FS))) + 1, ...body.map((r) => Math.min(tw(r[i], FS), 150))) + 2 * PAD + 2);
    const sum = nat.reduce((a, b) => a + b, 0), k = sum > usable ? usable / sum : 1;
    const widths = nat.map((n) => Math.max(34, n * k));
    const wsum = widths.reduce((a, b) => a + b, 0), k2 = wsum > usable ? usable / wsum : 1;
    const ws = widths.map((w) => w * k2);
    const xs = ws.reduce((a, w, i) => (a.push(i ? a[i - 1] + ws[i - 1] : M), a), []);
    const hLines = head.map((h, i) => wrap(h, ws[i] - 2 * PAD, FS));
    const hH = Math.max(...hLines.map((l) => l.length)) * LH + 6;
    const rowsL = body.map((r) => r.map((t, i) => wrap(t, ws[i] - 2 * PAD, FS)));
    const pages = []; let ops = [], y;
    const newPage = (first) => {
      ops = []; y = H - M;
      if (first) {
        ops.push('0.165 0.212 0.114 rg BT /F2 15 Tf ' + M + ' ' + (y - 12) + ' Td (SCASSO - Porchetta Artigianale) Tj ET');
        ops.push('0.75 0.38 0.23 rg BT /F2 12 Tf ' + M + ' ' + (y - 30) + ' Td (' + pdfEsc(rep.title) + ') Tj ET');
        ops.push('0.35 0.33 0.30 rg BT /F1 8 Tf ' + M + ' ' + (y - 43) + ' Td (Generado el ' + F.date(today()) + ') Tj ET');
        y -= 52;
        wrap(rep.note || '', usable, 8).forEach((ln) => { if (ln) { ops.push('0.35 0.33 0.30 rg BT /F1 8 Tf ' + M + ' ' + (y - 8) + ' Td (' + pdfEsc(ln) + ') Tj ET'); y -= 10.5; } });
        y -= 8;
      }
      ops.push('0.165 0.212 0.114 rg ' + M + ' ' + (y - hH) + ' ' + usable + ' ' + hH + ' re f');
      hLines.forEach((ls, i) => ls.forEach((ln, j) => { const x = rep.cols[i].t === 's' || rep.cols[i].t === 'd' ? xs[i] + PAD : xs[i] + ws[i] - PAD - tw(ln, FS); ops.push('1 1 1 rg BT /F2 ' + FS + ' Tf ' + x.toFixed(2) + ' ' + (y - 9 - j * LH).toFixed(2) + ' Td (' + pdfEsc(ln) + ') Tj ET'); }));
      y -= hH; pages.push(ops);
    };
    newPage(true);
    if (!body.length) ops.push('0.35 0.33 0.30 rg BT /F1 10 Tf ' + M + ' ' + (y - 16) + ' Td (Sin datos para este informe.) Tj ET');
    rowsL.forEach((cells, ri) => {
      const rh = Math.max(...cells.map((l) => l.length)) * LH + 5;
      if (y - rh < M + 18) newPage(false);
      if (ri % 2) ops.push('0.97 0.95 0.90 rg ' + M + ' ' + (y - rh).toFixed(2) + ' ' + usable + ' ' + rh.toFixed(2) + ' re f');
      cells.forEach((ls, i) => ls.forEach((ln, j) => { const x = rep.cols[i].t === 's' || rep.cols[i].t === 'd' ? xs[i] + PAD : xs[i] + ws[i] - PAD - tw(ln, FS); ops.push('0.12 0.11 0.10 rg BT /F1 ' + FS + ' Tf ' + x.toFixed(2) + ' ' + (y - 9 - j * LH).toFixed(2) + ' Td (' + pdfEsc(ln) + ') Tj ET'); }));
      ops.push('0.89 0.86 0.80 RG 0.4 w ' + M + ' ' + (y - rh).toFixed(2) + ' m ' + (W - M) + ' ' + (y - rh).toFixed(2) + ' l S');
      y -= rh;
    });
    const total = pages.length;
    pages.forEach((p, i) => p.push('0.55 0.52 0.47 rg BT /F1 7.5 Tf ' + M + ' 16 Td (SCASSO - Costos gastronomicos) Tj ET BT /F1 7.5 Tf ' + (W - M - 60) + ' 16 Td (Pagina ' + (i + 1) + ' de ' + total + ') Tj ET'));
    // ensamblado
    const objs = [null, '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [' + pages.map((_, i) => 5 + 2 * i + ' 0 R').join(' ') + '] /Count ' + total + ' >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    pages.forEach((p, i) => {
      const c = p.join('\n');
      objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + 2 * i) + ' 0 R >>');
      objs.push('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
    });
    let out = '%PDF-1.4\n'; const off = [];
    for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
    const xr = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n' + off.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  /* ================= exportación ================= */
  function toCsv(rep) {
    rep = norm(rep);
    const q = (v) => { const s = typeof v === 'number' ? csvNum(v) : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [[rep.title], [rep.note || ''], [], rep.cols.map((c) => c.h)].map((r) => r.map(q).join(';'));
    rep.rows.forEach((r) => lines.push(r.map((v, i) => q(expVal(rep.cols[i], v))).join(';')));
    return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }
  function toXlsx(rep) {
    rep = norm(rep);
    const rows = [[rep.title], [rep.note || ''], [], rep.cols.map((c) => c.h)];
    rep.rows.forEach((r) => rows.push(r.map((v, i) => { const x = expVal(rep.cols[i], v); return typeof x === 'number' ? { n: x } : x; })));
    return SC.xlsx.build([{ name: rep.title, rows }]);
  }
  ui.exportReport = async function (rep, fmt) {
    if (!rep) return ui.toast('No hay datos para exportar', true);
    const name = (rep.file || 'informe') + '-' + today();
    try {
      if (fmt === 'csv') ui.download(toCsv(rep), name + '.csv');
      else if (fmt === 'xlsx') ui.download(toXlsx(rep), name + '.xlsx');
      else if (fmt === 'pdf') ui.download(pdfBuild(rep), name + '.pdf');
      else if (fmt === 'share') await ui.share(pdfBuild(rep), name + '.pdf', rep.title);
    } catch (e) { console.error(e); ui.toast('No se pudo exportar: ' + e.message, true); }
  };
  ui.reportBlob = { csv: toCsv, xlsx: toXlsx, pdf: pdfBuild };

  /* ================= vistas ================= */
  let CUR = null;
  ui.views.inf = function (p) {
    const S = ui.S;
    const def = REPORTS.find((x) => x.id === p[0]);
    if (!def) {
      const html = '<div class="info small">Elegí un informe. Todos se pueden exportar a <b>PDF</b>, <b>Excel</b> y <b>CSV</b>, y compartir desde el teléfono (WhatsApp, correo, Drive).</div>' +
        REPORTS.map((r) => '<div class="card click" data-a="go" data-h="#/inf/' + r.id + '"><div class="row"><div style="font-size:1.6rem;width:36px;text-align:center">' + r.icon + '</div><div class="grow"><strong>' + esc(r.title) + '</strong><div class="muted small">' + esc(r.desc) + '</div></div><span class="muted">›</span></div></div>').join('') +
        '<div class="card click" data-a="go" data-h="#/sim" style="border-color:var(--terra)"><div class="row"><div style="font-size:1.6rem;width:36px;text-align:center">🧪</div><div class="grow"><strong>Simulador de escenarios</strong><div class="muted small">Probá un precio nuevo y mirá el impacto en cada producto</div></div><span class="muted">›</span></div></div>';
      return { title: 'Informes', sub: 'Análisis y exportación', html };
    }
    let rep;
    try { rep = build(def.id); } catch (e) { return { title: def.title, back: '#/inf', html: '<div class="err">' + esc(e.message) + '</div>' }; }
    CUR = rep;
    let filt = '';
    if (def.id === 'hist') filt = '<label class="f"><span>Materia prima</span><select class="in" id="rf" data-k="mat">' + ui.opts([['all', 'Todas']].concat(S.materials.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((m) => [m.id, m.name])), flt.mat) + '</select></label>';
    if (def.id === 'evol' || def.id === 'rend') {
      const ids = [...new Set(S.batches.map((b) => b.recipeId))];
      const nm = (id) => { const b = S.batches.find((x) => x.recipeId === id); return b ? b.recipeName : '?'; };
      if (!ids.includes(flt.rec)) flt.rec = 'all';
      filt = '<label class="f"><span>Receta</span><select class="in" id="rf" data-k="rec">' + ui.opts([['all', 'Todas']].concat(ids.map((i) => [i, nm(i)])), flt.rec) + '</select></label>';
    }
    let chart = '';
    if (rep.chartRows && flt.rec !== 'all') {
      const bs = rep.chartRows;
      if (bs.length > 1) {
        const labels = bs.map((_, i) => 'T' + (i + 1));
        const val = (b) => { const c = b.calc, v = c.perKg !== null && c.perKg !== undefined ? c.perKg : c.perUnit !== null && c.perUnit !== undefined ? c.perUnit : c.perLiter; return v === null || v === undefined ? null : dn(v).toNumber(); };
        chart = def.id === 'evol'
          ? '<div class="card"><div class="small muted">Costo por kg / un terminado ($)</div>' + ui.lineChart([{ values: bs.map(val), color: '#c0603a' }], labels, { fmt: (v) => Math.round(v).toLocaleString('es-AR') }) + '</div>'
          : '<div class="card"><div class="small muted">Rendimiento (%)</div>' + ui.lineChart([{ values: bs.map((b) => (b.calc.yieldPct ? dn(b.calc.yieldPct).mul(100).toNumber() : null)), color: '#3b4a2a' }], labels, { fmt: (v) => v.toFixed(0) }) + '<div class="small muted mt-s">Costo por kg terminado ($)</div>' + ui.lineChart([{ values: bs.map(val), color: '#c0603a' }], labels, { fmt: (v) => Math.round(v).toLocaleString('es-AR') }) + '</div>';
      }
    }
    const nrep = norm(rep);
    const table = rep.rows.length
      ? '<div class="card" style="padding:6px"><div class="scrollx"><table class="tbl"><thead><tr>' + nrep.cols.map((c) => '<th class="' + (c.t === 's' || c.t === 'd' ? '' : 'num') + '">' + esc(c.h) + '</th>').join('') + '</tr></thead><tbody>' + rep.rows.map((r) => '<tr>' + r.map((v, i) => { const c = nrep.cols[i], t = disp(c, v), cls = c.t === 's' || c.t === 'd' ? '' : 'num'; return '<td class="' + cls + '">' + esc(t) + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div></div>'
      : '<div class="empty">No hay datos para este informe todavía.</div>';
    const html = (rep.note ? '<div class="info small">' + esc(rep.note) + '</div>' : '') + filt + chart + table +
      '<div class="btns noprint"><button class="btn" type="button" data-a="repExport" data-f="share">Compartir PDF</button><button class="btn sec" type="button" data-a="repExport" data-f="pdf">PDF</button><button class="btn sec" type="button" data-a="repExport" data-f="xlsx">Excel</button><button class="btn sec" type="button" data-a="repExport" data-f="csv">CSV</button></div>';
    return { title: def.title, sub: rep.rows.length + ' filas', back: '#/inf', html, mount(root) { const s = ui.$('#rf', root); if (s) s.onchange = () => { flt[s.dataset.k] = s.value; ui.render(); }; } };
  };
  ui.actions.repExport = (d) => ui.exportReport(CUR, d.f);
})(typeof window !== 'undefined' ? window : globalThis);
