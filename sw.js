/* LIFTLOG service worker
   - 同じサイトのファイルは「ネット優先」。電波が弱い時は2.5秒で諦めて保存済みの版を使う（オフラインでも開ける）
   - 正常な応答だけをキャッシュする（エラー画面を保存してしまわない）
   アプリ本体を更新したら下の "liftlog-v13" の番号を上げる（v13,v14…）。種目の編集では上げる必要なし。 */
const CACHE = "liftlog-v13";
const ASSETS = [
  "./", "./index.html", "./app.js", "./manifest.json", "./exercises.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"
];
const TIMEOUT_MS = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) { return res && (res.ok || res.type === "opaque"); }
function put(req, res) {
  if (!cacheable(res)) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    // Google Fonts など外部ファイル：保存済みがあればそれを使う
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { put(req, res); return res; })));
    return;
  }

  // 同じサイト：ネット優先（タイムアウトあり）→ ダメならキャッシュ
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(req).then((hit) =>
      hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
    const timer = setTimeout(() => {
      fallback().then((hit) => { if (hit && !done) { done = true; resolve(hit); } });
    }, TIMEOUT_MS);
    fetch(req).then((res) => {
      clearTimeout(timer);
      put(req, res);
      if (!done) { done = true; resolve(res.ok ? res : fallback().then((hit) => hit || res)); }
    }).catch(() => {
      clearTimeout(timer);
      if (!done) { done = true; resolve(fallback().then((hit) => hit || Response.error())); }
    });
  }));
});
