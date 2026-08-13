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
/* Bump on every deploy that changes a cached file under the same name: the
   clips were re-rendered in a different voice, and a cache-first policy would
   otherwise keep serving the old ones forever.
   Bump it ALSO when a phone is visibly stuck on an old build. The precache
   holds a copy of index.html taken when the worker installed, and if that
   copy is ever served the app is frozen at that version no matter what the
   server says. Changing the name drops the whole old cache on activate. */
const CACHE = 'vocab-shell-v6';
const SHELL = [
  './',
  './index.html',
  './words.js',
  './manifest.json',
  './audio-manifest.json',
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
      .then(cacheClips)
  );
});

/* The spoken words, about 650 KB across 121 files. Pulled after activation
 * rather than during install, so a slow connection delays nothing the user is
 * waiting on, and fetched one at a time to stay out of the way. A worker
 * cannot list a directory, hence the manifest written by make-audio.ps1. */
function cacheClips(){
  return fetch('audio-manifest.json')
    .then(r => r.json())
    .then(({clips}) => caches.open(CACHE).then(c =>
      (clips || []).reduce(
        (chain, name) => chain.then(() =>
          c.match('audio/' + name).then(hit => hit || c.add('audio/' + name).catch(() => {}))),
        Promise.resolve())
    ))
    .catch(() => {});
}

const isStatic = url => /\/(fonts|icons|audio)\//.test(url.pathname);

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
