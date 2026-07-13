// Minimalan service worker — omogućava PWA instalaciju.
// Notifikacije idu kroz Notification API dok je app otvoren (socket eventi).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// network-first, bez keširanja (admin panel mora biti svjež)
self.addEventListener('fetch', () => {});
