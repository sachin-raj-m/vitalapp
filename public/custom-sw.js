self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/'
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  // Only ever open pages on this site, whatever the push payload says.
  let target = '/'
  try {
    const url = new URL(event.notification.data.url || '/', self.location.origin)
    if (url.origin === self.location.origin) target = url.pathname + url.search + url.hash
  } catch (e) {}
  event.waitUntil(clients.openWindow(target))
})
