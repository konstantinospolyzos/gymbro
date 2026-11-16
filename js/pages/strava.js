// Strava in the app: the one-time setup, the Settings section, a workout's Strava row (in its summary and
// in History), and uploading workouts you did before connecting.

import { h, icon, sheet, group, caption, footer, actionRow, infoRow, switchRow, toast, alertBox, copyText, openExternal } from "../ui.js";
import { NetworkError } from "../cloud/common.js";
import { store } from "../store.js";
import { shortDate, parseDay, plural } from "../core.js";
import { stravaApp, setStravaApp, connected, athleteName, autoUpload, setAutoUpload, connectStrava, connectWithCode, finishPendingStrava,
  disconnectStrava, queueUploads, flushStrava, stravaStatus, stravaProgress, stravaProblem, onStrava, stravaRedirect } from "../strava-api.js";
import { NO } from "./common.js";

const notOnStrava = () => (store.data?.sessions || []).filter((s) => !s.strava);

/** Why connecting didn't work, in words */
const whyNot = (err) => (err instanceof NetworkError ? "GymBro couldn't reach Strava. Check the connection and try again." : err.message);

/** A connection that came back while the app was away (or after it stopped waiting): finish it */
function finishPending() {
  finishPendingStrava().then((name) => {
    if (name === null) return;
    document.querySelector(".alert-wrap.strava-paste .alert-btn")?.click();      // no code to paste any more
    toast(`Connected to Strava${name ? ` as ${name}` : ""}`);
    setTimeout(offerEarlier, 900);
  }).catch((err) => alertBox({ title: "Strava isn't connected", message: whyNot(err) }));
}

/** At the start: a connection that came back, and anything still waiting to go up */
export function startStrava() {
  finishPending();
  flushStrava();
  window.addEventListener("online", () => flushStrava());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { finishPending(); flushStrava(); } });
}

/** A workout just finished: up it goes, if you said so */
export function afterWorkout(session) {
  if (connected() && autoUpload()) queueUploads([session.id]);
}

// ---------------------------------------------------------------------------
// Setting it up
// ---------------------------------------------------------------------------
export function openStravaSetup({ onDone = null } = {}) {
  const app = stravaApp();
  const site = stravaRedirect().replace(/strava\.html$/, "");
  const field = (label, value, attrs) => {
    const el = h("input", { class: "form-input", type: "text", value, autocomplete: "off", autocapitalize: "off", autocorrect: "off",
      spellcheck: "false", "aria-label": label, ...attrs });
    return { el, row: h("label", { class: "form-row" }, h("span", { class: "form-label" }, label), el) };
  };
  const id = field("Client ID", app?.id || "", { inputmode: "numeric", placeholder: "12345" });
  const secret = field("Client Secret", app?.secret || "", { placeholder: "Paste it here" });
  const copyRow = (label, value) => h("button", { type: "button", class: "copy-row", "aria-label": `Copy ${label}: ${value}`,
    onclick: async () => toast((await copyText(value)) ? `${label} copied` : "Couldn't copy") },
    h("span", { class: "copy-text" }, h("span", { class: "copy-label" }, label), h("span", { class: "copy-value" }, value)), icon("copy", 17, "copy-icon"));

  const go = () => {
    const i = id.el.value.trim(), s = secret.el.value.trim();
    if (!/^\d+$/.test(i)) { toast("The Client ID is a number, like 12345"); id.el.focus(); return; }
    if (s.length < 20) { toast("Paste the Client Secret too"); secret.el.focus(); return; }
    setStravaApp(i, s);
    const done = (name) => {
      api.close();
      toast(`Connected to Strava${name ? ` as ${name}` : ""}`);
      onDone?.();
      offerEarlier();
    };
    // straight from the tap, so Strava's window can open
    connectStrava().then(done).catch(async (err) => {
      if (!err.closed) { alertBox({ title: "Strava isn't connected", message: whyNot(err) }); return; }
      // the window couldn't hand its answer over: it shows a code to paste here instead
      const ask = alertBox({ title: "Paste Strava's code", input: { placeholder: "The code from the Strava window" },
        message: "If the Strava window showed a code, copy it and paste it here.",
        buttons: [{ text: "Cancel", value: false, style: "cancel" }, { text: "Connect", value: true, style: "bold" }] });
      [...document.querySelectorAll(".alert-wrap")].at(-1)?.classList.add("strava-paste");
      const [go, code] = await ask;
      if (go && code) connectWithCode(code).then(done).catch((e) => alertBox({ title: "Strava isn't connected", message: whyNot(e) }));
    });
  };

  const body = h("div", { class: "form" },
    h("div", { class: "rec-intro" }, "GymBro adds each workout to Strava as a Weight Training activity with every set, so Strava shows the exercises, the volume and the muscles you trained. For that you make your own Strava API app once, in about two minutes. Strava asks for a subscription to make one."),
    caption("1 · Make the app on Strava"),
    group(actionRow("link", "Open Strava's API page", () => openExternal("https://www.strava.com/settings/api"),
      { detail: "strava.com/settings/api: sign in, then Create an app" })),
    footer("Fill it in with these (tap one to copy it). Pick any category. Strava then asks for an icon: any picture works."),
    h("div", { class: "group" }, copyRow("Application Name", "GymBro"), copyRow("Website", site), copyRow("Authorization Callback Domain", location.hostname)),
    caption("2 · Copy its codes here"),
    group(id.row, secret.row),
    footer("Strava shows them under My API Application. They stay on this phone."),
    caption("3 · Connect"),
    h("button", { type: "button", class: "btn strava wide big", onclick: go }, "Connect with Strava"),
    footer("Strava opens: sign in, keep “Upload your activities” ticked and tap Authorize."));
  const api = sheet({ title: "Strava", left: { text: "Cancel" }, body });
  return api;
}

/** Just connected: the workouts from before can go up too */
async function offerEarlier() {
  const n = notOnStrava().length;
  if (!n) return;
  const ok = await alertBox({ title: "Upload your earlier workouts?", message: `${plural(n, "workout")} you logged before aren't on Strava. Choose which ones go up: each becomes an activity on its own day.`,
    buttons: [{ text: "Not now", value: false, style: "cancel" }, { text: "Choose", value: true, style: "bold" }] });
  if (ok) openStravaUploads();
}

// ---------------------------------------------------------------------------
// Settings › Strava
// ---------------------------------------------------------------------------
/** The Settings section. rebuild(): draws Settings again */
export function stravaSettings(rebuild) {
  const parts = [caption("Strava")];
  if (!connected()) {
    parts.push(group(actionRow("upload", stravaApp() ? "Connect Strava" : "Set up Strava", () => openStravaSetup({ onDone: rebuild }),
      { detail: "Each workout on Strava, with every set and the muscles trained" })));
    const why = stravaProblem();
    parts.push(footer(why ? `${why}` : "A Weight Training activity for each workout, with its exercises, sets, kilos and the muscles trained."));
    return parts;
  }
  const missing = notOnStrava().length;
  parts.push(group(
    infoRow("Connected as", athleteName() || "you"),
    switchRow("Upload automatically", autoUpload(), (on) => setAutoUpload(on), "upload"),
    actionRow("history", "Upload earlier workouts", () => openStravaUploads(),
      { detail: missing ? `${plural(missing, "workout")} not on Strava` : "Every workout is on Strava" }),
    actionRow("cloudOff", "Disconnect Strava", async () => {
      const ok = await alertBox({ title: "Disconnect Strava?", message: "Workouts that are on Strava stay there. You can connect again any time.",
        buttons: [NO, { text: "Disconnect", value: true, style: "destructive" }] });
      if (!ok) return;
      await disconnectStrava();
      toast("Strava disconnected");
      rebuild();
    }, { tone: "danger" })));
  parts.push(footer(`${stravaProblem() ? `${stravaProblem()} ` : ""}Automatically: each workout goes up when you finish it, as a Weight Training activity with every set, so Strava shows the exercises, the volume and its muscle map. The description has the hard sets per muscle. Without a signal it goes up once you're back online.`));
  return parts;
}

// ---------------------------------------------------------------------------
// One workout: its row in the summary and in History
// ---------------------------------------------------------------------------
/** A row for a group that follows the workout's upload as it happens; null when Strava isn't used */
export function stravaRow(sessionId) {
  if (!connected() && stravaStatus(sessionId).state !== "done") return null;
  const el = h("div", { class: "strava-row" });
  let off = null;
  const draw = () => {
    if (off && !el.isConnected) { off(); return; }       // the summary or sheet has closed
    const st = stravaStatus(sessionId);
    let row;
    if (st.state === "done") {
      row = actionRow("checkBold", "On Strava", st.link ? () => openExternal(st.link) : () => toast("It's on Strava"),
        { detail: `Uploaded ${shortDate(new Date(st.at))}${st.link ? " · tap to open it" : ""}` });
      row.classList.add("strava-done");
      if (!st.link) row.querySelector(".chev")?.remove();
    } else if (st.state === "uploading" || st.state === "queued") {
      row = h("div", { class: "action-row strava-busy", role: "status" }, icon("upload", 20, "row-icon"),
        h("span", { class: "action-text" }, h("span", null, st.state === "uploading" ? "Uploading to Strava…" : "Waiting to upload to Strava"),
          st.problem ? h("span", { class: "action-detail" }, st.problem) : null));
    } else if (!connected()) {
      row = null;
    } else {
      row = actionRow("upload", st.state === "failed" ? "Upload to Strava again" : "Upload to Strava", () => queueUploads([sessionId]),
        { detail: st.state === "failed" ? st.why : "A Weight Training activity with every set", tone: st.state === "failed" ? "warn" : "" });
    }
    el.replaceChildren(...(row ? [row] : []));
    el.hidden = !row;
  };
  draw();
  off = onStrava(draw);
  return el;
}

// ---------------------------------------------------------------------------
// Workouts from before
// ---------------------------------------------------------------------------
export function openStravaUploads() {
  // every workout not on Strava when the sheet opened, newest first; they stay listed as they go up
  const ids = notOnStrava().sort((a, b) => b.start - a.start).map((s) => s.id);
  const picked = new Set();
  const body = h("div", { class: "form" });
  let started = false;
  const session = (id) => store.data.sessions.find((x) => x.id === id);

  const draw = () => {
    if (off && !body.isConnected) { off(); return; }
    const list = ids.filter((id) => session(id));
    const st = Object.fromEntries(list.map((id) => [id, stravaStatus(id)]));
    const open = list.filter((id) => ["none", "failed"].includes(st[id].state));
    for (const id of [...picked]) if (!open.includes(id)) picked.delete(id);
    const parts = [h("div", { class: "rec-intro" }, list.length
      ? "Each becomes a Weight Training activity on the day you did it, with every set and the muscles trained."
      : "Every workout you've logged is on Strava.")];
    if (open.length) {
      const all = open.every((id) => picked.has(id));
      parts.push(caption(plural(open.length, "workout"), h("button", { type: "button", class: "link-btn", onclick: () => {
        if (all) picked.clear(); else open.forEach((id) => picked.add(id));
        draw();
      } }, all ? "Select none" : "Select all")));
    } else if (list.length) parts.push(caption("Workouts"));
    const rows = list.map((id) => {
      const s = session(id), state = st[id].state, on = picked.has(id);
      const sets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
      const sub = state === "done" ? "On Strava ✓" : state === "uploading" ? "Uploading…" : state === "queued" ? "Waiting…"
        : state === "failed" ? `Didn't go up: ${st[id].why}` : `${plural(s.exercises.length, "exercise")} · ${plural(sets, "set")}`;
      const pickable = ["none", "failed"].includes(state);
      return h("button", { type: "button", class: `pick-row strava-pick ${on ? "on" : ""} ${state}`, disabled: !pickable, onclick: () => {
        if (!pickable) return;
        if (on) picked.delete(id); else picked.add(id);
        draw();
      } },
      h("span", { class: "pick-name" }, `${shortDate(parseDay(s.date))} · ${s.name}`, h("div", { class: "pick-kind" }, sub)),
      pickable ? h("span", { class: "pick-box" }, on ? icon("check", 15) : null)
        : icon(state === "done" ? "checkBold" : "upload", 18, state === "done" ? "strava-ok" : "strava-wait"));
    });
    if (rows.length) parts.push(h("div", { class: "group" }, rows));
    const { waiting } = stravaProgress();
    if (started && waiting) parts.push(footer(stravaProblem() || `Uploading: ${plural(waiting, "workout")} to go. You can close this: it goes on in the background while GymBro is open.`));
    if (picked.size) {
      parts.push(h("div", { class: "sticky-bar" }, h("button", { type: "button", class: "btn strava wide big", onclick: () => {
        started = true;
        // the oldest first, so they go up in the order you did them
        const go = [...picked].sort((a, b) => session(a).start - session(b).start);
        picked.clear();
        queueUploads(go);
        draw();
      } }, `Upload ${plural(picked.size, "workout")}`)));
    }
    body.replaceChildren(...parts);
  };
  let off = null;
  draw();
  off = onStrava(draw);
  return sheet({ title: "Upload to Strava", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body });
}
