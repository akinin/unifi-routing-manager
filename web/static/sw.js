self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type !== "notify") return;
  const { title, body, tag, url = "/" } = event.data;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: tag || "urm-event",
    icon: "/assets/brand/urm-logo.png",
    badge: "/favicon.png",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      existing.navigate(event.notification.data?.url || "/");
      return existing.focus();
    }
    return self.clients.openWindow(event.notification.data?.url || "/");
  }));
});
