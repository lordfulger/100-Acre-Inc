// Shows the game's notifications (hugs, letters, Poohsticks challenges…) when the
// game isn't on screen, and opens the game when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// iPhones stop delivering notifications to a web app that receives one without showing it.
const MUST_SHOW = /iPhone|iPad|iPod/.test(self.navigator.userAgent);

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch {}
  e.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The game shows its own message when you're looking at it.
    if (!MUST_SHOW && windows.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(data.title || '100 Acre Inc', {
      body: data.body || '', tag: data.tag, icon: '/icon-192.png', badge: '/icon-192.png',
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) return windows[0].focus();
    return self.clients.openWindow('/');
  })());
});
