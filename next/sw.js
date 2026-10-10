/* The preview that lived here is now the main app. This worker only removes
   itself and the preview cache, so nothing stale is left behind. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('vocab-next-')).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
