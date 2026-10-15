// LabTrack service worker – offline app shell (stale-while-revalidate).
const CACHE = 'labtrack-v1.8.0';
const ASSETS = ['./', './index.html', './app.js', './styles.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
self.addEventListener('install', e => {
  // fetch fresh copies (bypass HTTP cache); wait for the user to press "Update"
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    try { await c.add(new Request(PPTX_CDN, { mode: 'cors' })); } catch (err) { /* fetched later on first use */ }
  }));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url === PPTX_CDN) {   // PowerPoint library: cache-first so reports work offline
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(PPTX_CDN)) || fetch(req).then(res => { if (res.ok) c.put(PPTX_CDN, res.clone()); return res; })));
    return;
  }
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    return cached || (await net) || new Response('Offline', { status: 503 });
  }));
});
