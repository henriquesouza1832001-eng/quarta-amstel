const CACHE = 'quarta-amstel-v10';
const ASSETS = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/mapa.js', '/js/lista.js', '/js/push.js', '/manifest.json', '/logos/Logo-256.png', '/logos/Logo-512.png', '/logos/Azulejo Full.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api') || url.hostname.includes('workers.dev')) return;
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});

self.clients.matchAll({
  type: 'window',
  includeUncontrolled: true
}).then(clients => {
  clients.forEach(client => {
    client.postMessage({
      tipo: 'DEBUG_PUSH_RECEBIDO',
      timestamp: Date.now()
    });
  });
});
self.addEventListener('push', e => {
  let data = { titulo: '🍺 Quarta é Dia de Amstel!', mensagem: 'Tem promoção no bar mais próximo de você.', url: '/?push=1' };

  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.mensagem,
      icon: '/logos/Logo-256.png',
      badge: '/logos/Logo-256.png',
      tag: `amstel-push-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      silent: false,
      data: { url: data.url || '/?push=1' },
      actions: [{ action: 'ver', title: 'Ver bares' }],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/?push=1';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return clients.openWindow(url);
    })
  );
});
