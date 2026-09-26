const CACHE_NAME = 'alephy-cache-v25-doors';
// Пре-кэш минимален: всё остальное кэшируется рантаймом при первом запросе.
// Это исключает «зависшую» установку SW из-за одного отсутствующего файла
// в длинном списке и не держит первый заход на загрузке десятков ресурсов.
const PRECACHE_URLS = ['index.html'];

self.addEventListener('install', (event) => {
  // Установка не должна падать из-за отдельных недоступных ресурсов.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(handle(request));
});

async function handle(request) {
  const cache = await caches.open(CACHE_NAME);

  // Навигация: свежий документ с сети; при офлайне — из кэша.
  if (request.mode === 'navigate') {
    try {
      const response = await fetch(request);
      cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (e) {
      const hit = await cache.match(request);
      return hit || cache.match('index.html');
    }
  }

  // Статика: stale-while-revalidate — мгновенный ответ из кэша, обновление в фоне.
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  if (cached) {
    // не ждём сеть — отдаём кэш и обновляем его в фоне
    networkPromise.catch(() => {});
    return cached;
  }
  return networkPromise || new Response('Ресурс временно недоступен.', { status: 503, statusText: 'Service Unavailable' });
}
