const CACHE = 'analytics-flow-mvp-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/192.png',
  './icons/512.png',
  './icons/192-maskable.png',
  './icons/512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Кешируем только GET-запросы
  if (e.request.method !== 'GET') return;
  
  // Не кешируем сторонние запросы (например, CDN с библиотекой xlsx)
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      return fetch(e.request)
        .then(res => {
          // Если ответ успешный — обновляем кеш
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => {
          // Если сети нет — отдаем из кеша. 
          // Если и в кеше нет (например, навигация на новый URL) — отдаем index.html
          return cached || caches.match('./index.html') || new Response('Offline', { status: 503 });
        });
    })
  );
});
