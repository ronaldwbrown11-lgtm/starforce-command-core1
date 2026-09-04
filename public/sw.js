/* Star Force Base 1198 — offline reading service worker.
 *
 * Strategy: network-first with cache fallback for article routes. The app
 * shell (HTML/JS/CSS) is NEVER cached, so every deploy ships fresh and
 * there's no stale-bundle trap. Article pages (stories, lore, maps, vault)
 * get cached on successful fetch, which gives offline reading of everything
 * you've already opened — no precache of content that was never read.
 */
"use strict";

const CACHE_NAME = "uf-offline-articles-v1";
const ARTICLE_ROUTE =
  /^\/(?:stories|story|lore|maps|map|vault|missions|resources)\/?($|\?)/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only article routes participate in offline caching.
  if (!ARTICLE_ROUTE.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          // Store the canonical URL so query variants don't bloat the cache.
          await cache.put(url.origin + url.pathname, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(url.origin + url.pathname);
        if (hit) return hit;
        // No offline copy — let the request fail visibly rather than
        // showing a stale shell.
        throw err;
      }
    })(),
  );
});