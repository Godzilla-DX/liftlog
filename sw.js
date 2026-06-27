/* LIFTLOG service worker
   - アプリ本体(app.js等)はオフライン用にキャッシュ（cache-first）
   - exercises.json だけは「ネット優先」。GitHubで編集したら、オンラインで開いた時に最新が反映される
   アプリ本体を更新したら下の "liftlog-v3" の番号を上げる（v4,v5…）。種目の編集では上げる必要なし。 */
const CACHE = "liftlog-v3";
const ASSETS = [
  "./", "./index.html", "./app.js", "./manifest.json", "./exercises.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 種目リストはネット優先（編集をすぐ反映）。オフライン時はキャッシュにフォールバック。
  if (url.pathname.endsWith("exercises.json")) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // それ以外は cache-first
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => { if (req.mode === "navigate") return caches.match("./index.html"); });
    })
  );
});
