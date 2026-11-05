const VERSION = "84abf3357f09";
const CACHE_NAME = `sms-izbori-${VERSION}`;

const PRECACHE_ASSETS = [
  "./",
  "index.html",
  "sms-izbori.js",
  "webApp.js",
  "manifest.webmanifest",
  "uputstvo.html",
  "styles.css",
  "icons/icon-any.svg",
  "icons/icon-maskable.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "video/slanje.jpg",
];

const VIDEOS = ["video/slanje.mp4"];
let storingVideos = null;

function storeVideos() {
  storingVideos ??= caches.open(CACHE_NAME).then((cache) =>
    Promise.all(
      VIDEOS.map(async (url) => {
        if (await cache.match(url)) return;
        try {
          const response = await fetch(`${url}?v=${VERSION}`, { cache: "reload" });
          if (response.status === 200) {
            await cache.put(url, response);
          }
        } catch (err) {}
      })
    )
  ).catch(() => {}).finally(() => {
    storingVideos = null;
  });
  return storingVideos;
}

async function videoPart(stored, request) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") ?? "");
  if (!range || (range[1] === "" && range[2] === "")) return stored;
  const body = await stored.arrayBuffer();
  const size = body.byteLength;
  const start = range[1] === "" ? Math.max(size - Number(range[2]), 0) : Number(range[1]);
  const end = range[1] === "" || range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network first, but the 3 s fallback applies only when a cached copy exists: on a first visit over a
 * slow network the 4 MB app script must not be aborted. The network answer still refreshes the cache. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = (await cache.match(request, { ignoreSearch: true })) ||
    (request.mode === "navigate" ? (await cache.match("index.html")) || (await cache.match("./")) : undefined);
  const network = fetch(request).then((response) => {
    if (response.status === 200) cache.put(request, response.clone());
    return response;
  });
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 3000));
  return Promise.race([network.catch(() => cached), timeout]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.status === 200) {
              await cache.put(url, response);
            }
          } catch (err) {}
        })
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
      .then(() => {
        storeVideos();
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Video range requests
  if (url.pathname.endsWith(".mp4")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const stored = (await cache.match(event.request, { ignoreSearch: true })) ||
                     (await cache.match("video/slanje.mp4")) ||
                     (await cache.match("./video/slanje.mp4"));
      if (stored) return videoPart(stored, event.request);
      event.waitUntil(storeVideos());
      return fetch(event.request);
    })());
    return;
  }

  // Cache-first: *.wasm, *.mjs, composeResources/*, icons
  if (
    url.pathname.endsWith(".wasm") ||
    url.pathname.endsWith(".mjs") ||
    url.pathname.includes("/composeResources/") ||
    url.pathname.includes("/icons/")
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Network-first (3 s timeout): navigations and index.html, webApp.js, sms-izbori.js, uputstvo.html, etc.
  event.respondWith(networkFirst(event.request));
});
