// ═══════════════════════════════════════════════════
//  CAVAGNOLA MCT PRO — SERVICE WORKER
//  Strategia: Cache-first per asset statici,
//             Network-first per Firebase
// ═══════════════════════════════════════════════════

const CACHE_NAME = "cavagnola-mct-v2";


// Asset da mettere in cache al primo install
const STATIC_ASSETS = [
“./”,
“./index.html”,
“./style.css”,
“./manifest.json”,
“./icons/icon-192.png”,
“./icons/icon-512.png”,
“https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;800&display=swap”
];

// ─── INSTALL: precache degli asset statici ───────
self.addEventListener(“install”, (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
// Aggiunta uno alla volta per non bloccare su un singolo errore
return Promise.allSettled(
STATIC_ASSETS.map(url =>
cache.add(url).catch(e => console.warn(“Cache skip:”, url, e))
)
);
})
);
self.skipWaiting();
});

// ─── ACTIVATE: rimuove cache vecchie ─────────────
self.addEventListener(“activate”, (event) => {
event.waitUntil(
caches.keys().then((keys) =>
Promise.all(
keys
.filter(k => k !== CACHE_NAME)
.map(k => caches.delete(k))
)
)
);
self.clients.claim();
});

// ─── FETCH: strategia ibrida ─────────────────────
self.addEventListener(“fetch”, (event) => {
const url = event.request.url;

// Firebase, Google APIs, FontAwesome → sempre network
if (
url.includes(“firebaseapp.com”) ||
url.includes(“googleapis.com”) ||
url.includes(“firestore.googleapis.com”) ||
url.includes(“identitytoolkit”) ||
url.includes(“gstatic.com/firebasejs”)
) {
event.respondWith(fetch(event.request));
return;
}

// Font Google → network con fallback cache
if (url.includes(“fonts.gstatic.com”) || url.includes(“fonts.googleapis.com”)) {
event.respondWith(
caches.open(CACHE_NAME).then(cache =>
fetch(event.request)
.then(res => { cache.put(event.request, res.clone()); return res; })
.catch(() => cache.match(event.request))
)
);
return;
}

// Asset statici → cache-first con fallback network
event.respondWith(
caches.match(event.request).then(cached => {
if (cached) return cached;
return fetch(event.request)
.then(res => {
if (res && res.status === 200) {
const resClone = res.clone();
caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
}
return res;
})
.catch(() => {
// Fallback offline: ritorna index.html per navigazione
if (event.request.mode === “navigate”) {
return caches.match(”./index.html”);
}
});
})
);
});
