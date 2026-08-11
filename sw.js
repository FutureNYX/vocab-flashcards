/* Offline shell for the home-screen app.
 *
 * Two policies, chosen by what goes stale:
 *   - the app itself (page, words, manifest) is network-first, so a new
 *     version is picked up as soon as there is signal and the cache is only
 *     a fallback for the Tube;
 *   - fonts and icons are cache-first, because they are content-addressed by
 *     filename and never change under the same name.
 *
 * The cache holds nothing but files served from this origin. Progress lives in
 * localStorage and is never touched here, so clearing or versioning this cache
 * cannot cost the user their reviews.
 */
const CACHE = 'vocab-shell-v3';
const SHELL = [
  './',
  './index.html',
  './words.js',
  './manifest.json',
  './fonts/fraunces-latin.woff2',
  './fonts/manrope-latin.woff2',
  './fonts/manrope-cyrillic.woff2',
  './fonts/manrope-cyrillic-ext.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // one bad URL must not fail the whole install
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = url => /\/(fonts|icons)\//.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // the worker endpoint is never cached

  if(isStatic(url)){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
