// Offline support: the newest files when online, the saved copies when offline (so the app opens at the
// gym without a signal). OneDrive, Google Drive and the sign-ins always go to the network.
// The Savings Tracker and Glosor live on the same website, so only this app's own caches are touched here.
const PREFIX = "gymbro-";
const CACHE = `${PREFIX}v2`;
const FILES = [
  "./", "index.html", "auth.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/config.js", "js/core.js", "js/data.js", "js/library.js", "js/store.js", "js/ui.js", "js/charts.js", "js/sound.js", "js/workout.js",
  "js/cloud/common.js", "js/cloud/onedrive.js", "js/cloud/google.js",
  "js/pages/common.js", "js/pages/today.js", "js/pages/live.js", "js/pages/summary.js", "js/pages/plan.js", "js/pages/editors.js",
  "js/pages/history.js", "js/pages/progress.js", "js/pages/settings.js", "js/pages/welcome.js", "js/pages/recommend.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // only this app's files (the other apps on the website have their own helpers)
  if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return;
  event.respondWith(fetch(event.request).then((resp) => {
    if (resp.ok) { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); }
    return resp;
  }).catch(async () => {
    const hit = await caches.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    // the sign-in page comes back as auth.html?code=...: any page of the app works offline from the cache
    if (event.request.mode === "navigate") return caches.match("index.html");
    return Response.error();
  }));
});
