const CACHE_NAME = "lfc-prediction-league-v12-final-ui-uid";
const FILES = ["./","./index.html","./style.css","./app.js","./firebase-config.js","./manifest.json","./icon-192.svg","./icon-512.svg","./liverpool-logo.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
