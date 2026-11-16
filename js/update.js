// Updates: GymBro runs from the copy saved on the phone (so it opens at once, even without a signal). A new
// version downloads in the background and then switches over by itself at a quiet moment: when the app opens
// or comes back to the front, or when a workout ends. Never during a workout, with a sheet or a question open,
// or while you're typing; it waits for the next quiet moment instead. Afterwards it says "Updated to …".

import { toast } from "./ui.js";
import { APP_VERSION } from "./core.js";
import { APP_NAME } from "./data.js";

const KEY_UPDATED = "gym.updated";
let reg = null;
let switching = false;
let lastCheck = 0;
let frontAt = Date.now();          // when the app was opened or last came to the front
let busy = () => false;            // a workout in progress (the app says)

const supported = () => "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname));

/** A quiet moment: on screen, no workout going, nothing open, not typing */
export function quiet() {
  if (document.visibilityState !== "visible" || busy()) return false;
  if (document.querySelector(".sheet-wrap.open, .alert-wrap, .as-wrap.open, .live:not(.hidden), .summary.open")) return false;
  return !document.activeElement?.matches?.("input, textarea, select, [contenteditable]");
}

/**
 * Start the offline helper and watch for new versions. isBusy(): true while a workout is in progress.
 */
export function startUpdates({ isBusy } = {}) {
  if (isBusy) busy = isBusy;
  // the version before an update said it was switching: say it worked
  try {
    if (sessionStorage.getItem(KEY_UPDATED)) {
      sessionStorage.removeItem(KEY_UPDATED);
      setTimeout(() => toast(`Updated to ${APP_NAME} ${APP_VERSION}`), 600);
    }
  } catch { /* private mode */ }
  if (!supported()) return;
  // only when switching: the very first start also gets a helper, and that needs no reload
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (switching) location.reload(); });
  navigator.serviceWorker.register("sw.js").then((r) => {
    reg = r;
    lastCheck = Date.now();
    settle("start");
    r.addEventListener("updatefound", () => {
      const w = r.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed") settle("ready"); });
    });
    // a phone keeps the app open for days: look for a new version when it comes back to the front
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      frontAt = Date.now();
      settle("front");
      check();
    });
  }).catch(() => {});
}

function check(now = false) {
  if (!reg || (!now && Date.now() - lastCheck < 10 * 60000)) return Promise.resolve();
  lastCheck = Date.now();
  return reg.update().catch(() => {});
}

/**
 * A new version is waiting: switch now if it's a quiet moment. "ready" (it just finished downloading) only
 * switches in the first seconds after the app came to the front, not while you're in the middle of something.
 * Returns true when switching.
 */
export function settle(why = "idle") {
  if (!reg?.waiting || !navigator.serviceWorker.controller || switching) return false;
  if (why === "ready" && Date.now() - frontAt > 15000) return false;
  if (!quiet()) return false;
  apply();
  return true;
}

/** For Settings: look now, and switch if there's a new version. True when there was one. */
export async function checkForUpdate() {
  if (!reg) return false;
  await check(true);
  for (let i = 0; i < 60 && reg.installing; i++) await new Promise((r) => setTimeout(r, 250));   // let it download
  if (!reg.waiting) return false;
  apply();
  return true;
}

function apply() {
  switching = true;
  try { sessionStorage.setItem(KEY_UPDATED, "1"); } catch { /* private mode */ }
  const w = reg?.waiting;
  if (w) w.postMessage("update");
  // if the switch doesn't come, a reload still starts the new version once this one lets go
  setTimeout(() => location.reload(), w ? 4000 : 0);
}
