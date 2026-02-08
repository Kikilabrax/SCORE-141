/* sw.js — Score 14/1 */
const CACHE_VERSION = "score141-v1"; // ⬅️ incrémente à chaque déploiement
const CACHE_NAME = `score141-cache-${CACHE_VERSION}`;

// Fichiers essentiels à garder hors-ligne
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install: précache + activation rapide
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting(); // ✅ MAJ immédiate
  })());
});

// Activate: supprime anciens caches + prend le contrôle tout de suite
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("score141-cache-") && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim(); // ✅ contrôle immédiat
  })());
});

/**
 * Fetch strategy:
 * - Navigation (HTML): network-first (pour éviter les vieilles versions), fallback cache
 * - Autres: cache-first, puis network, et on met en cache
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On ne gère que GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignore extensions/schemes non gérés
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // ✅ HTML / navigation: network-first
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone()); // garde une copie sûre
        return fresh;
      } catch (e) {
        const cached = await caches.match(req) || await caches.match("./index.html");
        return cached || new Response("Hors-ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // ✅ Assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Cache seulement si réponse OK et même origine (évite certains soucis)
      if (res && res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      // fallback éventuel (icône)
      const fallback = await caches.match("./icons/icon-192.png");
      return fallback || new Response("", { status: 504 });
    }
  })());
});
