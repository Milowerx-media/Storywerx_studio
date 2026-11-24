// Storywerx offline helper. It keeps a copy of the app on this computer so the installed app
// opens without internet, and it fetches the newest version whenever you're online.
const VERSION = "sbs-136";
const SHELL = ["./", "index.html", "guide.pdf", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
const LIBS = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "sbs-libs").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin === self.location.origin) {
    if (r.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {   // the app itself: newest when online
      const saved = () => caches.match("index.html").then(m => m || caches.match("./"));
      e.respondWith(timeout(fetch(r), 6000).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("index.html", copy)); return res; } return saved().then(m => m || res); })   // site down or paused: keep using the saved copy
        .catch(saved));
      return;
    }
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); } return res; })));
    return;
  }
  if (LIBS.test(r.url)) {   // drawing libraries and fonts: use the saved copy, refresh it in the background
    e.respondWith(caches.open("sbs-libs").then(c => c.match(r).then(m => { const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => m); return m || net; })));
  }
});
