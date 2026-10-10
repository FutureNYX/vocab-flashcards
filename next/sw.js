/* Offline shell for the v3 preview, scoped to next/ only, so it never touches
 * the live app's worker or cache. Same two policies as the live app: the app
 * itself is network-first (a new version arrives as soon as there's signal),
 * fonts, icons and spoken clips are cache-first. Progress lives in localStorage
 * and is never touched here.
 * BUMP CACHE ON EVERY DEPLOY of next/. */
const CACHE = 'vocab-next-v1';
const SHELL = [
  './', './index.html', './engine.js', './content.js', './manifest.json',
  '../words.js', '../contexts.js', '../gifs.json',
  '../fonts/fraunces-latin.woff2', '../fonts/manrope-latin.woff2', '../fonts/manrope-cyrillic.woff2',
  '../icons/icon-180.png', '../icons/icon-192.png', '../icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('vocab-next-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isStatic = url => /\/(fonts|icons|audio)\//.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(isStatic(url)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
