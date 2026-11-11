// The workout in progress: its exercises and sets, which set is next, and the rest between sets.
// Every time is a moment (Date.now()), never a counted tick, so the clocks stay right when the phone
// sleeps, the screen locks or the app is closed and opened again.

import { uid, exerciseMap } from "./data.js";
import { lastFor, isoDay, warmupSets, barOf, supersets } from "./core.js";
import { COMPOUND } from "./library.js";

/** The rest after a warm-up set */
export const WARMUP_REST = 60;

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
    ...(item?.group ? { group: item.group } : {}),
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

/** A new workout from the plan (or an empty one when workout is null). The first heavy lift gets warm-up sets. */
export function startActive(data, workout, now = Date.now(), { rest } = {}) {
  const a = {
    id: uid("s"), workout: workout?.id ?? null, name: workout?.name || "Workout", color: workout?.color || "blue",
    rest: workout ? workout.rest : rest ?? data.settings.rest,
    start: now, date: isoDay(new Date(now)),
    exercises: workout ? workout.items.filter((it) => exerciseMap(data).has(it.ex)).map((it) => exerciseBlock(data, it.ex, it, now)) : [],
    resting: null, focus: null, version: 1,
  };
  if (data.settings.warmup !== false) {
    const e = a.exercises.findIndex((x) => COMPOUND.has(x.ex));
    if (e >= 0) addWarmups(a, data, e);
  }
  return a;
}

// ---------------------------------------------------------------------------
// Warm-up sets: first in an exercise, lighter, not saved with the workout
// ---------------------------------------------------------------------------
export const warmCount = (x) => x.sets.filter((st) => st.warm).length;

/** A set's number among the working sets (0 for the first), or null for a warm-up */
export const workIndex = (x, s) => (x.sets[s]?.warm ? null : s - x.sets.slice(0, s).filter((st) => st.warm).length);

/** Warm-up sets before an exercise's sets, from the weight of its first set. Returns how many. */
export function addWarmups(active, data, e) {
  const x = active.exercises[e];
  if (!x || x.sets.some((st) => st.warm)) return 0;
  const ex = exerciseMap(data).get(x.ex);
  if ((ex?.kind || x.kind) !== "weight") return 0;
  const list = warmupSets(x.sets.find((st) => !st.done)?.w, { step: ex?.step || 2.5, bar: barOf(ex) });
  if (!list.length) return 0;
  x.sets.unshift(...list.map(({ w, r }) => ({ w, r, s: null, orig: { w, r, s: null }, done: false, at: null, warm: true })));
  // the rest and a tapped set point at sets by number: they move down with them
  if (active.resting?.e === e) active.resting = { ...active.resting, s: active.resting.s + list.length };
  if (active.focus?.e === e) active.focus = { ...active.focus, s: active.focus.s + list.length };
  return list.length;
}

/** Take away the warm-up sets not done yet */
export function removeWarmups(active, e) {
  const x = active.exercises[e];
  if (!x) return;
  const gone = x.sets.map((st, i) => (st.warm && !st.done ? i : -1)).filter((i) => i >= 0);
  if (!gone.length) return;
  const moved = (s) => s - gone.filter((i) => i < s).length;
  const pointsAtGone = (p) => p && p.e === e && gone.includes(p.s);
  x.sets = x.sets.filter((st) => !(st.warm && !st.done));
  if (active.focus?.e === e) active.focus = pointsAtGone(active.focus) ? null : { ...active.focus, s: moved(active.focus.s) };
  if (active.resting?.e === e) {
    if (pointsAtGone(active.resting)) { const n = firstUndone(active); active.resting = n ? { ...active.resting, ...n } : null; }
    else active.resting = { ...active.resting, s: moved(active.resting.s) };
  }
}

// ---------------------------------------------------------------------------
// Swapping an exercise (the machine is taken)
// ---------------------------------------------------------------------------
/** Another exercise instead: the sets still to do go to it (with its own weights from last time), the ones
 *  done stay where they are. Rest, reps and superset carry over. Returns the new exercise's place. */
export function swapExercise(active, data, e, exId, now = Date.now()) {
  const x = active.exercises[e];
  if (!x) return -1;
  const ex = exerciseMap(data).get(exId);
  const kind = ex?.kind || "weight";
  const work = x.sets.filter((st) => !st.warm);
  const t = x.target || {};
  const item = { sets: Math.max(1, work.filter((st) => !st.done).length), reps: kind === "time" ? null : t.reps ?? 10,
    hi: kind === "time" ? null : t.hi ?? null, w: null, secs: kind === "time" ? (ex?.muscle === "Cardio" ? 1200 : 60) : null,
    rest: x.rest ?? null, group: x.group ?? null };
  const block = exerciseBlock(data, exId, item, now);
  const keep = x.sets.some((st) => st.done);
  if (keep) {
    x.sets = x.sets.filter((st) => st.done);
    delete x.group;
    active.exercises.splice(e + 1, 0, block);
  } else active.exercises[e] = block;
  const at = keep ? e + 1 : e;
  active.focus = null;
  if (active.resting) {
    const r = active.resting;
    if (r.e === e) active.resting = { ...r, e: at, s: 0 };
    else if (keep && r.e > e) active.resting = { ...r, e: r.e + 1 };
  }
  return at;
}

// ---------------------------------------------------------------------------
// Supersets in a workout
// ---------------------------------------------------------------------------
/** The order the sets are done in: an exercise's sets one after the other; in a superset, after any warm-ups,
 *  one set of each exercise in turn (A1 B1, A2 B2, …) */
export function sequence(active) {
  const list = active.exercises, ss = supersets(list), out = [];
  for (let e = 0; e < list.length; e++) {
    const g = ss[e];
    if (!g) { list[e].sets.forEach((_, s) => out.push({ e, s })); continue; }
    if (g.pos) continue;
    const members = Array.from({ length: g.size }, (_, k) => g.start + k);
    for (const m of members) list[m].sets.forEach((st, s) => { if (st.warm) out.push({ e: m, s }); });
    const work = members.map((m) => list[m].sets.map((st, s) => (st.warm ? -1 : s)).filter((s) => s >= 0));
    const rounds = Math.max(...work.map((w) => w.length));
    for (let r = 0; r < rounds; r++) members.forEach((m, k) => { if (work[k][r] !== undefined) out.push({ e: m, s: work[k][r] }); });
  }
  return out;
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

/** After the order changed (a superset made or undone): the rest counts down to the set that's now next */
export function retargetRest(active) {
  if (!active.resting) return;
  const n = firstUndone(active);
  active.resting = n ? { ...active.resting, ...n } : null;
}

function firstUndone(active) {
  for (const p of sequence(active)) if (!active.exercises[p.e].sets[p.s].done) return p;
  return null;
}

/** The next set to do after (e, s): the rest of this exercise first (in a superset: the next exercise's set),
 *  then the following ones, then anything skipped */
export function nextAfter(active, e, s) {
  const seq = sequence(active), list = active.exercises;
  const i = seq.findIndex((p) => p.e === e && p.s === s);
  for (let k = i + 1; k < seq.length; k++) if (!list[seq[k].e].sets[seq[k].s].done) return seq[k];
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
  // (a warm-up set changes nothing after it)
  for (const later of set.warm ? [] : active.exercises[e].sets.slice(s + 1)) {
    if (later.done || later.warm) continue;
    for (const k of ["w", "r", "s"]) {
      if (val(later, k) === null && val(set, k) !== null) later[k] = set[k];
      else if (k !== "r" && set.orig && later.orig && val(later, k) === val(later.orig, k) && val(later.orig, k) === val(set.orig, k)) later[k] = set[k];
      if (later.orig) later.orig[k] = later[k] ?? null;
    }
  }
  const next = nextAfter(active, e, s);
  const rest = next ? restAfter(active, e, s, next) : 0;
  active.resting = next && rest > 0 ? { until: now + rest * 1000, total: rest, e: next.e, s: next.s, from: now } : null;
  return active.resting ? rest : 0;
}

/** The rest after a set: short after a warm-up; none between the exercises of a superset (only after each
 *  round, the longest rest of its exercises); else the exercise's own rest, or the workout's */
function restAfter(active, e, s, next) {
  const list = active.exercises;
  if (list[e].sets[s].warm) return WARMUP_REST;
  const g = supersets(list)[e];
  if (!g) return restFor(active, e);
  const inRound = next.e > e && next.e <= g.end && !list[next.e].sets[next.s].warm
    && workIndex(list[next.e], next.s) === workIndex(list[e], s);
  if (inRound) return 0;
  return Math.max(...Array.from({ length: g.size }, (_, k) => restFor(active, g.start + k)));
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

/** Sets done and to do (warm-ups don't count) */
export function counts(active) {
  let done = 0, total = 0;
  for (const x of active.exercises) for (const s of x.sets) { if (s.warm) continue; total += 1; if (s.done) done += 1; }
  return { done, total };
}

export function lastDoneAt(active) {
  let t = 0;
  for (const x of active.exercises) for (const s of x.sets) if (s.done && s.at > t) t = s.at;
  return t || null;
}

// ---------------------------------------------------------------------------
// Notes: each exercise has its own (seat height, grip, what to try next), shown and changed in every workout
// ---------------------------------------------------------------------------
/** The exercise's notes as they show in this workout: what you typed here, else the exercise's own */
export function noteFor(active, data, e) {
  const x = active.exercises[e];
  if (!x) return "";
  return x.note ?? exerciseMap(data).get(x.ex)?.notes ?? "";
}

/** Typing in an exercise's notes (note0 keeps what they said before, to know what changed today) */
export function setNote(active, data, e, text) {
  const x = active.exercises[e];
  if (!x) return;
  if (x.note === undefined) x.note0 = exerciseMap(data).get(x.ex)?.notes || "";
  x.note = String(text).slice(0, 500);
}

const changedToday = (x) => x.note !== undefined && x.note.trim() !== (x.note0 || "").trim();

/** True when a note was changed in this workout */
export const notesChanged = (active) => active.exercises.some(changedToday);

/** The notes typed in this workout that the exercises don't have yet: [{ ex, notes }] */
export function notesToSave(active, data) {
  const exMap = exerciseMap(data), out = new Map();
  for (const x of active.exercises) {
    if (x.note === undefined || !exMap.has(x.ex)) continue;
    const t = x.note.trim();
    if (t !== (exMap.get(x.ex).notes || "").trim()) out.set(x.ex, t);
  }
  return [...out].map(([ex, notes]) => ({ ex, notes }));
}

const cleanSet = (kind, { w, r, s }) => (kind === "time" ? { s: s ?? 0 } : kind === "reps" ? { w: w || null, r: r ?? 0 } : { w: w ?? 0, r: r ?? 0 });

/** The finished workout as a logged session (only the sets that were done), or null if nothing was done.
 *  A note written or changed today goes with it, so History shows what you noted that day. */
export function toSession(active, data, end = Date.now()) {
  const exMap = exerciseMap(data);
  const exercises = active.exercises.map((x) => {
    const ex = exMap.get(x.ex);
    const kind = ex?.kind || x.kind;
    const sets = x.sets.filter((s) => s.done && !s.warm).map((s) => cleanSet(kind, s));
    const note = changedToday(x) ? x.note.trim() : "";
    return sets.length ? { ex: x.ex, name: ex?.name || x.name, kind, muscle: ex?.muscle || "Other", sets, ...(note ? { note } : {}) } : null;
  }).filter(Boolean);
  if (!exercises.length) return null;
  return {
    id: active.id, date: active.date, start: active.start, end,
    dur: Math.max(60, Math.round((end - active.start) / 1000)),
    workout: active.workout, name: active.name, color: active.color, exercises,
  };
}
