const CACHE = 'cashflow-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './style.css',
  './data.js', './colors.js', './utils.js', './render.js',
  './actions.js', './auth.js', './storage.js', './main.js',
  './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (toujours la dernière version), cache en secours hors-ligne.
// Les ressources externes (Chart.js, supabase-js, icônes, polices) sont mises en cache au passage.
// Les appels Supabase (API / auth) ne passent JAMAIS par le cache : données privées et jetons.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.endsWith('supabase.co')) return;
  const noStore = url.search.includes('code=') || url.hash.includes('access_token');
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (!noStore && res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
