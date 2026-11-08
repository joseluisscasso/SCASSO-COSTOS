/* SCASSO — Dashboard, configuración, copias de seguridad y datos de ejemplo. */
(function (g) {
  'use strict';
  const SC = g.SC, D = SC.D, U = SC.units, F = SC.fmt, E = SC.engine, ST = SC.store, ui = SC.ui, esc = ui.esc, dn = E.dn;
  const daysSince = (iso) => (Date.now() - Date.parse(iso)) / 864e5;
  const hasData = () => ui.S.materials.length + ui.S.recipes.length + ui.S.products.length + ui.S.batches.length > 0;

  /* ================= dashboard ================= */
  ui.views.dash = function () {
    const S = ui.S, ctx = ui.ctx();
    const low = dn(S.settings.lowMargin).div(100), alertDays = Number(S.settings.priceAlertDays) || 60;
    const stat = (k, v, sub) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="muted tiny">' + sub + '</div>' : '') + '</div>';
    const top = '<a class="iconbtn" href="#/cfg" aria-label="Configuración">' + ui.icon('gear') + '</a>';
    const brand = { title: 'SCASSO', sub: 'Porchetta Artigianale · Costos', topRight: top };

    const simCta = '<a class="card click" href="#/sim" style="display:block;background:var(--terra);border-color:var(--terra);color:#fff;text-decoration:none"><div class="row"><div style="font-size:1.8rem">🧪</div><div class="grow"><div style="font-family:var(--serif);font-size:1.12rem;font-weight:600">Simulador de escenarios</div><div style="opacity:.92;font-size:.88rem">¿Y si la carne pasa de $ 7.500 a $ 9.000? Mirá el impacto en cada producto sin tocar tus datos.</div></div><span style="font-size:1.4rem">›</span></div></a>';

    if (!hasData()) {
      return Object.assign(brand, { html: '<img class="logo-big" src="icons/logo.png" alt="SCASSO Porchetta Artigianale">' +
        '<div class="card"><h3>Bienvenido</h3><p class="small muted">Empezá en este orden:</p><ol class="small" style="padding-left:20px;line-height:1.7;margin:6px 0 0"><li>Cargá tus <b>materias primas</b> con presentación y precio.</li><li>Armá tus <b>recetas</b> con cantidades, merma y rendimiento.</li><li>Creá tus <b>productos</b> y mirá el margen.</li><li>Usá el <b>simulador</b> para decidir precios.</li></ol>' +
        '<div class="btns mt"><button class="btn" type="button" data-a="matNew">Agregar materia prima</button><button class="btn sec" type="button" data-a="demoLoad">Probar con datos de ejemplo</button></div>' +
        '<div class="small muted mt-s">Los datos de ejemplo son ilustrativos (precios inventados) y se pueden borrar completos desde Configuración.</div></div>' + simCta });
    }

    // indicadores
    const rcs = S.recipes.map((r) => [r, E.recipeCalc(r, ctx)]);
    const kgs = rcs.filter(([, rc]) => rc.perKg && !rc.hasErrors).map(([, rc]) => rc.perKg);
    const avgKg = kgs.length ? D.sum(kgs).div(kgs.length) : null;
    const last = S.batches.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
    const matSorted = S.materials.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const lastUpd = matSorted.slice(0, 5);
    const alerts = S.materials.map((m) => [m, E.priceChange(m)]).filter(([, c]) => c && c.pct.isPos() && daysSince(c.date) <= alertDays).sort((a, b) => b[1].pct.cmp(a[1].pct)).slice(0, 8);
    const lows = [];
    S.products.forEach((p) => (p.variants || []).forEach((v) => {
      const price = dn(v.salePrice); if (!price.isPos()) return;
      const vc = E.variantCalc(v, ctx), m = E.metrics(vc.total, price, v.fees);
      if (m.marginPct !== null && m.marginPct.lt(low)) lows.push({ name: p.name + (v.name && p.variants.length > 1 ? ' — ' + v.name : ''), m, cost: vc.total });
    }));
    lows.sort((a, b) => a.m.marginPct.cmp(b.m.marginPct));
    const needBackup = !S.meta.lastBackup || daysSince(S.meta.lastBackup) > 30;

    const html =
      (S.meta.demo ? '<div class="warn small"><b>Estás viendo datos de ejemplo</b> (precios ilustrativos). Cuando quieras empezar con los tuyos: Configuración → Borrar todos los datos.</div>' : '') +
      simCta +
      '<div class="grid3">' + stat('Materias primas', S.materials.length) + stat('Recetas', S.recipes.length) + stat('Productos', S.products.length) + '</div>' +
      '<div class="grid2 mt-s">' +
      stat('Última tanda', last ? ui.money(last.calc.total) : '—', last ? esc(last.recipeName) + ' · ' + ui.date(last.date) + ' <span class="badge real">real</span>' : 'Todavía no registraste tandas') +
      stat('Costo prom. por kg', avgKg ? ui.money(avgKg) : '—', kgs.length ? 'promedio simple de ' + kgs.length + ' receta(s) en peso <span class="badge est">estimado</span>' : 'sin recetas en peso') + '</div>' +
      '<h3 class="mt mb">Accesos directos</h3>' +
      '<div class="grid2 shortcuts"><button class="sc-btn" type="button" data-a="matNew">＋ Materia prima</button><button class="sc-btn" type="button" data-a="recNew">＋ Receta</button><button class="sc-btn" type="button" data-a="priceUpdate">↻ Actualizar precio</button><button class="sc-btn" type="button" data-a="prodNew">＋ Producto</button><button class="sc-btn wide" type="button" data-a="go" data-h="#/rec/plan">▦ Calcular nueva producción</button></div>' +
      (needBackup ? '<div class="warn small mt"><b>Hacé una copia de seguridad.</b> ' + (S.meta.lastBackup ? 'La última fue el ' + ui.date(S.meta.lastBackup) + '.' : 'Todavía no hiciste ninguna.') + ' <a href="#/cfg" style="color:inherit;font-weight:700">Ir a Configuración</a></div>' : '') +
      '<h3 class="mt mb">Alertas de precios' + (alerts.length ? ' <span class="badge up">' + alerts.length + '</span>' : '') + '</h3>' +
      (alerts.length ? alerts.map(([m, c]) => '<div class="card"><div class="row sb"><div><strong>' + esc(m.name) + '</strong><div class="muted tiny">subió el ' + ui.date(c.date) + '</div></div><div class="num"><span class="up"><b>▲ ' + ui.pct(c.pct, 1) + '</b></span><div class="muted tiny">' + ui.costText(m).split('  ·')[0] + '</div></div></div><button class="btn sec sm block mt-s" type="button" data-a="alertSim" data-id="' + m.id + '">Ver impacto en productos</button></div>').join('') : '<div class="card small muted">Sin aumentos en los últimos ' + alertDays + ' días.</div>') +
      '<h3 class="mt mb">Productos con margen bajo' + (lows.length ? ' <span class="badge up">' + lows.length + '</span>' : '') + '</h3>' +
      (lows.length ? lows.map((x) => '<div class="card"><div class="row sb"><strong>' + esc(x.name) + '</strong><span class="badc"><b>' + ui.pct(x.m.marginPct, 1) + '</b></span></div><div class="muted small">Costo ' + ui.money(x.cost) + ' · precio ' + ui.money(x.m.effPrice) + ' · umbral ' + ui.pct(low, 0) + '</div></div>').join('') : '<div class="card small muted">Todos los productos con precio están por encima de ' + ui.pct(low, 0) + ' de margen.</div>') +
      '<h3 class="mt mb">Últimas actualizaciones de precios</h3>' +
      '<div class="card">' + (lastUpd.length ? lastUpd.map((m) => { const c = E.priceChange(m); return '<div class="kv"><span class="k">' + esc(m.name) + '<div class="tiny">' + ui.date(m.updatedAt) + '</div></span><span class="v">' + esc(ui.costText(m).split('  ·')[0]) + (c && !c.pct.isZero() ? ' <span class="' + (c.pct.isPos() ? 'up' : 'down') + ' tiny">' + (c.pct.isPos() ? '▲' : '▼') + ui.pct(c.pct.abs(), 1) + '</span>' : '') + '</span></div>'; }).join('') : '<span class="muted small">Sin materias primas.</span>') + '</div>';
    return Object.assign(brand, { html });
  };
  ui.actions.alertSim = (d) => { ui.simSeed(d.id); location.hash = '#/sim'; };

  /* ================= configuración ================= */
  ui.views.cfg = function () {
    const S = ui.S, st = S.settings, f = st.fees || {};
    const v = (x) => F.num(dn(x), 6);
    const counts = [['Materias primas', S.materials.length], ['Costos indirectos', S.indirects.length], ['Recetas', S.recipes.length], ['Productos', S.products.length], ['Tandas', S.batches.length], ['Escenarios guardados', S.scenarios.length]];
    const html =
      '<form id="cf" novalidate><div class="card"><h3>Criterios de rentabilidad</h3><div class="errs"></div>' +
      '<div class="grid2">' + ui.nf({ name: 'lowMargin', label: 'Margen bajo si es menor a (%)', value: v(st.lowMargin) }) + ui.nf({ name: 'targetMargin', label: 'Margen objetivo (%)', value: v(st.targetMargin) }) + '</div>' +
      ui.nf({ name: 'priceAlertDays', label: 'Alertar aumentos de los últimos (días)', value: st.priceAlertDays }) +
      '<div class="small muted mb">El margen se mide sobre el precio de venta (no es el recargo sobre costo).</div>' +
      '<h3>Costos comerciales por defecto</h3><div class="small muted mb">Se copian a cada producto nuevo; podés cambiarlos en cada uno.</div>' +
      '<div class="grid2">' + ui.nf({ name: 'platform', label: 'Comisión plataformas (%)', value: v(f.platform) }) + ui.nf({ name: 'payment', label: 'Comisión medios de pago (%)', value: v(f.payment) }) + ui.nf({ name: 'tax', label: 'Impuestos (%)', value: v(f.tax) }) + ui.nf({ name: 'discount', label: 'Descuento (%)', value: v(f.discount) }) + '</div>' +
      ui.nf({ name: 'fixed', label: 'Costo de venta fijo por unidad ($)', value: v(f.fixed) }) +
      '<button class="btn block" type="button" data-a="cfgSave">Guardar criterios</button></div></form>' +

      '<div class="card"><h3>Copia de seguridad</h3><div class="small muted mb">Tus datos se guardan en este teléfono. Guardá una copia en Drive o WhatsApp de vez en cuando: si borrás los datos del navegador o cambiás de teléfono, es lo que te permite recuperar todo.</div>' +
      '<div class="kv"><span class="k">Última copia</span><span class="v">' + (S.meta.lastBackup ? ui.date(S.meta.lastBackup) : 'nunca') + '</span></div>' +
      '<div class="btns mt"><button class="btn" type="button" data-a="cfgShare">Compartir copia</button><button class="btn sec" type="button" data-a="cfgBackup">Descargar copia</button></div>' +
      '<label class="btn sec block mt-s" style="cursor:pointer">Importar copia…<input type="file" id="cfimp" accept=".json,application/json" style="display:none"></label></div>' +

      '<div class="card"><h3>Datos guardados</h3>' + counts.map(([k, n]) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + n + '</span></div>').join('') +
      '<div class="kv"><span class="k">Dónde se guardan</span><span class="v">' + esc(ST.adapter.name) + '</span></div><div class="kv"><span class="k">Almacenamiento protegido</span><span class="v" id="cfpers">…</span></div>' +
      '<div id="cfinst" class="mt"></div></div>' +

      '<div class="card"><h3>Nube y varios dispositivos</h3><p class="small muted">Hoy la app funciona 100 % en este dispositivo, sin conexión. Ya está preparada para sumar una base de datos en la nube (por ejemplo Supabase) con sincronización y varios usuarios: todos los registros tienen identificador único, fechas de modificación y un campo de usuario, y el guardado pasa por un adaptador intercambiable.</p></div>' +

      '<div class="card"><h3>Zona de cuidado</h3>' + (hasData() ? '' : '<button class="btn sec block mb" type="button" data-a="demoLoad">Cargar datos de ejemplo</button>') +
      '<button class="btn danger block" type="button" data-a="cfgWipe">Borrar todos los datos</button></div>' +
      '<div class="muted tiny" style="text-align:center">SCASSO Costos · versión 1.0 · cálculo decimal exacto</div>';
    return {
      title: 'Configuración', back: '#/dash', html,
      mount(root) {
        ui.$('#cfimp', root).onchange = (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) importFile(file); };
        const pe = ui.$('#cfpers', root);
        if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { pe.textContent = p ? 'Sí' : 'No solicitado'; if (!p) pe.innerHTML = 'No <button class="btn sm sec" type="button" data-a="cfgPersist" style="min-height:32px;padding:0 10px;margin-left:6px">Proteger</button>'; }); else pe.textContent = 'No disponible';
        const inst = ui.$('#cfinst', root);
        if (g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) inst.innerHTML = '<div class="info small">App instalada en la pantalla de inicio ✔</div>';
        else if (ui.installEvt) inst.innerHTML = '<button class="btn terra block" type="button" data-a="cfgInstall">Instalar app en el teléfono</button>';
        else inst.innerHTML = '<div class="info small"><b>Instalar en Android:</b> abrí la app en Chrome → menú ⋮ → “Instalar aplicación” (o “Agregar a pantalla principal”).</div>';
      },
    };
  };
  ui.actions.cfgInstall = async () => { const e = ui.installEvt; if (!e) return; e.prompt(); await e.userChoice; ui.installEvt = null; ui.render(); };
  ui.actions.cfgPersist = async () => { try { const ok = await navigator.storage.persist(); ui.toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo concedió (se concede con el uso frecuente o al instalar la app)'); ui.render(); } catch (e) { ui.toast(e.message, true); } };
  ui.actions.cfgSave = () => {
    const f = ui.$('#cf'), v = ui.formVals(f), errs = [];
    const P = (k, label, o) => ui.readNum(v[k], label, errs, Object.assign({ nonneg: true, required: true, max: 100 }, o || {}));
    const low = P('lowMargin', 'Margen bajo'), tgt = P('targetMargin', 'Margen objetivo', { max: 99.99 });
    const days = ui.readNum(v.priceAlertDays, 'Días de alerta', errs, { pos: true, required: true });
    const fe = { platform: P('platform', 'Comisión plataformas'), payment: P('payment', 'Comisión medios de pago'), tax: P('tax', 'Impuestos'), discount: P('discount', 'Descuento', { max: 99.99 }), fixed: ui.readNum(v.fixed, 'Costo de venta fijo', errs, { nonneg: true, required: true }) };
    if (!errs.length && D.of(fe.platform).add(fe.payment).add(fe.tax).gte(100)) errs.push('Comisiones + impuestos deben sumar menos de 100 %');
    if (errs.length) return ui.showErrs(f, errs);
    ui.S.settings = { lowMargin: low.toString(), targetMargin: tgt.toString(), priceAlertDays: String(days.floor().toNumber()), fees: { platform: fe.platform.toString(), payment: fe.payment.toString(), tax: fe.tax.toString(), discount: fe.discount.toString(), fixed: fe.fixed.toString() } };
    ui.commit({ quiet: true }); ui.showErrs(f, []); ui.toast('Criterios guardados');
  };

  /* ---------- copia de seguridad ---------- */
  function backupBlob() {
    const data = Object.assign({ app: 'scasso-costos', exportedAt: ST.now() }, JSON.parse(JSON.stringify(ui.S)));
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  }
  const bname = () => 'scasso-copia-' + F.today() + '.json';
  function markBackup() { ui.S.meta.lastBackup = ST.now(); ui.commit({ quiet: true }); }
  ui.actions.cfgBackup = () => { ui.download(backupBlob(), bname()); markBackup(); ui.toast('Copia descargada'); ui.render(); };
  ui.actions.cfgShare = async () => { await ui.share(backupBlob(), bname(), 'Copia de seguridad SCASSO'); markBackup(); ui.render(); };
  async function importFile(file) {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw !== 'object' || (raw.app && raw.app !== 'scasso-costos')) throw new Error('Este archivo no es una copia de SCASSO');
      const copy = Object.assign({}, raw); delete copy.app; delete copy.exportedAt;
      const st = ST.normalize(copy);
      const msg = 'Esta copia tiene ' + st.materials.length + ' materias primas, ' + st.recipes.length + ' recetas, ' + st.products.length + ' productos y ' + st.batches.length + ' tandas. Reemplaza TODOS los datos actuales' + (hasData() ? ' (antes se descarga automáticamente una copia de lo que tenés ahora)' : '') + '. ¿Continuar?';
      if (!(await ui.confirm(msg, { ok: 'Reemplazar datos', title: 'Importar copia' }))) return;
      if (hasData()) ui.download(backupBlob(), 'scasso-antes-de-importar-' + F.today() + '.json');
      ui.S = st; ui.commit(); await ui.flush();
      if (ui.saveError) return; ui.toast('Copia importada'); location.hash = '#/dash';
    } catch (e) { ui.toast(e instanceof SyntaxError ? 'El archivo está dañado (no es JSON válido)' : e.message, true); }
  }
  ui.actions.cfgWipe = async () => {
    if (!(await ui.confirm('Se borran TODAS las materias primas, recetas, productos, tandas y escenarios de este teléfono. Esto no se puede deshacer. Si no hiciste una copia de seguridad, hacela antes.', { ok: 'Sí, borrar todo', title: 'Borrar todos los datos' }))) return;
    if (!(await ui.confirm('Última confirmación: ¿borrar todo definitivamente?', { ok: 'Borrar definitivamente', title: '¿Seguro?' }))) return;
    const keep = ui.S.settings;
    ui.S = ST.emptyState(); ui.S.settings = keep; ui.commit(); ui.toast('Datos borrados'); location.hash = '#/dash';
  };
  ui.actions.demoLoad = () => {
    if (hasData()) return ui.toast('Ya hay datos cargados', true);
    const demo = SC.demo.build(ui.S.settings);
    Object.assign(ui.S, demo, { meta: Object.assign(ui.S.meta, { demo: true }) });
    ui.commit(); ui.toast('Datos de ejemplo cargados'); location.hash = '#/dash';
  };
})(typeof window !== 'undefined' ? window : globalThis);
