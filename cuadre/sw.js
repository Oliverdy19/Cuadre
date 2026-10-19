// Cuadre — funciona sin conexión. Cambia VERSION al publicar una versión nueva.
const VERSION = 'cuadre-v3';
const CORE = ['./', './index.html', './styles.css', './engine.js', './store.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  // Archivos propios: red primero (recibe actualizaciones) y caché sin conexión.
  if (same) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; })
      .catch(() => caches.match(req).then(h => h || caches.match('./index.html'))));
    return;
  }
  // Fuentes y lector de Excel: caché primero.
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; })));
  }
});
