/* Service Worker minimal — notifications cuisine */

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Priorité : fenêtre déjà ouverte sur /kitchen
        const kitchenClient = windowClients.find(c => c.url.includes('/kitchen'));
        if (kitchenClient && 'focus' in kitchenClient) return kitchenClient.focus();

        // Sinon : toute fenêtre de l'app
        const anyClient = windowClients.find(c => 'focus' in c);
        if (anyClient) return anyClient.focus();

        // En dernier recours : ouvrir une nouvelle fenêtre
        if (clients.openWindow) return clients.openWindow('/kitchen');
      })
  );
});
