/* Service Worker do app de treino.
   Precisa estar servido como arquivo HTTP real (não Blob URL) pro Chrome Android
   aceitar o registro. Por isso é um arquivo separado, ao lado do index.html.

   Funções:
   - skipWaiting + clients.claim: ativa imediatamente sem precisar fechar abas
   - notificationclick: foca a janela do app e propaga o evento via postMessage
   - message handler: aceita comandos da página pra disparar notificações
                      (algumas plataformas só permitem notificação via SW)

   Sem cache: não tenta servir conteúdo offline. Evita problemas de versionamento. */

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Sem cache — deixa o navegador lidar normalmente
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', tag: e.notification.tag });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'show-notification') {
    self.registration.showNotification(
      e.data.title || 'Treino',
      e.data.options || {}
    );
  }
});
