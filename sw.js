/* SCASSO — Service worker: funcionamiento sin conexión (la app se guarda en el teléfono). */
const VERSION = 'scasso-v1.0.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/decimal.js', './js/units.js', './js/format.js', './js/engine.js', './js/store.js', './js/xlsx.js',
  './js/ui-core.js', './js/ui-materials.js', './js/ui-recipes.js', './js/ui-products.js', './js/ui-sim.js', './js/ui-reports.js', './js/ui-dash.js', './js/demo.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/logo.png', './icons/mark.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // red primero para que las actualizaciones lleguen; si no hay conexión, usa la copia guardada
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
