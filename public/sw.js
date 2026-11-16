// Minimal service worker: makes the app installable and shows the last app shell when the
// network drops. Live data (/api, SSE) and audio always go straight to the network.
const SHELL = "culture-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // browser default for everything else
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && !url.pathname.startsWith("/host")) { const c = await caches.open(SHELL); await c.put("/", res.clone()); }
      return res;
    } catch {
      return (await caches.match("/")) || new Response("Offline: reconnect to Wi-Fi and try again 🙏", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
