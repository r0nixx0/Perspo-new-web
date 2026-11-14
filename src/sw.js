/* Field Shift service worker — makes the app open with no internet after the first visit.
   Works only on real hosting (https). Not used when the file is opened directly. */
const VERSION = 'fieldshift-2026-11-14';
const SHELL = ['./', './index.html'];
const TILE_LIMIT = 300;

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
  catch (err) { return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error(); }
}
async function cacheFirst(req, name, limit) {
  const cache = await caches.open(VERSION + name), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone());
    if (limit) cache.keys().then(keys => { if (keys.length > limit) cache.delete(keys[0]); });
  }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  /* The 2001–2025 record does not change, so a point fetched once keeps working offline. */
  else if (url.hostname === 'power.larc.nasa.gov') e.respondWith(cacheFirst(req, '-power'));
  /* Only tiles the user has already looked at are kept; nothing is pre-downloaded. */
  else if (url.hostname === 'tile.openstreetmap.org') e.respondWith(cacheFirst(req, '-tiles', TILE_LIMIT));
});
