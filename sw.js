// Keeps the trip page working without internet after the first visit.
const CACHE = "trip-v4";
const CORE = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // Network first so updates arrive; fall back to the saved copy when offline.
    // Ask GitHub for the newest version, but on a weak signal wait at most 4 seconds,
    // then open the saved copy (the newer one is still saved for next time when it arrives).
    const saved = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"));
    const net = fetch(req, { cache: "no-store" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(() => saved().then(r => r && resolve(r)), 4000));
    e.respondWith(
      Promise.race([net.catch(() => saved()), timeout]).then(r => r || net)
    );
    e.waitUntil(net.catch(() => {}));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(new URL(req.url).hostname)) {
    // Fonts only: use the saved copy first. Live updates (ntfy.sh) always go straight to the network.
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow("./");
    })
  );
});
