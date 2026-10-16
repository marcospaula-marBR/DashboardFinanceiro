/**
 * Service Worker — Mar Brasil Web Push & PWA
 * Suporte a notificações em segundo plano para Windows 11 e Android (Motorola / Chrome)
 * @version v.02.59.61
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

  const origin = self.location.origin || '';
  const iconUrl = origin ? `${origin}/Favicon.png` : '/Favicon.png';
  const targetUrl = data.url || '/minhas-atividades';

  // Configuração compatível com Android Mobile (Chrome/Motorola) e Windows 11
  // Evitamos requireInteraction e actions no push direto de segundo plano,
  // pois no Android Mobile isso pode gerar TypeError ou falha silenciosa de permissão.
  const primaryOptions = {
    body: data.body,
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || `mb-${Date.now()}`,
    data: {
      url: targetUrl,
      activityId: data.activityId,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration
      .showNotification(data.title, primaryOptions)
      .catch((err) => {
        console.warn('[SW] Falha nas opções avançadas, tentando fallback simples:', err);
        // Fallback ultra-simples para garantir entrega mesmo em aparelhos restritivos
        return self.registration.showNotification(data.title, {
          body: data.body,
          icon: iconUrl,
          data: { url: targetUrl },
        });
      })
      .catch((finalErr) => {
        console.error('[SW] Erro irrecuperável no showNotification:', finalErr);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/minhas-atividades';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver janela aberta, focar nela e navegar
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((c) => (c ? c.focus() : client.focus()));
          }
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
