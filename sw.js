// Offline first: GymBro's files come from the phone, so it opens at once at the gym, even without a signal.
// Each version is saved whole when it installs (fresh from the website, never an older copy), so the files
// always belong together. A new version installs in the background and waits; the app then shows
// "New version ready", and a tap switches to it (or it's used the next time the app starts).
// js/config.js is the exception: it's yours to edit, so a change there is picked up on the next start.
// OneDrive, Google Drive and the sign-ins always go to the network.
// The Savings Tracker and Glosor live on the same website, so only this app's own caches are touched here.
const VERSION = "1.5";            // the same as APP_VERSION in js/core.js (a test checks): new version, new files
const PREFIX = "gymbro-";
const CACHE = `${PREFIX}${VERSION}`;
const CONFIG = "js/config.js";
const FILES = [
  "./", "index.html", "auth.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/config.js", "js/core.js", "js/data.js", "js/library.js", "js/store.js", "js/ui.js", "js/charts.js", "js/sound.js",
  "js/workout.js", "js/update.js", "js/csv.js", "js/profiles.js",
  "js/cloud/common.js", "js/cloud/onedrive.js", "js/cloud/google.js",
  "js/pages/common.js", "js/pages/today.js", "js/pages/live.js", "js/pages/summary.js", "js/pages/plan.js", "js/pages/editors.js",
  "js/pages/history.js", "js/pages/progress.js", "js/pages/settings.js", "js/pages/welcome.js", "js/pages/recommend.js",
  "js/pages/body.js", "js/pages/profiles.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

/* global Request */
self.addEventListener("install", (event) => {
  // all or nothing, and "reload": straight from the website, not the browser's 10-minute copies
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

// "Update" tapped in the app: this version takes over now
self.addEventListener("message", (event) => { if (event.data === "update") self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // only this app's files (the other apps on the website have their own helpers)
  const base = new URL("./", self.location).pathname;
  if (!url.pathname.startsWith(base)) return;
  event.respondWith(respond(event, url.pathname.slice(base.length) === CONFIG));
});

async function respond(event, isConfig) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request, { ignoreSearch: true });
  if (hit) {
    // your settings file: this copy now, the website's for next time
    if (isConfig) event.waitUntil(fetch(event.request, { cache: "no-cache" }).then((r) => (r.ok ? cache.put(event.request, r) : null)).catch(() => {}));
    return hit;
  }
  try {
    return await fetch(event.request);
  } catch {
    // the sign-in page comes back as auth.html?code=...: any page of the app works offline from the phone
    if (event.request.mode === "navigate") return (await cache.match("index.html")) || Response.error();
    return Response.error();
  }
}
