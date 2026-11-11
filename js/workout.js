// The workout in progress: its exercises and sets, which set is next, and the rest between sets.
// Every time is a moment (Date.now()), never a counted tick, so the clocks stay right when the phone
// sleeps, the screen locks or the app is closed and opened again.

import { uid, exerciseMap } from "./data.js";
import { lastFor, isoDay } from "./core.js";

/** What goes in a new set: the same set last time, else the plan's target */
export function prefill(data, exId, i, item = null, before = Infinity) {
  const last = lastFor(data, exId, before);
  const src = last ? last.entry.sets[i] || last.entry.sets.at(-1) : null;
  if (src) return { w: src.w ?? null, r: src.r ?? null, s: src.s ?? null };
  return { w: item?.w ?? null, r: item?.reps ?? null, s: item?.secs ?? null };
}

function exerciseBlock(data, exId, item, now) {
  const ex = exerciseMap(data).get(exId);
  const last = lastFor(data, exId, now);
  const n = item ? item.sets : Math.max(last ? last.entry.sets.length : 3, 1);
  // never done and not in the plan: start from a usual set
  if (!item && !last) item = { sets: n, reps: ex?.kind === "time" ? null : 10, w: null, secs: ex?.kind === "time" ? (ex.muscle === "Cardio" ? 1200 : 60) : null };
  // reps as a range (8–12): when every set reached the top last time, add weight and start again from the bottom
  const up = item?.hi && (ex?.kind || "weight") === "weight" && last && last.entry.sets.length
    && last.entry.sets.every((s) => (s.r || 0) >= item.hi && (s.w || 0) > 0) ? (ex?.step || 2.5) : null;
  return {
    key: uid("b"), ex: exId, kind: ex?.kind || "weight", name: ex?.name || "Exercise",
    rest: item?.rest ?? null,
    target: item ? { sets: item.sets, reps: item.reps, hi: item.hi ?? null, w: item.w, secs: item.secs } : null,
    up: up ? { kg: up, reps: item.hi } : null,
    prev: last ? last.entry.sets.map((s) => ({ ...s })) : [],
    prevDate: last ? last.session.date : null,
    sets: Array.from({ length: n }, (_, i) => {
      let v = prefill(data, exId, i, item, now);
      if (up && v.w) v = { ...v, w: Math.round((v.w + up) * 100) / 100, r: item.reps };
      return { ...v, orig: { ...v }, done: false, at: null };
    }),
  };
}

/** A new workout from the plan (or an empty one when workout is null) */
export function startActive(data, workout, now = Date.now(), { rest } = {}) {
  return {
    id: uid("s"), workout: workout?.id ?? null, name: workout?.name || "Workout", color: workout?.color || "blue",
    rest: workout ? workout.rest : rest ?? data.settings.rest,
    start: now, date: isoDay(new Date(now)),
    exercises: workout ? workout.items.filter((it) => exerciseMap(data).has(it.ex)).map((it) => exerciseBlock(data, it.ex, it, now)) : [],
    resting: null, focus: null, version: 1,
  };
}

export function addExercise(active, data, exId, now = Date.now()) {
  active.exercises.push(exerciseBlock(data, exId, null, now));
  return active.exercises.length - 1;
}

export function removeExercise(active, e) {
  active.exercises.splice(e, 1);
  if (active.resting && active.resting.e >= e) active.resting = active.resting.e === e ? null : { ...active.resting, e: active.resting.e - 1 };
  active.focus = null;
}

export function moveExercise(active, e, by) {
  const j = e + by;
  if (j < 0 || j >= active.exercises.length) return;
  const [b] = active.exercises.splice(e, 1);
  active.exercises.splice(j, 0, b);
  active.focus = null;
  if (active.resting) active.resting = { ...active.resting, ...(firstUndone(active) || {}) };
}

/** A new set copies the last one */
export function addSet(active, e) {
  const sets = active.exercises[e].sets;
  const last = sets.at(-1);
  const v = { w: last?.w ?? null, r: last?.r ?? null, s: last?.s ?? null };
  sets.push({ ...v, orig: { ...v }, done: false, at: null });
  return sets.length - 1;
}

export function removeSet(active, e, s) {
  const sets = active.exercises[e].sets;
  sets.splice(s, 1);
  if (active.focus && active.focus.e === e) active.focus = null;
  if (active.resting && active.resting.e === e && active.resting.s >= s) {
    const next = firstUndone(active);
    active.resting = next ? { ...active.resting, ...next } : null;
  }
}

function firstUndone(active) {
  for (let e = 0; e < active.exercises.length; e++) {
    const s = active.exercises[e].sets.findIndex((x) => !x.done);
    if (s >= 0) return { e, s };
  }
  return null;
}

/** The next set to do after (e, s): the rest of this exercise first, then the following ones, then anything skipped */
export function nextAfter(active, e, s) {
  const list = active.exercises;
  for (let i = e; i < list.length; i++) {
    const from = i === e ? s + 1 : 0;
    for (let j = from; j < list[i].sets.length; j++) if (!list[i].sets[j].done) return { e: i, s: j };
  }
  return firstUndone(active);
}

/** The set the big button logs: the one you tapped, else the next one not done */
export function current(active) {
  const f = active.focus;
  if (f && active.exercises[f.e]?.sets[f.s] && !active.exercises[f.e].sets[f.s].done) return f;
  if (active.resting) {
    const r = active.resting;
    if (active.exercises[r.e]?.sets[r.s] && !active.exercises[r.e].sets[r.s].done) return { e: r.e, s: r.s };
  }
  return firstUndone(active);
}

export const restFor = (active, e) => active.exercises[e]?.rest ?? active.rest;

/** Log a set. The rest starts if there's another set to do; returns the rest in seconds (0: none). */
export function completeSet(active, e, s, now = Date.now()) {
  const set = active.exercises[e]?.sets[s];
  if (!set) return 0;
  set.done = true;
  set.at = now;
  active.focus = null;
  // The sets after it follow: empty values start from this set, and a weight (or time) you changed carries on to
  // the sets that had the same one and that you haven't touched (straight sets; a pyramid keeps its own).
  const val = (x, k) => x?.[k] ?? null;
  for (const later of active.exercises[e].sets.slice(s + 1)) {
    if (later.done) continue;
    for (const k of ["w", "r", "s"]) {
      if (val(later, k) === null && val(set, k) !== null) later[k] = set[k];
      else if (k !== "r" && set.orig && later.orig && val(later, k) === val(later.orig, k) && val(later.orig, k) === val(set.orig, k)) later[k] = set[k];
      if (later.orig) later.orig[k] = later[k] ?? null;
    }
  }
  const next = nextAfter(active, e, s);
  const rest = next ? restFor(active, e) : 0;
  active.resting = next && rest > 0 ? { until: now + rest * 1000, total: rest, e: next.e, s: next.s, from: now } : null;
  return active.resting ? rest : 0;
}

export function uncompleteSet(active, e, s) {
  const set = active.exercises[e]?.sets[s];
  if (!set) return;
  set.done = false;
  set.at = null;
}

export function addRest(active, secs, now = Date.now()) {
  const r = active.resting;
  if (!r) return;
  const until = Math.max(now + 1000, r.until + secs * 1000);
  active.resting = { ...r, until, total: Math.max(1, Math.round((until - r.from) / 1000)) };
}

export function skipRest(active) { active.resting = null; }

export const restLeft = (active, now = Date.now()) => (active.resting ? Math.max(0, active.resting.until - now) : 0);

/** Call often: ends the rest when its time is up. Returns true when it just ended. */
export function tick(active, now = Date.now()) {
  if (active.resting && now >= active.resting.until) { active.resting = null; return true; }
  return false;
}

export function counts(active) {
  let done = 0, total = 0;
  for (const x of active.exercises) for (const s of x.sets) { total += 1; if (s.done) done += 1; }
  return { done, total };
}

export function lastDoneAt(active) {
  let t = 0;
  for (const x of active.exercises) for (const s of x.sets) if (s.done && s.at > t) t = s.at;
  return t || null;
}

const cleanSet = (kind, { w, r, s }) => (kind === "time" ? { s: s ?? 0 } : kind === "reps" ? { w: w || null, r: r ?? 0 } : { w: w ?? 0, r: r ?? 0 });

/** The finished workout as a logged session (only the sets that were done), or null if nothing was done */
export function toSession(active, data, end = Date.now()) {
  const exMap = exerciseMap(data);
  const exercises = active.exercises.map((x) => {
    const ex = exMap.get(x.ex);
    const kind = ex?.kind || x.kind;
    const sets = x.sets.filter((s) => s.done).map((s) => cleanSet(kind, s));
    return sets.length ? { ex: x.ex, name: ex?.name || x.name, kind, muscle: ex?.muscle || "Other", sets } : null;
  }).filter(Boolean);
  if (!exercises.length) return null;
  return {
    id: active.id, date: active.date, start: active.start, end,
    dur: Math.max(60, Math.round((end - active.start) / 1000)),
    workout: active.workout, name: active.name, color: active.color, exercises,
  };
}
