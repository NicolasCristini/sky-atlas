// Sky Atlas service worker. Bump CACHE_VERSION to force every client to rebuild its cache.
// All URLs are relative to this file, so the app works from a sub-path (e.g. GitHub Pages /sky-atlas/).
const CACHE_VERSION = 'v2';
const CACHE = 'sky-atlas-' + CACHE_VERSION;

// App shell + local assets. Missing optional files (a 404) are skipped, never fail the install.
// Anything not listed here (new data files, etc.) is still cached the first time it is fetched.
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/main.js', 'js/astro.js', 'js/cards.js', 'js/cities.js', 'js/data.js', 'js/explainer.js', 'js/globe.js', 'js/labels.js',
  'js/mini.js', 'js/search.js', 'js/shaders.js', 'js/shell.js', 'js/sky.js', 'js/view.js', 'js/ages.js', 'js/skyquality.js',
  'vendor/astronomy.browser.min.js', 'vendor/three.module.min.js',
  'data/cities.txt', 'data/constellations.json', 'data/constellations.lines.json', 'data/dsos.bright.json', 'data/mw.json',
  'data/starnames.json', 'data/stars.6.json', 'data/starextra.json',
  'img/earth-blue-marble.jpg', 'img/earth-night.jpg', 'img/earth-topology.png',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (res.ok) await cache.put(u === './' ? 'index.html' : u, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sky-atlas-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isCode = (url) => /\.(?:js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');

async function staleWhileRevalidate(req, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key || req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res && res.ok) cache.put(key || req, res.clone()); return res; }).catch(() => null);
  if (hit) { net.catch(() => {}); return hit; }
  return (await net) || Response.error();
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return;                      // let the browser handle partial requests
  if (req.mode === 'navigate') {                             // any page load -> the app shell, offline included
    e.respondWith(staleWhileRevalidate(new Request('index.html'), 'index.html').then((r) => r.type === 'error' ? fetch(req) : r));
    return;
  }
  e.respondWith(isCode(url) ? staleWhileRevalidate(req) : cacheFirst(req));
});
