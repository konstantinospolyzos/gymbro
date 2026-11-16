// Pieces several pages share: a workout's tile, a logged workout's card, sets as text, choosers.

import { h, icon, tile, initials, actionSheet, alertBox, chip } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { relDay, fmtDuration, fmtVolume, sessionStats, setShort, timeUnit, plural, recordCounts, fmtRest, workoutSets, fmtNum } from "../core.js";

export const NO = { text: "Cancel", value: false, style: "cancel" };

export const workoutTile = (w, size = 44) => tile(w?.color || "blue", initials(w?.name || "W"), size);

/** The name an exercise shows (the library's, or the one saved with an old workout) */
export function exName(data, entry) {
  return exerciseMap(data).get(entry.ex)?.name || entry.name || "Exercise";
}

/** A logged exercise's sets on one line: 60×10 · 60×10 · 57.5×8 */
export function setsLine(data, entry) {
  const unit = timeUnit(exerciseMap(data).get(entry.ex) || entry);
  return entry.sets.map((s) => setShort(s, entry.kind, unit)).join(" · ");
}

/** A note written on an exercise, as it shows in a summary and in History */
export const noteText = (text) => h("div", { class: "note-text" }, icon("edit", 13), h("span", null, text));

/** A logged workout as a card: name, day, time, volume, sets, records */
export function sessionCard(data, session, onClick) {
  const st = sessionStats(session);
  const prs = recordCounts(data).get(session.id) || 0;
  return h("button", { type: "button", class: "card sess-card", onclick: onClick },
    h("span", { class: `sess-bar c-${session.color}` }),
    h("span", { class: "sess-text" },
      h("span", { class: "sess-top" }, h("span", { class: "sess-name" }, session.name),
        prs ? chip(`${prs} PR${prs > 1 ? "s" : ""}`, "gold", "small") : null,
        h("span", { class: "sess-date" }, relDay(session.date))),
      h("span", { class: "sess-stats" },
        h("span", null, icon("timer", 14), fmtDuration(session.dur)),
        st.volume ? h("span", null, icon("dumbbell", 14), fmtVolume(st.volume)) : null,
        h("span", null, icon("list", 14), plural(st.sets, "set")))),
    icon("chevron", 15, "chev"));
}

/** "4 exercises · 15 sets · rest 1:30" */
export function workoutLine(w) {
  return [plural(w.items.length, "exercise"), plural(workoutSets(w), "set"), `rest ${fmtRest(w.rest)}`].join(" · ");
}

/** Which workout to start: your plan's workouts, or an empty one. Resolves to a workout, "empty" or null. */
export async function chooseWorkout(title = "Start a workout", { recommended = false } = {}) {
  const data = store.data;
  const v = await actionSheet({
    title,
    actions: [...data.workouts.map((w) => ({ text: w.name, value: w.id, color: w.color })),
      recommended ? { text: "Recommended for a muscle group", value: "recommended", detail: "Back, chest, legs… with the best exercises for it" } : null,
      { text: "Empty workout", value: "empty", detail: "Add exercises as you go" }].filter(Boolean),
  });
  if (v === null) return null;
  return v === "empty" || v === "recommended" ? v : data.workouts.find((w) => w.id === v) || null;
}

export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/** The rest a workout's exercises get (each its own, else the workout's): "2 min", or "1:15–2:30" when they differ */
export function restLabel(rests, fallback) {
  const v = [...new Set(rests.length ? rests : [fallback])].sort((a, b) => a - b);
  if (v.length < 2) return fmtRest(v[0]);
  const [lo, hi] = [v[0], v.at(-1)];
  return lo >= 60 && lo % 60 === 0 && hi % 60 === 0 ? `${lo / 60}–${hi / 60}\u00a0min` : `${fmtRest(lo)}–${fmtRest(hi)}`;
}

/**
 * A new rest for a whole workout. Exercises with a rest of their own (own: [{name, rest}]) would keep it, so
 * when some differ: for every exercise, or only for the others? "all" | "keep" | false (cancelled)
 */
export async function restForAll(v, own) {
  const differ = own.filter((o) => o.rest !== v);
  if (!differ.length) return "keep";
  const names = differ.slice(0, 3).map((o) => `${o.name} ${fmtRest(o.rest)}`).join(", ") + (differ.length > 3 ? ` and ${differ.length - 3} more` : "");
  return alertBox({ title: `${fmtRest(v)} for every exercise?`, message: `Some have a rest of their own: ${names}.`,
    buttons: [{ text: "Every exercise", value: "all", style: "bold" }, { text: "Keep their own rests", value: "keep" }, { text: "Cancel", value: false, style: "cancel" }] });
}

/** Pick a rest time; resolves to seconds or null */
export async function chooseRest(current, { title = "Rest between sets", extra = null } = {}) {
  const actions = REST_CHOICES.map((sec) => ({ text: fmtRest(sec), value: sec, checked: sec === current }));
  if (extra) actions.unshift(extra);
  return actionSheet({ title, actions });
}

export function emptyState(iconName, title, text, ...buttons) {
  return h("div", { class: "card empty-state" }, icon(iconName, 40, "empty-icon"), h("div", { class: "empty-title" }, title),
    h("div", { class: "empty-text" }, text), ...buttons);
}

/** Each muscle's sets a week against the 10–20 that builds muscle (under or over it in orange) */
export function volumeBars(rows) {
  const max = 24, at = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const n = (v) => fmtNum(v, v % 1 ? 1 : 0);
  return h("div", { class: "mv-rows week-vol", role: "list" }, rows.map((r) => h("div", { class: `mv-row ${r.planned < 10 ? "low" : r.planned > 20 ? "high" : ""}`, role: "listitem",
    "aria-label": `${r.muscle}: ${n(r.planned)} sets a week` },
    h("span", { class: "mv-label" }, r.muscle),
    h("span", { class: "mv-track" }, h("span", { class: "mv-band", style: { left: at(10), width: `calc(${at(20)} - ${at(10)})` } }),
      h("span", { class: "mv-plan", style: { left: at(r.planned) } })),
    h("span", { class: "mv-value num" }, h("b", null, n(r.planned))))));
}
