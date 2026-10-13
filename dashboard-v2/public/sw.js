/**
 * Service Worker — Mar Brasil Web Push & PWA
 * Suporte a notificações em segundo plano para Windows 11 e Android
 * @version v.02.59.49
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Mar Brasil — Alerta Operacional',
    body: 'Você possui uma nova notificação em suas atividades.',
    url: '/minhas-atividades',
    priority: 'info',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/Favicon.png',
    badge: '/Favicon.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/minhas-atividades',
      activityId: data.activityId,
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir Atividade',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/minhas-atividades';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver janela aberta, focar nela
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
