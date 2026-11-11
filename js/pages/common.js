// Pieces several pages share: a workout's tile, a logged workout's card, sets as text, choosers.

import { h, icon, tile, initials, actionSheet, chip } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { relDay, fmtDuration, fmtVolume, sessionStats, setShort, timeUnit, plural, recordCounts, fmtRest, workoutSets } from "../core.js";

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
export async function chooseWorkout(title = "Start a workout") {
  const data = store.data;
  const v = await actionSheet({
    title,
    actions: [...data.workouts.map((w) => ({ text: w.name, value: w.id, color: w.color })),
      { text: "Empty workout", value: "empty", detail: "Add exercises as you go" }],
  });
  if (v === null) return null;
  return v === "empty" ? "empty" : data.workouts.find((w) => w.id === v) || null;
}

export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

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
