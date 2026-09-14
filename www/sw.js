const CACHE = 'quarta-amstel-v12';
const ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/mapa.js',
  '/js/lista.js',
  '/js/push.js',
  '/manifest.json',
  '/logos/Logo-256.png',
  '/logos/Logo-512.png',
  '/logos/Azulejo Full.png'
];
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('workers.dev')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();

          caches
            .open(CACHE)
            .then(cache => {
              cache.put(event.request, clone);
            })
            .catch(() => {});
        }

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(event.request);

        if (cached) {
          return cached;
        }

        throw new Error('Recurso indisponível offline');
      })
  );
});

// PUSH
self.addEventListener('push', event => {
  let data = {
    titulo: '🍺 Quarta é Dia de Amstel!',
    mensagem:
      'Tem promoção no bar mais próximo de você.',
    url: '/?push=1'
  };

  try {
    if (event.data) {
      const recebido =
        event.data.json();

      data = {
        ...data,
        ...recebido
      };
    }
  } catch (erro) {
    try {
      const texto =
        event.data?.text();

      if (texto) {
        data.mensagem = texto;
      }
    } catch {}
  }

  const titulo =
    data.titulo ||
    '🍺 Quarta é Dia de Amstel!';

  const opcoes = {
    body:
      data.mensagem ||
      'Tem promoção no bar mais próximo de você.',

    icon:
      data.icon ||
      '/logos/Logo-256.png',

    badge:
      data.badge ||
      '/logos/Logo-256.png',

    tag:
      data.tag ||
      `amstel-push-${Date.now()}`,

    renotify: true,

    requireInteraction: false,

    silent: false,

    vibrate: [
      200,
      100,
      200
    ],

    data: {
      url:
        data.url ||
        '/?push=1',

      timestamp:
        data.timestamp ||
        Date.now()
    },

    actions: [
      {
        action: 'ver',
        title: 'Ver bares'
      }
    ]
  };

  event.waitUntil(
    self.registration
      .showNotification(
        titulo,
        opcoes
      )
  );
});
self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const destino =
      event.notification.data?.url ||
      '/?push=1';

    const urlDestino =
      new URL(
        destino,
        self.location.origin
      ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(async lista => {
          for (const client of lista) {

            if (
              client.url.startsWith(
                self.location.origin
              )
            ) {

              try {
                await client.focus();

                if (
                  'navigate' in client
                ) {
                  await client.navigate(
                    urlDestino
                  );
                }

                return;
              } catch {}
            }
          }
          return self.clients.openWindow(
            urlDestino
          );
        })
    );
  }
);
self.addEventListener(
  'notificationclose',
  () => {
  }
);