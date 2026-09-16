/**
 * Service worker for Web Push.
 *
 * Deliberately minimal: it handles notifications and nothing else. Caching app
 * shells here would serve students stale task listings, which is worse than a
 * slightly slower load on a marketplace where prices and deadlines move.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "Sidekick", body: "", link: "/feed" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { link: payload.link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/feed";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open tab when there is one, rather than piling up windows.
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return clients.openWindow(link);
    }),
  );
});
