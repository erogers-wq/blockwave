/* =============================================================
   Blockwave service worker
   -------------------------------------------------------------
   Strategy:
     - Precache the shell on install so the game runs with no
       network at all after the first visit.
     - Navigations: network-first with a cache fallback, so a new
       build is picked up when online but the game still opens
       when offline.
     - Everything else: cache-first (icons and the manifest never
       change within a version).
   Bump CACHE_VERSION whenever you upload a new blockwave build.
   ============================================================= */
const CACHE_VERSION = "blockwave-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/apple-touch-icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll fails the whole install if any one file 404s, so add
      // them individually and tolerate misses.
      .then(cache => Promise.all(SHELL.map(url =>
        cache.add(new Request(url, { cache: "reload" })).catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch cross-origin

  if (req.mode === "navigate"){
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic"){
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
