const CACHE = "yup-entregas-shell-v146";
const ASSETS = [
  "./",
  "./index.html",
  "./sales-portal.js",
  "./sales-portal.js?v=4",
  "./driver-access.js",
  "./styles.css",
  "./styles.css?v=83",
  "./app.js?v=29",
  "./driver-mobile.css?v=6",
  "./driver-mobile.js?v=1",
  "./manifest.webmanifest",
  "./pwa-icon.svg",
  "./yup-brand.svg",
  "./supabase-config.js",
  "./supabase-client.js",
  "./auth-ui.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith("yup-entregas-shell-") && key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
