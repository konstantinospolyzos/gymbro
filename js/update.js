// Updates: GymBro runs from the copy saved on the phone (so it opens at once, even without a signal). A new
// version downloads in the background; then a bar says "New version ready" and one tap switches to it.

import { h, icon } from "./ui.js";

let reg = null;
let switching = false;
let lastCheck = 0;

const supported = () => "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname));

/** Start the offline helper and watch for new versions */
export function startUpdates() {
  if (!supported()) return;
  // only after "Update" was tapped: the very first start also gets a helper, and that needs no reload
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (switching) location.reload(); });
  navigator.serviceWorker.register("sw.js").then((r) => {
    reg = r;
    lastCheck = Date.now();
    offer();
    r.addEventListener("updatefound", () => {
      const w = r.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed") offer(); });
    });
    // a phone keeps the app open for days: look for a new version when it comes back to the front
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  }).catch(() => {});
}

function check(now = false) {
  if (!reg || (!now && Date.now() - lastCheck < 10 * 60000)) return Promise.resolve();
  lastCheck = Date.now();
  return reg.update().catch(() => {});
}

/** For Settings: look now. True when a new version is ready (the bar then shows it). */
export async function checkForUpdate() {
  if (!reg) return false;
  await check(true);
  for (let i = 0; i < 60 && reg.installing; i++) await new Promise((r) => setTimeout(r, 250));   // let it download
  offer();
  return Boolean(reg.waiting);
}

function offer() {
  if (!reg?.waiting || !navigator.serviceWorker.controller || document.getElementById("update-bar")) return;
  document.body.appendChild(h("div", { id: "update-bar", role: "status" },
    icon("download", 16), h("span", null, "New version ready"),
    h("button", { type: "button", class: "update-btn", onclick: apply }, "Update")));
}

function apply() {
  switching = true;
  const w = reg?.waiting;
  if (w) w.postMessage("update");
  // if the switch doesn't come, a reload still starts the new version once this one lets go
  setTimeout(() => location.reload(), w ? 4000 : 0);
}
