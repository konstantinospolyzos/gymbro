// Formatting and the numbers behind the progress: estimated one-rep max, records, comparisons with
// earlier workouts, weekly totals and streaks. No page code here, so it can be tested on its own.

import { exerciseMap, bySessionStart } from "./data.js";

export const APP_VERSION = "1.1";

// ---------------------------------------------------------------------------
// Dates (local time; a workout's "date" is the day it started)
// ---------------------------------------------------------------------------
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Monday first */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const p2 = (n) => String(n).padStart(2, "0");
export const isoDay = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const startOfWeek = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
export const daysBetween = (a, b) => Math.round((parseDay(isoDay(b)) - parseDay(isoDay(a))) / 86400000);

export const shortDate = (d) => `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
export const longDate = (d) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const monthTitle = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const timeOfDay = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

/** "Today", "Yesterday", "Monday" (this week), "Mon 3 Nov", "Mon 3 Nov 2025" */
export function relDay(iso, now = today()) {
  const d = parseDay(iso);
  const n = daysBetween(d, now);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()];
  return d.getFullYear() === now.getFullYear() ? shortDate(d) : `${shortDate(d)} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Numbers and times
// ---------------------------------------------------------------------------
export const NBSP = " ";
export const MINUS = "−";

/** 12 340 (spaces between thousands, like the Savings Tracker) */
export function fmtNum(v, d = 0) {
  const t = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, NBSP);
  return (v < 0 && Math.abs(v) >= 0.5 * 10 ** -d ? MINUS : "") + t;
}

/** 62.5, 60, 1.25: kilos as typed, without trailing zeros */
export function fmtKg(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? fmtNum(r) : String(r);
}
export const kg = (v) => `${fmtKg(v)}${NBSP}kg`;
export const fmtVolume = (v) => `${fmtNum(Math.round(v))}${NBSP}kg`;
export const fmtAxisKg = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

/** Accepts "62,5", "62.5", " 60 kg", "1:30" (minutes:seconds when allowed) */
export function parseNum(text) {
  let t = String(text ?? "").trim().replace(/kg|reps?|s$|sec|min/gi, "").replace(/\s+/g, "").replace(",", ".").replace(/−/g, "-");
  if (!t) return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** "1:30" or "90" (seconds) -> 90 */
export function parseSecs(text) {
  const t = String(text ?? "").trim();
  const m = t.match(/^(\d+)[:.,](\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const v = parseNum(t);
  return v === null ? null : Math.round(v);
}

export const plural = (n, one, many = `${one}s`) => `${fmtNum(n)} ${n === 1 ? one : many}`;

/** The workout clock: 4:05, 24:17, 1:02:45 */
export function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
}

/** A rest: 45 s, 1:30, 2 min */
export function fmtRest(secs) {
  if (!secs) return "No rest";
  if (secs < 60) return `${secs}${NBSP}s`;
  return secs % 60 ? `${Math.floor(secs / 60)}:${p2(secs % 60)}` : `${secs / 60}${NBSP}min`;
}

/** A workout's length: 52 min, 1 h 05 min, 40 s */
export function fmtDuration(secs) {
  if (secs < 60) return `${Math.round(secs)}${NBSP}s`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}${NBSP}min`;
  return `${Math.floor(m / 60)}${NBSP}h ${p2(m % 60)}${NBSP}min`;
}

/** A held set (plank 1:30) or cardio (20 min) */
export function fmtSecs(secs, unit = "sec") {
  if (secs === null || secs === undefined) return "";
  if (unit === "min") { const m = secs / 60; return `${Number.isInteger(m) ? m : m.toFixed(1)}${NBSP}min`; }
  return secs >= 60 ? `${Math.floor(secs / 60)}:${p2(secs % 60)}` : `${secs}${NBSP}s`;
}

/** Time exercises are logged in minutes for cardio, seconds otherwise */
export const timeUnit = (ex) => (ex?.muscle === "Cardio" ? "min" : "sec");

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------
/** Estimated one-rep max (Epley): the weight you could lift once, from a set of several reps */
export function e1rm(w, r) {
  if (!w || !r || r < 1) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + Math.min(r, 30) / 30) * 10) / 10;
}

/** One set as text: 60 kg × 10 · 12 reps · +10 kg × 8 · 1:30 · 20 min */
export function setText(set, kind, unit = "sec") {
  if (kind === "time") return fmtSecs(set.s ?? 0, unit);
  if (kind === "reps") return set.w ? `+${kg(set.w)} × ${set.r ?? 0}` : `${plural(set.r ?? 0, "rep")}`;
  return `${set.w ? kg(set.w) : `0${NBSP}kg`} × ${set.r ?? 0}`;
}

/** Short: 60×10 · 12 · +10×8 · 1:30 */
export function setShort(set, kind, unit = "sec") {
  if (kind === "time") return fmtSecs(set.s ?? 0, unit);
  if (kind === "reps") return set.w ? `+${fmtKg(set.w)}×${set.r ?? 0}` : String(set.r ?? 0);
  return `${fmtKg(set.w || 0)}×${set.r ?? 0}`;
}

/** Everything about one exercise's sets in one workout */
export function exStats(sets, kind) {
  const st = { count: sets.length, reps: 0, volume: 0, maxW: 0, e1rm: 0, top: null, maxReps: 0, maxSecs: 0, secs: 0 };
  for (const s of sets) {
    const w = s.w || 0, r = s.r || 0;
    st.reps += r;
    st.secs += s.s || 0;
    st.maxSecs = Math.max(st.maxSecs, s.s || 0);
    st.maxReps = Math.max(st.maxReps, r);
    if (kind !== "time") st.volume += w * r;
    if (w > st.maxW) st.maxW = w;
    const est = kind === "weight" ? e1rm(w, r) : 0;
    if (kind === "weight") { if (est > st.e1rm || (est === st.e1rm && !st.top)) { st.e1rm = est; st.top = s; } }
    else if (kind === "reps") { if (!st.top || r * (1 + w / 100) > (st.top.r || 0) * (1 + (st.top.w || 0) / 100)) st.top = s; }
    else if (!st.top || (s.s || 0) > (st.top.s || 0)) st.top = s;
  }
  st.volume = Math.round(st.volume * 10) / 10;
  return st;
}

/** The one number that says "better" for an exercise: e1RM, best reps, longest hold */
export function score(st, kind) {
  if (!st) return 0;
  if (kind === "weight") return st.e1rm || st.maxW;
  if (kind === "reps") return st.top ? (st.top.r || 0) + (st.top.w || 0) / 2.5 : 0;
  return st.maxSecs;
}

export function sessionStats(session) {
  let sets = 0, reps = 0, volume = 0;
  for (const e of session.exercises) {
    sets += e.sets.length;
    for (const s of e.sets) { reps += s.r || 0; if (e.kind !== "time") volume += (s.w || 0) * (s.r || 0); }
  }
  return { sets, reps, volume: Math.round(volume), exercises: session.exercises.length, dur: session.dur };
}

// ---------------------------------------------------------------------------
// History per exercise, and records
// ---------------------------------------------------------------------------
const histCache = new WeakMap();
/** exercise id -> [{session, entry, stats}] in date order */
export function historyIndex(data) {
  let idx = histCache.get(data);
  if (idx) return idx;
  idx = new Map();
  for (const s of data.sessions) for (const e of s.exercises) {
    if (!idx.has(e.ex)) idx.set(e.ex, []);
    idx.get(e.ex).push({ session: s, entry: e, stats: exStats(e.sets, e.kind) });
  }
  histCache.set(data, idx);
  return idx;
}

export const exerciseHistory = (data, exId) => historyIndex(data).get(exId) || [];

/** The last time an exercise was done before a moment (a session start) */
export function lastFor(data, exId, before = Infinity, skipId = null) {
  const list = exerciseHistory(data, exId);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].session.start < before && list[i].session.id !== skipId) return list[i];
  return null;
}

/** Bests before a moment: heaviest, e1RM, most reps in a set, longest, most volume in a workout */
export function bestsBefore(data, exId, before, skipId = null) {
  const b = { maxW: 0, e1rm: 0, maxReps: 0, maxSecs: 0, volume: 0, score: 0, count: 0 };
  for (const h of exerciseHistory(data, exId)) {
    if (h.session.start >= before || h.session.id === skipId) continue;
    const st = h.stats;
    b.count += 1;
    b.maxW = Math.max(b.maxW, st.maxW);
    b.e1rm = Math.max(b.e1rm, st.e1rm);
    b.maxReps = Math.max(b.maxReps, st.maxReps);
    b.maxSecs = Math.max(b.maxSecs, st.maxSecs);
    b.volume = Math.max(b.volume, st.volume);
    b.score = Math.max(b.score, score(st, h.entry.kind));
  }
  return b;
}

/** New records an exercise set in a workout, compared with everything before it */
export function recordsIn(data, session, entry) {
  const prev = bestsBefore(data, entry.ex, session.start, session.id);
  if (!prev.count) return [];
  const st = exStats(entry.sets, entry.kind);
  const out = [];
  if (entry.kind === "weight") {
    if (st.maxW > prev.maxW) out.push({ type: "weight", label: "Heaviest", value: kg(st.maxW), before: prev.maxW ? kg(prev.maxW) : null });
    if (st.e1rm > prev.e1rm && st.e1rm > 0 && st.maxW <= prev.maxW)
      out.push({ type: "e1rm", label: "Best set", value: setText(st.top, "weight"), before: `est. 1RM ${kg(prev.e1rm)}`, detail: `est. 1RM ${kg(st.e1rm)}` });
    if (st.volume > prev.volume && prev.volume > 0 && !out.length) out.push({ type: "volume", label: "Most volume", value: fmtVolume(st.volume), before: fmtVolume(prev.volume) });
  } else if (entry.kind === "reps") {
    if (st.maxReps > prev.maxReps) out.push({ type: "reps", label: "Most reps", value: plural(st.maxReps, "rep"), before: plural(prev.maxReps, "rep") });
    else if (st.maxW > prev.maxW) out.push({ type: "weight", label: "Most added weight", value: `+${kg(st.maxW)}`, before: prev.maxW ? `+${kg(prev.maxW)}` : null });
  } else if (st.maxSecs > prev.maxSecs) {
    out.push({ type: "time", label: "Longest", value: fmtSecs(st.maxSecs), before: fmtSecs(prev.maxSecs) });
  }
  return out;
}

const prCache = new WeakMap();
/** session id -> number of records it set */
export function recordCounts(data) {
  let m = prCache.get(data);
  if (m) return m;
  m = new Map();
  for (const s of data.sessions) {
    let n = 0;
    for (const e of s.exercises) n += recordsIn(data, s, e).length ? 1 : 0;
    if (n) m.set(s.id, n);
  }
  prCache.set(data, m);
  return m;
}

/** The newest records, newest first: [{session, entry, record}] */
export function recentRecords(data, limit = 5) {
  const out = [];
  for (let i = data.sessions.length - 1; i >= 0 && out.length < limit; i--) {
    const s = data.sessions[i];
    for (const e of s.exercises) {
      const recs = recordsIn(data, s, e);
      if (recs.length) out.push({ session: s, entry: e, record: recs[0] });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Comparing a workout with the last one
// ---------------------------------------------------------------------------
/** The previous time this workout was done (same plan workout, or same name) */
export function previousSession(data, session) {
  for (let i = data.sessions.length - 1; i >= 0; i--) {
    const s = data.sessions[i];
    if (s.id === session.id || s.start >= session.start) continue;
    if (session.workout ? s.workout === session.workout : s.name === session.name) return s;
  }
  return null;
}

/** "+2.5 kg", "+1 rep", "Same", "First time", with a direction */
export function changeOf(now, before, kind) {
  if (!before) return { dir: "new", text: "First time" };
  const a = now.top || {}, b = before.top || {};
  if (kind === "time") {
    const d = (now.maxSecs || 0) - (before.maxSecs || 0);
    return d ? { dir: d > 0 ? "up" : "down", text: `${d > 0 ? "+" : MINUS}${fmtSecs(Math.abs(d))}` } : { dir: "same", text: "Same" };
  }
  const dw = Math.round(((a.w || 0) - (b.w || 0)) * 100) / 100;
  const dr = (a.r || 0) - (b.r || 0);
  if (kind === "weight") {
    const de = (now.e1rm || 0) - (before.e1rm || 0);
    const dir = Math.abs(de) < 0.05 ? (dw > 0 ? "up" : dw < 0 ? "down" : "same") : de > 0 ? "up" : "down";
    if (dw) return { dir, text: `${dw > 0 ? "+" : MINUS}${kg(Math.abs(dw))}` };
    if (dr) return { dir, text: `${dr > 0 ? "+" : MINUS}${plural(Math.abs(dr), "rep")}` };
    return { dir: "same", text: "Same" };
  }
  if (dr) return { dir: dr > 0 ? "up" : "down", text: `${dr > 0 ? "+" : MINUS}${plural(Math.abs(dr), "rep")}` };
  if (dw) return { dir: dw > 0 ? "up" : "down", text: `${dw > 0 ? "+" : MINUS}${kg(Math.abs(dw))}` };
  return { dir: "same", text: "Same" };
}

const pctChange = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

/** Everything the summary shows: totals, against the last time, each exercise, and new records */
export function compareSession(data, session) {
  const exMap = exerciseMap(data);
  const now = sessionStats(session);
  const prev = previousSession(data, session);
  const before = prev ? sessionStats(prev) : null;
  const exercises = session.exercises.map((e) => {
    const ex = exMap.get(e.ex);
    const st = exStats(e.sets, e.kind);
    const last = lastFor(data, e.ex, session.start, session.id);
    const lastSt = last ? last.stats : null;
    const records = recordsIn(data, session, e);
    return { entry: e, ex, name: ex?.name || e.name || "Exercise", kind: e.kind, stats: st, last, change: changeOf(st, lastSt, e.kind),
      volumePct: lastSt && e.kind !== "time" ? pctChange(st.volume, lastSt.volume) : null, records };
  });
  return {
    now, prev, before,
    durDiff: before ? now.dur - before.dur : null,
    volumePct: before ? pctChange(now.volume, before.volume) : null,
    setsDiff: before ? now.sets - before.sets : null,
    exercises,
    records: exercises.flatMap((x) => x.records.map((r) => ({ ...r, name: x.name }))),
    improved: exercises.filter((x) => x.change.dir === "up").length,
  };
}

// ---------------------------------------------------------------------------
// Weeks, goals and streaks
// ---------------------------------------------------------------------------
export const plannedDays = (data) => Object.keys(data.schedule).length;
export const weekGoal = (data) => data.settings.goal || plannedDays(data) || 3;

/** The last n weeks (oldest first): {start, count, volume, secs, sessions} */
export function weekly(data, n = 12, now = today()) {
  const first = addDays(startOfWeek(now), -7 * (n - 1));
  const weeks = Array.from({ length: n }, (_, i) => ({ start: addDays(first, 7 * i), count: 0, volume: 0, secs: 0, sessions: [] }));
  const firstMs = first.getTime();
  for (const s of data.sessions) {
    const d = parseDay(s.date);
    if (d < first) continue;
    const i = Math.floor(Math.round((d.getTime() - firstMs) / 86400000) / 7);
    if (i < 0 || i >= n) continue;
    const w = weeks[i];
    const st = sessionStats(s);
    w.count += 1; w.volume += st.volume; w.secs += s.dur || 0; w.sessions.push(s);
  }
  return weeks;
}

/** Weeks in a row that reached the goal. This week counts once it's reached; until then the streak is still alive. */
export function streak(data, now = today()) {
  const goal = weekGoal(data);
  if (!data.sessions.length) return { weeks: 0, goal, thisWeek: 0, alive: false };
  const counts = new Map();
  for (const s of data.sessions) {
    const k = isoDay(startOfWeek(parseDay(s.date)));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let wk = startOfWeek(now);
  const thisWeek = counts.get(isoDay(wk)) || 0;
  let weeks = thisWeek >= goal ? 1 : 0;
  for (;;) {
    wk = addDays(wk, -7);
    if ((counts.get(isoDay(wk)) || 0) >= goal) weeks += 1; else break;
  }
  return { weeks, goal, thisWeek, alive: weeks > 0 };
}

/** Sets per muscle group in the last n days, most first */
export function muscleSplit(data, days = 30, now = today()) {
  const from = isoDay(addDays(now, -(days - 1)));
  const m = new Map();
  for (const s of data.sessions) {
    if (s.date < from) continue;
    for (const e of s.exercises) m.set(e.muscle || "Other", (m.get(e.muscle || "Other") || 0) + e.sets.length);
  }
  return [...m.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** Totals for one calendar month */
export function monthTotals(data, year, month) {
  const pre = `${year}-${p2(month + 1)}`;
  const t = { count: 0, secs: 0, volume: 0, sets: 0 };
  for (const s of data.sessions) {
    if (!s.date.startsWith(pre)) continue;
    const st = sessionStats(s);
    t.count += 1; t.secs += s.dur || 0; t.volume += st.volume; t.sets += st.sets;
  }
  return t;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------
export const workoutSets = (w) => w.items.reduce((a, it) => a + it.sets, 0);

/** A target's reps: "8–12" (a range) or "10" */
export const repRange = (it) => (it.hi ? `${it.reps}–${it.hi}` : `${it.reps ?? "?"}`);

/** How long a workout usually takes: the median of the last three times, or an estimate */
export function expectedMinutes(data, workout) {
  const past = data.sessions.filter((s) => s.workout === workout.id && s.dur > 300).slice(-3).map((s) => s.dur).sort((a, b) => a - b);
  if (past.length) return { minutes: Math.round(past[Math.floor(past.length / 2)] / 60), usual: true };
  // about a minute a set (setting up and lifting), its rest, and five minutes to warm up
  let secs = 300;
  for (const it of workout.items) secs += it.sets * (60 + (it.rest ?? workout.rest));
  return { minutes: Math.max(5, Math.round(secs / 300) * 5), usual: false };
}

export function workoutForDay(data, date) {
  const id = data.schedule[String(date.getDay())];
  return id ? data.workouts.find((w) => w.id === id) || null : null;
}

export function daysOf(data, workoutId) {
  return WEEK_ORDER.filter((d) => data.schedule[String(d)] === workoutId);
}

// ---------------------------------------------------------------------------
// Progress per exercise
// ---------------------------------------------------------------------------
/** Each exercise you've done: how often, the last time, and the trend of its best set */
export function exerciseSummaries(data, now = today()) {
  const exMap = exerciseMap(data);
  const out = [];
  for (const [id, list] of historyIndex(data)) {
    const ex = exMap.get(id);
    const kind = list.at(-1).entry.kind;
    const scores = list.map((h) => score(h.stats, kind));
    const lastH = list.at(-1);
    // change over about the last eight weeks
    const cut = isoDay(addDays(now, -56));
    const base = list.find((h) => h.session.date >= cut) || list[0];
    const change = scores.length > 1 ? score(lastH.stats, kind) - score(base.stats, kind) : 0;
    out.push({ id, ex, name: ex?.name || lastH.entry.name || "Exercise", kind, muscle: ex?.muscle || lastH.entry.muscle,
      count: list.length, last: lastH, scores, change, since: base.session.date });
  }
  return out.sort((a, b) => b.last.session.start - a.last.session.start);
}

/** Points for an exercise's chart: metric "e1rm" | "weight" | "volume" | "reps" | "time" */
export function exerciseSeries(data, exId, metric) {
  return exerciseHistory(data, exId).map((h) => {
    const st = h.stats;
    const y = metric === "e1rm" ? st.e1rm : metric === "weight" ? st.maxW : metric === "volume" ? st.volume
      : metric === "reps" ? st.maxReps : metric === "total" ? st.reps : st.maxSecs;
    return { x: parseDay(h.session.date).getTime(), y, h };
  }).filter((p) => p.y > 0);
}

export { bySessionStart };
