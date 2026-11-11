// GymBro for phones: the app shell (navigation bar, tabs, pages, the cloud button).
import { store, describeData } from "./store.js";
import { h, icon, alertBox, toast } from "./ui.js";
import { renderToday } from "./pages/today.js";
import { renderPlan } from "./pages/plan.js";
import { renderHistory, openSessionEditor } from "./pages/history.js";
import { renderProgress } from "./pages/progress.js";
import { renderWelcome } from "./pages/welcome.js";
import { openSettings, applyTheme } from "./pages/settings.js";
import { restoreLive, startWorkout, openLive } from "./pages/live.js";
import { openWorkoutEditor } from "./pages/editors.js";
import { chooseWorkout } from "./pages/common.js";
import { isoDay } from "./core.js";
import { startUpdates } from "./update.js";

const TABS = [
  { key: "today", title: "Today", icon: "dumbbell", render: renderToday },
  { key: "plan", title: "Plan", icon: "calendar", render: renderPlan },
  { key: "history", title: "History", icon: "history", render: renderHistory },
  { key: "progress", title: "Progress", icon: "progress", render: renderProgress },
];
const tabKeys = TABS.map((t) => t.key);
let current = tabKeys.includes(location.hash.slice(1)) ? location.hash.slice(1) : "today";
const scrolls = {};

const main = document.getElementById("main");
const navbar = document.getElementById("navbar");
const navTitle = document.getElementById("nav-title");
const syncBtn = document.getElementById("sync-btn");
const addBtn = document.getElementById("add-btn");
const tabbar = document.getElementById("tabbar");
let statusPill = null;

function go(key) {
  if (!tabKeys.includes(key)) return;
  scrolls[current] = window.scrollY;
  current = key;
  history.replaceState(null, "", `#${key}`);
  render();
  window.scrollTo(0, scrolls[key] || 0);
}

/** First time a phone with workouts meets a cloud file with workouts: which to keep? */
store.chooser = (mine, theirs, label) => alertBox({
  title: "Which workouts do you want?",
  message: `${label} has ${describeData(theirs)}.\nThis phone has ${describeData(mine)}.`,
  buttons: [
    { text: `Use ${label}'s`, value: "cloud", style: "bold" },
    { text: `Use this phone's (replaces ${label}'s)`, value: "device" },
  ],
});

const SYNC_ICONS = { local: "phone", synced: "cloudCheck", syncing: "sync", pending: "cloudUp", signin: "cloudUp", offline: "cloudOff", error: "cloudOff", idle: "cloud" };

function updateChrome() {
  const st = store.status;
  syncBtn.replaceChildren(icon(SYNC_ICONS[st.state] || "cloud", 23));
  syncBtn.className = `nav-btn sync-state-${st.state}`;
  syncBtn.setAttribute("aria-label", st.text || "Data");
  if (statusPill) {
    const attention = ["signin", "error", "offline", "pending"].includes(st.state);
    statusPill.className = `status-pill state-${st.state} ${attention ? "attention" : ""}`;
    statusPill.replaceChildren(icon(SYNC_ICONS[st.state] || "cloud", 15), h("span", null, st.text));
    statusPill.style.display = st.text ? "" : "none";
  }
}

function buildTabbar() {
  tabbar.replaceChildren(...TABS.map((t) => {
    const b = h("button", { type: "button", class: `tab ${t.key === current ? "on" : ""}`, "aria-label": t.title, "aria-current": t.key === current ? "page" : null },
      icon(t.icon, 26), h("span", null, t.title));
    b.addEventListener("click", () => (t.key === current ? window.scrollTo({ top: 0, behavior: "smooth" }) : go(t.key)));
    return b;
  }));
}

const ADD_LABELS = { today: "Start a workout", plan: "New workout", history: "Log a past workout" };

function render() {
  const ready = store.ready;
  document.body.classList.toggle("welcome-mode", !ready);
  if (!ready) {
    statusPill = null;
    main.replaceChildren(renderWelcome());
    return;
  }
  const tab = TABS.find((t) => t.key === current);
  const [subtitle, ...content] = tab.render();
  navTitle.textContent = tab.title;
  statusPill = h("button", { type: "button", class: "status-pill" });
  statusPill.addEventListener("click", () => (store.cloud ? store.syncFromTap().then(() => toast(store.status.text)) : openSettings()));
  const showPill = current === "today" || ["signin", "error"].includes(store.status.state);
  main.replaceChildren(h("div", { class: "page", dataset: { page: current } },
    h("h1", { class: "large-title" }, tab.title),
    h("div", { class: "subtitle" }, subtitle),
    showPill ? statusPill : null,
    ...content.filter(Boolean)));
  addBtn.hidden = !ADD_LABELS[current];
  addBtn.setAttribute("aria-label", ADD_LABELS[current] || "Add");
  buildTabbar();
  updateChrome();
}

async function addNew() {
  if (!store.ready) return;
  if (current === "plan") return openWorkoutEditor(null);
  if (current === "history") return openSessionEditor(null);
  if (store.active) return openLive();
  const w = await chooseWorkout();
  if (w) startWorkout(w === "empty" ? null : w);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
document.getElementById("settings-btn").addEventListener("click", () => store.ready && openSettings());
addBtn.addEventListener("click", addNew);
syncBtn.addEventListener("click", () => {
  if (!store.ready) return;
  if (store.cloud) store.syncFromTap().then(() => toast(store.status.text));
  else openSettings();
});

// The cloud sign-in runs out (Google: after an hour; OneDrive: after a day) and a sign-in window may only
// open from a tap. So when it has, the first tap anywhere signs in again and syncs, once; if that doesn't
// work, the cloud button is there. Never during a workout: those taps are for your sets.
let autoSignIn = true, touchAt = null;
function signInOnTap(ev) {
  if (!autoSignIn || !store.ready || !store.needsTap || !navigator.onLine || !store.cloud?.tapReady) return;
  if (ev.target.closest?.("#sync-btn, input, textarea, select, .sheet-wrap, .alert-wrap, .as-wrap, .live, .summary, .mini-bar, .start-btn")) return;
  autoSignIn = false;
  store.syncFromTap().then(() => { if (store.needsTap && /blocked/.test(store.status.text || "")) autoSignIn = true; });
}
document.addEventListener("touchstart", (ev) => { const t = ev.touches[0]; touchAt = t ? [t.clientX, t.clientY] : null; }, { capture: true, passive: true });
document.addEventListener("touchend", (ev) => {
  const t = ev.changedTouches[0];
  if (t && touchAt && Math.hypot(t.clientX - touchAt[0], t.clientY - touchAt[1]) < 10) signInOnTap(ev);
}, true);
document.addEventListener("click", signInOnTap, true);
store.on((kind) => { if (kind === "status" && !store.needsTap) autoSignIn = true; });

window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", window.scrollY > 38), { passive: true });
window.addEventListener("hashchange", () => { const k = location.hash.slice(1); if (k !== current && tabKeys.includes(k)) go(k); });

store.on((kind) => (kind === "status" ? updateChrome() : render()));
applyTheme();
store.load();
render();
if (store.active && store.ready) restoreLive();
if (store.cloud) store.sync();

// after midnight: a new day, a new Today
let day = isoDay(new Date());
setInterval(() => { const d = isoDay(new Date()); if (d !== day) { day = d; if (store.ready && !document.querySelector(".sheet-wrap")) render(); } }, 60000);

startUpdates();
