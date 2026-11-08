/* SCASSO — Persistencia real (IndexedDB) con adaptador intercambiable.
   Arquitectura lista para la nube: todo registro tiene id (uuid), createdAt, updatedAt y ownerId (null hoy).
   Para sincronizar con Supabase más adelante basta escribir otro adaptador con la misma interfaz { load(), save(state) }. */
(function (g) {
  'use strict';
  const SC = g.SC;
  const DB = 'scasso-costos', STORE = 'kv', KEY = 'state';

  function openDB() {
    return new Promise((res, rej) => {
      if (!g.indexedDB) return rej(new Error('Este navegador no permite guardar datos (IndexedDB no disponible)'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('No se pudo abrir la base de datos'));
    });
  }
  const LocalAdapter = {
    name: 'Este dispositivo (IndexedDB)',
    async load() {
      const db = await openDB();
      return new Promise((res, rej) => {
        const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
    },
    async save(state) {
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(JSON.parse(JSON.stringify(state)), KEY);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error || new Error('Error al guardar'));
        tx.onabort = () => rej(tx.error || new Error('Guardado cancelado (¿sin espacio?)'));
      });
    },
  };

  const SCHEMA = 1;
  function emptyState() {
    return {
      schema: SCHEMA, ownerId: null,
      settings: { lowMargin: '60', targetMargin: '65', fees: { platform: '0', payment: '0', tax: '0', discount: '0', fixed: '0' }, priceAlertDays: '60' },
      materials: [], indirects: [], recipes: [], products: [], batches: [], scenarios: [],
      meta: { lastBackup: null, createdAt: new Date().toISOString() },
    };
  }
  // Valida y completa un estado (también para importar copias de seguridad)
  function normalize(s) {
    if (!s || typeof s !== 'object') throw new Error('El archivo no es una copia de seguridad válida');
    const e = emptyState();
    const out = Object.assign(e, s);
    out.settings = Object.assign(e.settings, s.settings || {});
    out.settings.fees = Object.assign(emptyState().settings.fees, (s.settings || {}).fees || {});
    out.meta = Object.assign(emptyState().meta, s.meta || {});
    ['materials', 'indirects', 'recipes', 'products', 'batches', 'scenarios'].forEach((k) => { if (!Array.isArray(out[k])) throw new Error('Copia inválida: falta "' + k + '"'); });
    out.materials.forEach((m) => { if (!m.id || !m.name || !m.unit) throw new Error('Copia inválida: materia prima sin datos'); });
    return out;
  }
  function uid() {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  const now = () => new Date().toISOString();

  SC.store = { LocalAdapter, emptyState, normalize, uid, now, SCHEMA, adapter: LocalAdapter };
})(typeof window !== 'undefined' ? window : globalThis);
