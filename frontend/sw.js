const CACHE_NAME = 'discipline-os-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './js/app.js',
  './js/api.js',
  './styles/main.css',
  './styles/login.css',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.log('SW Install Error:', err))
  );
});

self.addEventListener('fetch', (event) => {
  // Do not cache API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
