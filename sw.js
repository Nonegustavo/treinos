/* Service Worker do app de treino.

   Funções:
   - skipWaiting + clients.claim: ativa imediatamente sem precisar fechar abas
   - notificationclick: foca a janela do app, propaga via postMessage
   - schedule-notification: agenda notificação pra daqui X ms (usado pelo timer)
   - cancel-notification: cancela agendamento (usado quando timer é dispensado)
   - show-notification: dispara imediatamente

   Por que agendar dentro do SW: quando a aba do PWA fica em segundo plano, o JS
   da página pode ser pausado pelo Chrome Android, o que faz o setInterval do
   timer parar e a notificação nunca disparar. Agendando no SW, aumentamos a
   chance da notificação aparecer mesmo com app em background.

   Ainda assim não é 100% confiável: o Chrome também pode suspender SWs depois
   de algum tempo de inatividade. Pra notificação garantida com app fechado,
   precisaria de Push API + servidor backend, fora do escopo deste app.

   Sem cache: não tenta servir conteúdo offline. Evita problemas de versionamento.
*/

const SCHEDULED = new Map(); // tag -> timeoutId

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
  const action = e.action || 'default';
  e.notification.close();
  // Cancela qualquer agendamento pendente com a mesma tag
  const tag = e.notification.tag;
  if (tag && SCHEDULED.has(tag)) {
    clearTimeout(SCHEDULED.get(tag));
    SCHEDULED.delete(tag);
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', tag, action });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

const showNow = (title, options) => {
  const opts = Object.assign({ requireInteraction: true, silent: false }, options || {});
  return self.registration.showNotification(title, opts);
};

self.addEventListener('message', (e) => {
  const data = e.data || {};
  if (data.type === 'show-notification') {
    showNow(data.title || 'Treino', data.options);
  } else if (data.type === 'schedule-notification') {
    // { delayMs, title, options }
    const tag = (data.options && data.options.tag) || 'scheduled';
    // Cancela agendamento anterior com a mesma tag
    if (SCHEDULED.has(tag)) {
      clearTimeout(SCHEDULED.get(tag));
    }
    const id = setTimeout(() => {
      SCHEDULED.delete(tag);
      showNow(data.title || 'Treino', data.options);
    }, Math.max(0, data.delayMs || 0));
    SCHEDULED.set(tag, id);
  } else if (data.type === 'cancel-notification') {
    const tag = data.tag;
    if (tag && SCHEDULED.has(tag)) {
      clearTimeout(SCHEDULED.get(tag));
      SCHEDULED.delete(tag);
    }
    // Também fecha qualquer notificação já visível com esse tag
    if (tag && self.registration.getNotifications) {
      self.registration.getNotifications({ tag }).then(list => {
        list.forEach(n => n.close());
      }).catch(()=>{});
    }
  }
});
