// Offline: precache everything on install; network-first (fresh when online), cache when offline.
const VERSION = 'kp-v2';
const ART = ['00-cover', '01-cousins', '03-wrestling', '04-cookies', '05-popcorn', '06-videogame', '07-djbean', '14-party']
  .flatMap(f => [`art/${f}.webp`, `art/${f}-thumb.webp`]);
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'audio.js', 'store.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png', ...ART];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const net = await Promise.race([
        fetch(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500)),
      ]);
      if (net.ok) cache.put(req, net.clone());
      return net;
    } catch {
      return (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? await cache.match('index.html') : undefined)
        || Response.error();
    }
  })());
});
