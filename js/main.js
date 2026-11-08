/* SCASSO — Arranque: carga los datos guardados, registra el service worker (modo sin conexión) y muestra la app. */
(function (g) {
  'use strict';
  const SC = g.SC, ui = SC.ui, ST = SC.store, esc = ui.esc;

  function fatal(title, msg, extra) {
    ui.$('#app').innerHTML = '<div style="padding:28px 18px"><img class="logo-big" src="icons/logo.png" alt="SCASSO" style="margin-top:0"><div class="err"><b>' + esc(title) + '</b><br>' + esc(msg) + '</div>' + (extra || '') + '<button class="btn block mt" type="button" onclick="location.reload()">Reintentar</button></div>';
  }

  async function start() {
    let state = null;
    try {
      const saved = await ST.adapter.load();
      state = saved ? ST.normalize(saved) : ST.emptyState();
    } catch (e) {
      console.error(e);
      if (/IndexedDB|permit/i.test(e.message || '')) { // navegación privada o almacenamiento bloqueado: se puede usar, pero avisar
        state = ST.emptyState(); ui.saveError = e.message;
      } else return fatal('No se pudieron leer los datos guardados', (e.message || String(e)) + '. Tus datos no fueron modificados. Cerrá otras pestañas de la app y reintentá.');
    }
    ui.S = state;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    g.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; });
    ui.render();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) ui.toast('Hay una versión nueva: cerrá y volvé a abrir la app'); });
        });
      }).catch((e) => console.warn('Sin modo offline:', e));
    }
  }
  g.addEventListener('error', (e) => console.error('Error no controlado:', e.message));
  g.addEventListener('unhandledrejection', (e) => { console.error(e.reason); if (ui.toast) ui.toast('Ocurrió un error: ' + ((e.reason && e.reason.message) || e.reason), true); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
