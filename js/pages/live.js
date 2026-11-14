// The workout screen: the total time at the top, every exercise with its sets, and the panel at the
// bottom: log the set with one big button, then the rest counts down, beeping (and flashing) in its last
// seconds so you're ready for the next set. Pull it down to look at the rest of the app; the workout
// keeps running in the bar above the tabs.

import { h, s, icon, alertBox, actionSheet, toast, askText, selectOnFocus, darkStatusBar } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { clock, fmtKg, kg, fmtRest, parseNum, parseSecs, setShort, setText, timeUnit, fmtSecs, relDay, timeOfDay, plural,
  supersets, linkNext, unlink, barOf, platesText } from "../core.js";
import { TIPS, videoUrl } from "../library.js";
import { startActive, completeSet, uncompleteSet, current, addRest, skipRest, restLeft, tick, counts, toSession, addSet, removeSet,
  addExercise, removeExercise, moveExercise, lastDoneAt, noteFor, setNote, notesChanged, notesToSave,
  addWarmups, removeWarmups, warmCount, workIndex, swapExercise, retargetRest } from "../workout.js";
import { unlock, scheduleCountdown, cancelCountdown, keepAwake, haptic, playFinish } from "../sound.js";
import { NO, chooseRest } from "./common.js";
import { openExercisePicker, openSwapPicker } from "./editors.js";
import { showSummary } from "./summary.js";

let root = null, mini = null, timer = null;
const els = {};
let shownSecond = null;
let listStale = false;          // the list waits while you type (rebuilding it would close the keyboard)
const RING_R = 58, RING_C = 2 * Math.PI * RING_R;
const TYPING = ".set-input, .ex-note";

const A = () => store.active;
const save = () => store.saveActive(A());
const settings = () => store.data.settings;
const isOpen = () => Boolean(root && !root.classList.contains("hidden"));
const typingInList = () => Boolean(root && root.contains(document.activeElement) && document.activeElement.matches?.(TYPING));

/** "Warm-up 1 of 2" or "Set 2 of 3" (warm-ups don't count as sets) */
function setName(x, s) {
  const wi = workIndex(x, s);
  return wi === null ? `Warm-up ${s + 1} of ${warmCount(x)}` : `Set ${wi + 1} of ${x.sets.length - warmCount(x)}`;
}

/** For a barbell lift with a weight: "Each side: 20 + 10 + 2.5" */
function platesLine(ex, w) {
  const bar = barOf(ex);
  return bar && w ? platesText(w, bar, settings().plates) : "";
}

const openVideo = (name) => window.open(videoUrl(name), "_blank", "noopener");

// ---------------------------------------------------------------------------
// Starting, opening, closing
// ---------------------------------------------------------------------------
/** From a tap: start a workout from the plan (or an empty one) */
export function startWorkout(workout) {
  if (A()) { openLive(); return; }
  unlock();
  haptic();
  const a = startActive(store.data, workout, Date.now(), { rest: settings().rest });
  store.saveActive(a);
  openLive();
  store.emit();
  if (!a.exercises.length) setTimeout(addExercises, 350);
}

export function openLive() {
  if (!A()) return;
  if (!root) build();
  render();
  root.classList.remove("hidden");
  document.documentElement.classList.add("locked");
  darkStatusBar(true);
  if (mini) mini.hidden = true;
  document.body.classList.remove("has-mini");
  if (settings().awake) keepAwake(true);
  if (A().resting && settings().sound) scheduleCountdown(A().resting.until, settings().countdown);
  startTicker();
}

function minimize() {
  if (!root) return;
  root.classList.add("hidden");
  document.documentElement.classList.remove("locked");
  darkStatusBar(false);
  showMini();
  store.emit();
}

function closeLive() {
  stopTicker();
  cancelCountdown();
  keepAwake(false);
  document.documentElement.classList.remove("locked");
  darkStatusBar(false);
  root?.remove();
  root = null;
  if (mini) mini.hidden = true;
  document.body.classList.remove("has-mini");
}

/** On start: a workout still running from before (the app was closed) comes back as the bar */
export function restoreLive() {
  if (!A()) return;
  tick(A(), Date.now());
  save();
  showMini();
  startTicker();
}

function showMini() {
  if (!mini) {
    mini = h("button", { type: "button", class: "mini-bar", hidden: true, onclick: () => { unlock(); openLive(); } });
    document.body.appendChild(mini);
  }
  mini.hidden = false;
  document.body.classList.add("has-mini");
  updateMini(Date.now());
}

function updateMini(now) {
  if (!mini || mini.hidden || !A()) return;
  const a = A();
  const left = restLeft(a, now);
  const cur = current(a);
  const cx = cur ? a.exercises[cur.e] : null;
  const sub = a.resting ? "Resting" : cx ? `${exerciseMap(store.data).get(cx.ex)?.name || cx.name} · ${setName(cx, cur.s).toLowerCase()}` : "All sets done";
  mini.classList.toggle("warn", Boolean(a.resting) && left <= settings().countdown * 1000);
  mini.replaceChildren(
    h("span", { class: `dot c-${a.color}`, style: { width: "10px", height: "10px" } }),
    h("span", { class: "mini-text" }, h("div", { class: "mini-name" }, a.name), h("div", { class: "mini-sub" }, sub)),
    h("span", { class: "mini-time" }, a.resting ? clock(Math.ceil(left / 1000) * 1000) : clock(now - a.start)),
    icon("chevronUp", 18));
}

function startTicker() {
  if (timer) return;
  timer = setInterval(loop, 250);
  loop();
}
function stopTicker() { clearInterval(timer); timer = null; }

function loop() {
  const a = A();
  if (!a) { stopTicker(); return; }
  const now = Date.now();
  if (a.resting) {
    const until = a.resting.until;
    if (tick(a, now)) {
      save();
      shownSecond = null;
      if (isOpen()) {
        if (typingInList()) { listStale = true; renderDock(); } else render();
        if (now - until < 2500) { flash("Go!", "go"); haptic(); }
      }
    }
  }
  if (isOpen()) {
    els.clock.textContent = clock(now - a.start);
    if (a.resting) updateRest(now);
  }
  updateMini(now);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !A()) return;
  loop();
  if (A()?.resting && settings().sound) scheduleCountdown(A().resting.until, settings().countdown);
});

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------
function build() {
  root = h("div", { class: "live dark-scope hidden", role: "dialog", "aria-modal": "true", "aria-label": "Workout" });
  els.name = h("div", { class: "live-name" });
  els.clock = h("div", { class: "live-clock", role: "timer", "aria-label": "Workout time" }, "0:00");
  els.barFill = h("span");
  els.list = h("div", { class: "live-scroll" });
  els.dock = h("div", { class: "dock" });
  els.flash = h("div", { class: "go-flash", "aria-hidden": "true" });
  root.append(
    h("div", { class: "live-top" },
      h("div", { class: "live-min" }, h("button", { type: "button", class: "icon-btn", "aria-label": "Show the app", onclick: minimize }, icon("chevronDown", 22))),
      h("div", { class: "live-title" }, els.name, els.clock),
      h("button", { type: "button", class: "live-finish", onclick: finish }, "Finish")),
    h("div", { class: "live-bar" }, els.barFill),
    els.list, els.dock, els.flash);
  // typing a weight or a note: the panel moves away so the keyboard has room
  root.addEventListener("focusin", (ev) => { if (ev.target.matches?.(TYPING)) root.classList.add("typing"); });
  root.addEventListener("focusout", () => setTimeout(() => {
    if (root && !document.activeElement?.matches?.(TYPING)) {
      root.classList.remove("typing");
      if (listStale) render(); else renderDock();
    }
  }, 80));
  // after the app was reopened, sounds need a tap again
  root.addEventListener("pointerdown", () => unlock(), { passive: true });
  document.body.appendChild(root);
}

function render() {
  if (!root || !A()) return;
  listStale = false;
  saveNotes();              // a note typed just before a tap: its box is about to be rebuilt
  const a = A();
  root.style.setProperty("--wc", `var(--w-${a.color})`);
  els.name.replaceChildren(h("span", { class: `dot c-${a.color}` }), a.name);
  els.clock.textContent = clock(Date.now() - a.start);
  renderList();
  renderDock();
}

function setHead(kind, unit) {
  const cols = kind === "time" ? ["Set", "Last", unit === "min" ? "Min" : "Sec", ""]
    : ["Set", "Last", kind === "reps" ? "+kg" : "kg", "Reps", ""];
  return h("div", { class: `set-head ${kind === "time" ? "time" : ""}` }, cols.map((c) => h("span", null, c)));
}

function input(e, i, key, value, { placeholder = "", mode = "decimal", label = "" } = {}) {
  const el = selectOnFocus(h("input", { class: "set-input", type: "text", inputmode: mode, pattern: mode === "numeric" ? "[0-9]*" : null,
    value, placeholder, autocomplete: "off", enterkeyhint: "done", "aria-label": label, dataset: { e, s: i, k: key } }));
  el.addEventListener("input", () => {
    const st = A()?.exercises[e]?.sets[i];
    if (!st) return;
    const unit = el.dataset.unit;
    if (key === "w") st.w = parseNum(el.value);
    else if (key === "r") { const n = parseNum(el.value); st.r = n === null ? null : Math.max(0, Math.round(n)); }
    else { const n = unit === "min" ? parseNum(el.value) : parseSecs(el.value); st.s = n === null ? null : Math.round(unit === "min" ? n * 60 : n); }
    save();
  });
  return el;
}

function exerciseCard(x, e, cur, ss) {
  const ex = exerciseMap(store.data).get(x.ex);
  const kind = ex?.kind || x.kind, unit = timeUnit(ex);
  const allDone = x.sets.length > 0 && x.sets.every((st) => st.done);
  const range = x.target?.hi && kind !== "time" ? `${x.target.reps}–${x.target.hi} reps` : null;
  const meta = [ex?.muscle, range, x.rest !== null && x.rest !== undefined ? `Rest ${fmtRest(x.rest)}` : null,
    x.prevDate ? `Last: ${relDay(x.prevDate)}` : "First time"].filter(Boolean).join(" · ");
  const rows = x.sets.map((st, i) => {
    const isCur = cur && cur.e === e && cur.s === i;
    const wi = workIndex(x, i);
    const prev = wi === null ? null : x.prev[wi] || null;
    const t = x.target || {};
    const label = wi === null ? "warm-up set" : `set ${wi + 1}`;
    const row = h("div", { class: `set-row ${kind === "time" ? "time" : ""} ${st.done ? "done" : ""} ${isCur ? "current" : ""} ${st.warm ? "warm" : ""}` },
      h("button", { type: "button", class: "set-num", "aria-label": `Do ${label} next`, onclick: () => focusSet(e, i) }, wi === null ? "W" : String(wi + 1)),
      h("button", { type: "button", class: "set-prev", "aria-label": "Use last time's", onclick: () => copyPrev(e, i) }, prev ? setShort(prev, kind, unit) : wi === null ? "warm-up" : "—"));
    if (kind === "time") {
      const v = st.s === null || st.s === undefined ? "" : unit === "min" ? String(Math.round((st.s / 60) * 10) / 10) : String(st.s);
      const inp = input(e, i, "s", v, { placeholder: t.secs ? (unit === "min" ? String(t.secs / 60) : String(t.secs)) : unit, mode: unit === "min" ? "decimal" : "numeric", label: unit === "min" ? "Minutes" : "Seconds" });
      inp.dataset.unit = unit;
      row.appendChild(inp);
    } else {
      row.append(
        input(e, i, "w", st.w === null || st.w === undefined ? "" : fmtKg(st.w).replace(/ /g, ""), { placeholder: kind === "reps" ? "+0" : t.w ? fmtKg(t.w) : "kg", label: kind === "reps" ? "Added kilos" : "Kilos" }),
        input(e, i, "r", st.r === null || st.r === undefined ? "" : String(st.r), { placeholder: t.reps ? String(t.reps) : "reps", mode: "numeric", label: "Reps" }));
    }
    row.appendChild(h("button", { type: "button", class: "set-check", "aria-label": st.done ? `${label} done. Tap to undo` : `${label}: done`, onclick: () => toggleDone(e, i) },
      icon(st.done ? "checkBold" : "check", 20)));
    return row;
  });
  const ssPos = ss ? (ss.pos === 0 ? "first" : ss.pos === ss.size - 1 ? "last" : "middle") : "";
  return h("div", { class: `ex-card ${cur && cur.e === e ? "current" : ""} ${allDone ? "finished" : ""} ${ss ? `ss ss-${ssPos}` : ""}`, dataset: { e } },
    ss ? h("div", { class: "ss-label" }, icon("link", 14), `Superset ${ss.label} · ${ss.pos + 1} of ${ss.size}`, h("span", { class: "muted" }, " · one set of each, then rest")) : null,
    h("div", { class: "ex-head" },
      h("div", { style: { flex: "1", minWidth: "0" } }, h("div", { class: "ex-title" }, ex?.name || x.name), h("div", { class: "ex-meta" }, meta),
        x.up ? h("div", { class: "ex-up" }, icon("arrowUp", 14), `+${kg(x.up.kg)} today: last time every set hit ${x.up.reps}`) : null),
      h("button", { type: "button", class: "icon-btn", "aria-label": `${ex?.name || "Exercise"}: more`, onclick: () => exerciseMenu(e) }, icon("more", 22))),
    noteBox(x, e, ex),
    h("div", { class: "sets" }, setHead(kind, unit), rows),
    h("div", { class: "ex-actions" },
      h("button", { type: "button", class: "link-btn", onclick: () => { addSet(A(), e); save(); render(); } }, icon("plus", 16), "Add set"),
      x.sets.length > 1 && !x.sets.at(-1).done
        ? h("button", { type: "button", class: "link-btn", style: { color: "var(--gray)" }, onclick: () => { removeSet(A(), e, x.sets.length - 1); save(); render(); } }, icon("minus", 16), "Remove set")
        : null));
}

/** The exercise's notes: they stay with the exercise, so they're here every time you do it */
function noteBox(x, e, ex) {
  const box = h("textarea", { class: "ex-note", rows: 1, maxlength: 500, placeholder: "Notes: seat height, grip, next time…",
    autocapitalize: "sentences", "aria-label": `Notes on ${ex?.name || x.name}` });
  box.value = noteFor(A(), store.data, e);
  box.addEventListener("input", () => {
    const a = A(), i = a ? a.exercises.findIndex((b) => b.key === x.key) : -1;
    if (i < 0) return;
    setNote(a, store.data, i, box.value);
    save();
    fitNote(box);
  });
  box.addEventListener("change", saveNotes);
  return box;
}

/** A notes box is as tall as its text */
function fitNote(box) {
  box.style.height = "auto";
  box.style.height = `${box.scrollHeight}px`;
}

/** Notes typed in the workout go to the exercises, so they show next time (and in the exercise list) */
function saveNotes() {
  const a = A();
  if (!a) return;
  for (const n of notesToSave(a, store.data)) store.setExerciseNotes(n.ex, n.notes);
}

function renderList() {
  const a = A(), cur = current(a);
  const { done, total } = counts(a);
  els.barFill.style.width = `${total ? (done / total) * 100 : 0}%`;
  const head = h("div", { class: "card-head", style: { margin: "0 4px -2px" } },
    h("span", { class: "muted", style: { fontSize: "14px", fontWeight: "600" } }, total ? `${done} of ${plural(total, "set")} done` : "No exercises yet"),
    h("button", { type: "button", class: "meta-chip", onclick: changeRest }, icon("timer", 15), `Rest ${fmtRest(a.rest)}`));
  const ss = supersets(a.exercises);
  els.list.replaceChildren(head, ...a.exercises.map((x, e) => exerciseCard(x, e, cur, ss[e])),
    h("div", { class: "live-add" }, h("button", { type: "button", class: "btn gray", onclick: addExercises }, icon("plus", 18), "Add exercise")),
    h("button", { type: "button", class: "live-discard", onclick: () => discard() }, "Discard workout"),
    h("div", { class: "spacer" }));
  for (const box of els.list.querySelectorAll(".ex-note")) fitNote(box);
}

/** − value + with the value tappable to type it */
function bigStep(value, { step, unit, label, format, parse, onChange }) {
  let v = value ?? 0;
  const num = h("div", { class: "big-step-num" }, format(v));
  const set = (n) => { v = Math.max(0, Math.round(n * 100) / 100); num.textContent = format(v); onChange(v); };
  const valueBtn = h("button", { type: "button", class: "big-step-value", "aria-label": `${label}: type it`, onclick: async () => {
    const t = await askText({ title: label, value: format(v), ok: "Set", mode: "decimal" });
    const n = t === null ? null : parse(t);
    if (n !== null && n !== undefined) set(n);
  } }, num, h("div", { class: "big-step-unit" }, unit));
  return h("div", { class: "big-step" },
    h("button", { type: "button", "aria-label": `Less ${label}`, onclick: () => set(v - step) }, icon("minus", 20)),
    valueBtn,
    h("button", { type: "button", "aria-label": `More ${label}`, onclick: () => set(v + step) }, icon("plus", 20)));
}

function syncRowInput(e, i, key, text) {
  const el = els.list.querySelector(`.set-input[data-e="${e}"][data-s="${i}"][data-k="${key}"]`);
  if (el) el.value = text;
}

function renderDock() {
  if (!root || !A()) return;
  const a = A();
  els.dock.className = "dock";
  if (a.resting) { renderRest(); measureDock(); return; }
  const cur = current(a);
  if (!a.exercises.length) {
    els.dock.replaceChildren(h("div", { class: "dock-now" }, h("div", { class: "dock-ex" }, "Add your first exercise")),
      h("button", { type: "button", class: "done-btn finish", onclick: addExercises }, icon("plus", 24), "Add exercise"));
  } else if (!cur) {
    els.dock.replaceChildren(h("div", { class: "dock-now" }, h("div", { class: "dock-ex" }, "Every set is done 💪"), h("div", { class: "dock-set" }, clock(Date.now() - a.start))),
      h("button", { type: "button", class: "done-btn finish", onclick: () => finish() }, icon("checkBold", 24), "Finish workout"));
  } else {
    const x = a.exercises[cur.e], st = x.sets[cur.s];
    const ex = exerciseMap(store.data).get(x.ex);
    const kind = ex?.kind || x.kind, unit = timeUnit(ex);
    const kgStep = ex?.step || 2.5;
    const plates = h("div", { class: "dock-plates" }, platesLine(ex, st.w));
    const controls = [];
    if (kind === "time") {
      const isMin = unit === "min";
      controls.push(bigStep(st.s ?? 0, { step: isMin ? 60 : 5, unit: isMin ? "minutes" : "seconds", label: isMin ? "Minutes" : "Seconds",
        format: (v) => (isMin ? fmtKg(v / 60) : fmtSecs(v)), parse: (t) => (isMin ? (parseNum(t) ?? 0) * 60 : parseSecs(t)),
        onChange: (v) => { st.s = Math.round(v); save(); syncRowInput(cur.e, cur.s, "s", isMin ? String(Math.round((v / 60) * 10) / 10) : String(Math.round(v))); } }));
    } else {
      const wStep = bigStep(st.w ?? 0, { step: kgStep, unit: kind === "reps" ? "+ kg" : "kg", label: kind === "reps" ? "Added kilos" : "Kilos",
        format: (v) => fmtKg(v).replace(/ /g, " "), parse: (t) => parseNum(t),
        onChange: (v) => { st.w = v; save(); syncRowInput(cur.e, cur.s, "w", fmtKg(v).replace(/ /g, "")); plates.textContent = platesLine(ex, v); } });
      const rStep = bigStep(st.r ?? 0, { step: 1, unit: "reps", label: "Reps", format: (v) => String(Math.round(v)), parse: (t) => parseNum(t),
        onChange: (v) => { st.r = Math.round(v); save(); syncRowInput(cur.e, cur.s, "r", String(Math.round(v))); } });
      controls.push(...(kind === "reps" ? [rStep, wStep] : [wStep, rStep]));
    }
    const g = supersets(a.exercises)[cur.e];
    els.dock.replaceChildren(
      h("div", { class: "dock-now" }, h("div", { class: "dock-ex" }, ex?.name || x.name),
        h("div", { class: "dock-set" }, [setName(x, cur.s), !st.warm && x.target?.hi && kind !== "time" ? `${x.target.reps}–${x.target.hi} reps` : null,
          g ? `Superset ${g.label}` : null].filter(Boolean).join(" · ")),
        barOf(ex) ? plates : null),
      h("div", { class: `dock-controls ${controls.length === 1 ? "one" : ""}` }, controls),
      h("button", { type: "button", class: "done-btn", onclick: () => doneCurrent() }, icon("checkBold", 26), "Set done"));
  }
  measureDock();
}

function measureDock() {
  requestAnimationFrame(() => { if (root) root.style.setProperty("--dock-h", `${els.dock.offsetHeight + 8}px`); });
}

function renderRest() {
  const a = A(), r = a.resting;
  const x = a.exercises[r.e], st = x?.sets[r.s];
  const ex = x ? exerciseMap(store.data).get(x.ex) : null;
  els.ringFill = s("circle", { class: "ring-fill", cx: 66, cy: 66, r: RING_R, "stroke-dasharray": RING_C.toFixed(1), "stroke-dashoffset": "0" });
  els.ringTime = h("div", { class: "ring-time", role: "timer", "aria-label": "Rest left" });
  const ring = h("div", { class: "ring" },
    s("svg", { width: 132, height: 132, viewBox: "0 0 132 132" }, s("circle", { class: "ring-track", cx: 66, cy: 66, r: RING_R }), els.ringFill),
    h("div", { class: "ring-center" }, els.ringTime, h("div", { class: "ring-label" }, "Rest")));
  const kind = ex?.kind || x?.kind || "weight";
  // the next set as it stands: "60 kg × 8", or only "8 reps" while it has no weight yet (not "0 kg × 8")
  const what = !st ? "" : kind === "weight" && !st.w ? (st.r ? plural(st.r, "rep") : "") : (st.r || st.s) ? setText(st, kind, timeUnit(ex)) : "";
  const nextText = st ? `${setName(x, r.s)}${what ? ` · ${what}` : ""}` : "";
  const load = st ? platesLine(ex, st.w) : "";
  els.dock.replaceChildren(h("div", { class: "rest" }, ring,
    h("div", { class: "rest-side" },
      h("div", { class: "rest-next" }, "Next", h("b", null, ex?.name || x?.name || ""), nextText, load ? h("span", { class: "rest-plates" }, load) : null),
      h("div", { class: "rest-btns" },
        h("button", { type: "button", class: "rest-btn", onclick: () => adjust(-15) }, "−15 s"),
        h("button", { type: "button", class: "rest-btn", onclick: () => adjust(15) }, "+15 s"),
        h("button", { type: "button", class: "rest-btn rest-skip", onclick: skip }, "Skip rest")))));
  updateRest(Date.now());
}

function updateRest(now) {
  const a = A();
  if (!a?.resting || !els.ringFill) return;
  const left = restLeft(a, now);
  const secs = Math.ceil(left / 1000);
  els.ringTime.textContent = clock(secs * 1000);
  els.ringFill.setAttribute("stroke-dashoffset", (RING_C * (1 - left / (a.resting.total * 1000))).toFixed(1));
  const warnAt = settings().countdown;
  els.dock.classList.toggle("warn", warnAt > 0 && secs <= warnAt);
  els.dock.classList.toggle("last", warnAt > 0 && secs <= Math.min(3, warnAt));
  if (warnAt > 0 && secs <= warnAt && secs > 0 && secs !== shownSecond) {
    shownSecond = secs;
    flash(String(secs), "count");
  }
}

function flash(text, kind) {
  if (!els.flash) return;
  els.flash.className = `go-flash ${kind}`;
  els.flash.textContent = text;
  void els.flash.offsetWidth;            // restart the animation
  els.flash.classList.add("show");
}

// ---------------------------------------------------------------------------
// Doing things
// ---------------------------------------------------------------------------
function doneCurrent() {
  const cur = current(A());
  if (cur) logSet(cur.e, cur.s);
}

function logSet(e, i) {
  const a = A();
  const x = a.exercises[e], st = x.sets[i];
  const kind = exerciseMap(store.data).get(x.ex)?.kind || x.kind;
  if (kind === "time" ? !st.s : !st.r) {
    toast(kind === "time" ? "Set the time first" : "Set the reps first");
    return;
  }
  unlock();
  haptic();
  const rest = completeSet(a, e, i, Date.now());
  save();
  shownSecond = null;
  if (rest && settings().sound) scheduleCountdown(a.resting.until, settings().countdown); else cancelCountdown();
  render();
  const next = current(a);
  const g = supersets(a.exercises)[e];
  const partner = g && next && next.e >= g.start && next.e <= g.end;
  if (next && next.e !== e) els.list.querySelector(`.ex-card[data-e="${next.e}"]`)?.scrollIntoView({ block: partner ? "nearest" : "start", behavior: "smooth" });
}

function toggleDone(e, i) {
  const a = A();
  if (a.exercises[e].sets[i].done) { uncompleteSet(a, e, i); save(); render(); return; }
  logSet(e, i);
}

function focusSet(e, i) {
  const a = A();
  if (a.exercises[e].sets[i].done) return;
  a.focus = { e, s: i };
  save();
  render();
}

function copyPrev(e, i) {
  const a = A(), x = a.exercises[e], wi = workIndex(x, i), p = wi === null ? null : x.prev[wi];
  if (!p || x.sets[i].done) return;
  Object.assign(x.sets[i], { w: p.w ?? null, r: p.r ?? null, s: p.s ?? null });
  save();
  render();
  toast("Last time's set copied");
}

function adjust(secs) {
  const a = A();
  addRest(a, secs, Date.now());
  save();
  shownSecond = null;
  if (settings().sound) scheduleCountdown(a.resting.until, settings().countdown);
  updateRest(Date.now());
}

function skip() {
  skipRest(A());
  save();
  cancelCountdown();
  render();
}

async function changeRest() {
  const a = A();
  const v = await chooseRest(a.rest, { title: `Rest between sets${a.workout ? ` (also saved to ${a.name})` : ""}` });
  if (v === null) return;
  a.rest = v;
  save();
  const w = store.data.workouts.find((x) => x.id === a.workout);
  if (w && w.rest !== v) store.saveWorkout({ ...w, rest: v });
  render();
  toast(`Rest ${fmtRest(v)}`);
}

async function exerciseMenu(e) {
  saveNotes();
  const a = A(), x = a.exercises[e];
  const ex = exerciseMap(store.data).get(x.ex);
  const name = ex?.name || x.name;
  const kind = ex?.kind || x.kind;
  const g = supersets(a.exercises)[e];
  const nextX = a.exercises[e + 1];
  const linkedNext = g && e < g.end;
  const v = await actionSheet({
    title: name,
    actions: [
      TIPS[x.ex] ? { text: "How to do it", value: "tip" } : null,
      { text: "Watch how (video)", value: "video" },
      { text: "Swap for another exercise", value: "swap" },
      { text: "Add a set", value: "add" },
      kind === "weight" && !x.sets.some((st) => st.warm) ? { text: "Add warm-up sets", value: "warm" } : null,
      x.sets.some((st) => st.warm && !st.done) ? { text: "Remove warm-up sets", value: "nowarm" } : null,
      nextX && !linkedNext ? { text: `Superset with ${exerciseMap(store.data).get(nextX.ex)?.name || nextX.name}`, value: "link" } : null,
      g ? { text: `Take out of superset ${g.label}`, value: "unlink" } : null,
      { text: `Rest for this exercise${x.rest !== null && x.rest !== undefined ? `: ${fmtRest(x.rest)}` : ""}`, value: "rest" },
      e > 0 ? { text: "Move up", value: "up" } : null,
      e < a.exercises.length - 1 ? { text: "Move down", value: "down" } : null,
      { text: "Remove from this workout", value: "remove", style: "destructive" },
    ].filter(Boolean),
  });
  if (v === "tip") {
    const w = await alertBox({ title: name, message: TIPS[x.ex], buttons: [{ text: "Watch a video", value: "video" }, { text: "OK", value: true, style: "bold" }] });
    if (w === "video") openVideo(name);
    return;
  }
  if (v === "video") { openVideo(name); return; }
  if (v === "swap") { openSwap(e); return; }
  if (v === "warm") {
    if (!addWarmups(a, store.data, e)) {
      toast(x.sets.find((st) => !st.done)?.w ? "Light enough to start without warm-ups" : "Type the weight of your first set first: the warm-ups come from it");
      return;
    }
  } else if (v === "nowarm") removeWarmups(a, e);
  else if (v === "link") {
    linkNext(a.exercises, e, true);
    retargetRest(a);
    toast("Superset: one set of each in turn, then rest");
  } else if (v === "unlink") {
    unlink(a.exercises, e);
    retargetRest(a);
  } else if (v === "add") addSet(a, e);
  else if (v === "up" || v === "down") moveExercise(a, e, v === "up" ? -1 : 1);
  else if (v === "rest") {
    const r = await chooseRest(x.rest ?? a.rest, { title: `Rest after each set of ${ex?.name || "this exercise"}`,
      extra: { text: `Same as the workout (${fmtRest(a.rest)})`, value: "same", checked: x.rest === null || x.rest === undefined } });
    if (r === null) return;
    x.rest = r === "same" ? null : r;
  } else if (v === "remove") {
    if (x.sets.some((st) => st.done)) {
      const ok = await alertBox({ title: `Remove ${ex?.name || "this exercise"}?`, message: "Its sets that are done are removed too.", buttons: [NO, { text: "Remove", value: true, style: "destructive" }] });
      if (!ok) return;
    }
    removeExercise(a, e);
  } else return;
  save();
  render();
}

/** Another exercise instead of this one (the machine is taken): similar ones first */
function openSwap(e) {
  const a = A(), x = a.exercises[e];
  if (!x) return;
  const name = exerciseMap(store.data).get(x.ex)?.name || x.name;
  const done = x.sets.some((st) => st.done);
  openSwapPicker({ exId: x.ex, exclude: a.exercises.map((b) => b.ex), dark: true,
    intro: `The sets still to do go to the one you pick${done ? `; the sets done stay with ${name}` : ""}. Only for today: your plan stays the same.`,
    onPick: (id) => {
      if (!A()) return;
      const at = swapExercise(A(), store.data, e, id, Date.now());
      save();
      render();
      toast(`${exerciseMap(store.data).get(id)?.name || "Swapped"} instead, for today`);
      els.list.querySelector(`.ex-card[data-e="${at}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    } });
}

function addExercises() {
  const a = A();
  openExercisePicker({ title: "Add exercises", multi: true, dark: true, exclude: a.exercises.map((x) => x.ex), onDone: (ids) => {
    if (!A() || !ids.length) return;
    for (const id of ids) addExercise(A(), store.data, id, Date.now());
    save();
    render();
  } });
}

async function discard(skipAsk = false) {
  if (!skipAsk) {
    const ok = await alertBox({ title: "Discard this workout?",
      message: notesChanged(A()) ? "Its sets aren't saved. The notes you wrote stay with the exercises." : "Nothing from it is saved.",
      buttons: [NO, { text: "Discard", value: true, style: "destructive" }] });
    if (!ok) return;
  }
  saveNotes();
  store.saveActive(null);
  closeLive();
  store.emit();
}

async function finish() {
  const a = A();
  const { done, total } = counts(a);
  if (!done) {
    const v = await alertBox({ title: "Nothing logged yet", message: "Tick off at least one set, or discard this workout.",
      buttons: [{ text: "Keep going", value: false, style: "bold" }, { text: "Discard workout", value: true, style: "destructive" }] });
    if (v) discard(true);
    return;
  }
  const ok = await alertBox({ title: "Finish the workout?",
    message: done < total ? `${plural(total - done, "set")} not ticked off ${total - done === 1 ? "isn't" : "aren't"} saved.` : `${plural(done, "set")} in ${clock(Date.now() - a.start)}.`,
    buttons: [{ text: "Keep going", value: false, style: "cancel" }, { text: "Finish", value: true, style: "bold" }] });
  if (!ok || !A()) return;
  let end = Date.now();
  const lastAt = lastDoneAt(a);
  if (lastAt && end - lastAt > 20 * 60000) {
    const at = lastAt + 2 * 60000;
    const v = await alertBox({ title: "When did you finish?", message: `Your last set was at ${timeOfDay(lastAt)}.`,
      buttons: [{ text: `At ${timeOfDay(at)}`, value: "then", style: "bold" }, { text: `Now (${timeOfDay(end)})`, value: "now" }] });
    if (v === "then") end = at;
  }
  saveNotes();
  const session = toSession(a, store.data, end);
  store.saveSession(session);
  store.saveActive(null);
  closeLive();
  if (settings().sound) playFinish();
  showSummary(store.data.sessions.find((x) => x.id === session.id) || session, { fresh: true });
  store.emit();
}
