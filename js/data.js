// The data file: the exercise library, your workouts (the plan), the week, and every logged workout,
// plus the changes made to it. Every change is an "operation": applied here at once, queued, and
// replayed on the newest cloud copy when the app syncs, so the phone and the computer never
// overwrite each other's workouts.

import { weekOp, youTubeId } from "./library.js";

export const APP_NAME = "GymBro";
export const DATA_VERSION = 1;

export const MUSCLES = ["Back", "Chest", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Cardio", "Other"];
export const KINDS = ["weight", "reps", "time"];
export const KIND_LABELS = { weight: "Weight × reps", reps: "Reps (body weight)", time: "Time" };
export const COLORS = ["blue", "red", "green", "orange", "purple", "teal", "pink", "indigo"];

export const DEFAULT_SETTINGS = {
  rest: 90,          // seconds between sets, for new workouts
  countdown: 5,      // beeps in the last seconds of a rest
  sound: true,
  awake: true,       // keep the screen on during a workout
  goal: null,        // workouts a week; null = the days in your plan
  warmup: true,      // warm-up sets before the first heavy lift of a workout
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],   // the plates at your gym, for what to put on the bar
};
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];

/** [id, name, muscle, kind, weight step] */
const LIBRARY = [
  ["pull-up", "Pull-up", "Back", "reps"],
  ["chin-up", "Chin-up", "Back", "reps"],
  ["lat-pulldown", "Lat pulldown", "Back", "weight", 5],
  ["single-arm-pulldown", "Single-arm lat pulldown", "Back", "weight", 2.5],
  ["chest-supported-row", "Chest-supported row", "Back", "weight", 2.5],
  ["barbell-row", "Barbell row", "Back", "weight", 2.5],
  ["dumbbell-row", "One-arm dumbbell row", "Back", "weight", 2],
  ["seated-cable-row", "Seated cable row", "Back", "weight", 5],
  ["t-bar-row", "T-bar row", "Back", "weight", 2.5],
  ["deadlift", "Deadlift", "Back", "weight", 2.5],
  ["straight-arm-pulldown", "Straight-arm pulldown", "Back", "weight", 2.5],
  ["face-pull", "Face pull", "Back", "weight", 2.5],
  ["back-extension", "Back extension", "Back", "reps"],
  ["bench-press", "Bench press", "Chest", "weight", 2.5],
  ["incline-bench-press", "Incline bench press", "Chest", "weight", 2.5],
  ["dumbbell-bench-press", "Dumbbell bench press", "Chest", "weight", 2],
  ["incline-dumbbell-press", "Incline dumbbell press", "Chest", "weight", 2],
  ["chest-press-machine", "Chest press (machine)", "Chest", "weight", 5],
  ["chest-fly-machine", "Chest fly (machine)", "Chest", "weight", 5],
  ["cable-crossover", "Cable crossover", "Chest", "weight", 2.5],
  ["seated-cable-fly", "Seated cable fly", "Chest", "weight", 2.5],
  ["dumbbell-fly", "Dumbbell fly", "Chest", "weight", 2],
  ["dips", "Dips", "Chest", "reps"],
  ["push-up", "Push-up", "Chest", "reps"],
  ["overhead-press", "Overhead press", "Shoulders", "weight", 2.5],
  ["dumbbell-shoulder-press", "Dumbbell shoulder press", "Shoulders", "weight", 2],
  ["machine-shoulder-press", "Shoulder press (machine)", "Shoulders", "weight", 5],
  ["arnold-press", "Arnold press", "Shoulders", "weight", 2],
  ["lateral-raise", "Lateral raise", "Shoulders", "weight", 1],
  ["cable-lateral-raise", "Cable lateral raise", "Shoulders", "weight", 2.5],
  ["front-raise", "Front raise", "Shoulders", "weight", 1],
  ["rear-delt-fly", "Rear delt fly (dumbbells)", "Shoulders", "weight", 1],
  ["reverse-pec-deck", "Reverse pec deck", "Shoulders", "weight", 5],
  ["upright-row", "Upright row", "Shoulders", "weight", 2.5],
  ["shrug", "Shrug", "Shoulders", "weight", 2],
  ["barbell-curl", "Barbell curl", "Biceps", "weight", 2.5],
  ["ez-bar-curl", "EZ-bar curl", "Biceps", "weight", 2.5],
  ["dumbbell-curl", "Dumbbell curl", "Biceps", "weight", 2],
  ["hammer-curl", "Hammer curl", "Biceps", "weight", 2],
  ["incline-dumbbell-curl", "Incline dumbbell curl", "Biceps", "weight", 2],
  ["preacher-curl", "Preacher curl", "Biceps", "weight", 2.5],
  ["cable-curl", "Cable curl", "Biceps", "weight", 2.5],
  ["bayesian-curl", "Bayesian cable curl", "Biceps", "weight", 2.5],
  ["triceps-pushdown", "Triceps pushdown", "Triceps", "weight", 2.5],
  ["overhead-triceps-extension", "Overhead triceps extension (dumbbell)", "Triceps", "weight", 2],
  ["overhead-cable-extension", "Overhead cable triceps extension", "Triceps", "weight", 2.5],
  ["skull-crusher", "Skull crusher", "Triceps", "weight", 2.5],
  ["close-grip-bench-press", "Close-grip bench press", "Triceps", "weight", 2.5],
  ["bench-dips", "Bench dips", "Triceps", "reps"],
  ["squat", "Squat", "Legs", "weight", 2.5],
  ["front-squat", "Front squat", "Legs", "weight", 2.5],
  ["leg-press", "Leg press", "Legs", "weight", 5],
  ["hack-squat", "Hack squat", "Legs", "weight", 5],
  ["romanian-deadlift", "Romanian deadlift", "Legs", "weight", 2.5],
  ["leg-extension", "Leg extension", "Legs", "weight", 5],
  ["seated-leg-curl", "Seated leg curl", "Legs", "weight", 5],
  ["leg-curl", "Lying leg curl", "Legs", "weight", 5],
  ["walking-lunge", "Walking lunge", "Legs", "weight", 2],
  ["bulgarian-split-squat", "Bulgarian split squat", "Legs", "weight", 2],
  ["standing-calf-raise", "Standing calf raise", "Legs", "weight", 5],
  ["seated-calf-raise", "Seated calf raise", "Legs", "weight", 5],
  ["calf-raise", "Calf raise (leg press)", "Legs", "weight", 5],
  ["hip-thrust", "Hip thrust", "Glutes", "weight", 2.5],
  ["glute-kickback", "Cable glute kickback", "Glutes", "weight", 2.5],
  ["hip-abduction", "Hip abduction (machine)", "Glutes", "weight", 5],
  ["plank", "Plank", "Core", "time"],
  ["crunch", "Crunch", "Core", "reps"],
  ["hanging-leg-raise", "Hanging leg raise", "Core", "reps"],
  ["cable-crunch", "Cable crunch", "Core", "weight", 2.5],
  ["ab-wheel", "Ab wheel rollout", "Core", "reps"],
  ["russian-twist", "Russian twist", "Core", "reps"],
  ["cable-woodchopper", "Cable woodchopper", "Core", "weight", 2.5],
  ["treadmill", "Treadmill", "Cardio", "time"],
  ["rowing-machine", "Rowing machine", "Cardio", "time"],
  ["exercise-bike", "Exercise bike", "Cardio", "time"],
  ["stair-climber", "Stair climber", "Cardio", "time"],
];

/** Unique across devices, so two phones adding things offline never clash */
export function uid(prefix = "x") {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${rnd}`;
}

export function libraryExercises() {
  return LIBRARY.map(([id, name, muscle, kind, step]) => ({ id: `ex-${id}`, name, muscle, kind, step: step ?? null }));
}

export function emptyData() {
  return { app: APP_NAME, version: DATA_VERSION, updated: null, settings: { ...DEFAULT_SETTINGS },
    exercises: libraryExercises(), workouts: [], schedule: {}, sessions: [], body: [] };
}

/** The sample week (one muscle group a day, from the recommended workouts) as one change */
export function sampleOp(data) {
  return weekOp("split5", data);
}

// ---------------------------------------------------------------------------
// Checking a file (from the cloud, a backup, or an older version)
// ---------------------------------------------------------------------------
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const posNum = (v) => { const n = num(v); return n !== null && n >= 0 ? n : null; };
const int = (v, lo, hi, def = null) => { const n = num(v); if (n === null) return def; return Math.min(hi, Math.max(lo, Math.round(n))); };
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const roundKg = (v) => (v === null ? null : Math.round(v * 1000) / 1000);

function normExercise(e) {
  if (!e || typeof e !== "object" || !e.id || !str(e.name).trim()) return null;
  return {
    id: String(e.id), name: str(e.name, 80).trim(),
    muscle: MUSCLES.includes(e.muscle) ? e.muscle : "Other",
    kind: KINDS.includes(e.kind) ? e.kind : "weight",
    step: posNum(e.step) || null,
    ...(e.archived ? { archived: true } : {}),
    ...(str(e.notes, 500) ? { notes: str(e.notes, 500) } : {}),
    // done with a bar: its weight (0: no bar, even if the library has one)
    ...(posNum(e.bar) !== null ? { bar: Math.min(posNum(e.bar), 100) } : {}),
    // your own video for it (a YouTube video id)
    ...(youTubeId(e.video) ? { video: youTubeId(e.video) } : {}),
  };
}

function normItem(it, i) {
  if (!it || typeof it !== "object" || !it.ex) return null;
  const reps = int(it.reps, 0, 999), hi = int(it.hi, 0, 999);
  return { id: it.id ? String(it.id) : `i${i + 1}`, ex: String(it.ex), sets: int(it.sets, 1, 20, 3), reps,
    hi: reps !== null && hi !== null && hi > reps ? hi : null,
    w: roundKg(posNum(it.w)), secs: int(it.secs, 0, 36000), rest: int(it.rest, 0, 1800),
    // a superset: the exercises next to each other with the same group are done in turn
    ...(str(it.group, 24) ? { group: str(it.group, 24) } : {}) };
}

/** A body-weight entry: one a day */
function normBody(b) {
  if (!b || typeof b !== "object" || !DAY_RX.test(b.date)) return null;
  const kg = posNum(b.kg);
  return kg !== null && kg >= 20 && kg <= 400 ? { date: b.date, kg: roundKg(kg) } : null;
}

const bodyList = (list) => {
  const m = new Map();
  for (const b of (Array.isArray(list) ? list : []).map(normBody)) if (b) m.set(b.date, b);
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
};

function normWorkout(w) {
  if (!w || typeof w !== "object" || !w.id || !str(w.name).trim()) return null;
  return { id: String(w.id), name: str(w.name, 60).trim(), color: COLORS.includes(w.color) ? w.color : "blue",
    rest: int(w.rest, 0, 1800, DEFAULT_SETTINGS.rest), items: (Array.isArray(w.items) ? w.items : []).map(normItem).filter(Boolean),
    ...(str(w.notes, 500) ? { notes: str(w.notes, 500) } : {}) };
}

function normSet(s) {
  if (!s || typeof s !== "object") return null;
  const w = roundKg(posNum(s.w)), r = int(s.r, 0, 9999), sec = int(s.s, 0, 86400);
  if (w === null && r === null && sec === null) return null;
  const out = {};
  if (w !== null) out.w = w;
  if (r !== null) out.r = r;
  if (sec !== null) out.s = sec;
  return out;
}

function normSession(s) {
  if (!s || typeof s !== "object" || !s.id) return null;
  const start = num(s.start);
  const date = DAY_RX.test(s.date) ? s.date : start ? isoLocal(new Date(start)) : null;
  if (!date) return null;
  const exercises = (Array.isArray(s.exercises) ? s.exercises : []).map((e) => {
    if (!e || !e.ex) return null;
    const sets = (Array.isArray(e.sets) ? e.sets : []).map(normSet).filter(Boolean);
    const note = str(e.note, 500).trim();
    return sets.length ? { ex: String(e.ex), name: str(e.name, 80), kind: KINDS.includes(e.kind) ? e.kind : "weight",
      muscle: MUSCLES.includes(e.muscle) ? e.muscle : "Other", sets, ...(note ? { note } : {}) } : null;
  }).filter(Boolean);
  const startMs = start ?? new Date(`${date}T12:00:00`).getTime();
  const dur = int(s.dur, 0, 86400, 0);
  return {
    id: String(s.id), date, start: startMs, end: num(s.end) ?? startMs + dur * 1000, dur,
    workout: s.workout ? String(s.workout) : null, name: str(s.name, 60).trim() || "Workout",
    color: COLORS.includes(s.color) ? s.color : "blue",
    exercises,
    ...(str(s.notes, 2000) ? { notes: str(s.notes, 2000) } : {}),
    ...(int(s.feel, 1, 3) ? { feel: int(s.feel, 1, 3) } : {}),
    ...(s.manual ? { manual: true } : {}),
  };
}

export const bySessionStart = (a, b) => a.start - b.start || (a.id < b.id ? -1 : 1);

/** Check and tidy a data file */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.sessions) || !Array.isArray(raw.exercises))
    throw new Error("This isn't a GymBro file.");
  const seen = new Set();
  const unique = (list) => list.filter((x) => x && !seen.has(x.id) && seen.add(x.id));
  const exercises = unique(raw.exercises.map(normExercise));
  // exercises added to the library in a newer version of the app
  for (const e of libraryExercises()) if (!seen.has(e.id)) { seen.add(e.id); exercises.push(e); }
  seen.clear();
  const workouts = unique((Array.isArray(raw.workouts) ? raw.workouts : []).map(normWorkout));
  seen.clear();
  const sessions = unique(raw.sessions.map(normSession)).sort(bySessionStart);
  const ids = new Set(workouts.map((w) => w.id));
  const schedule = {};
  if (raw.schedule && typeof raw.schedule === "object")
    for (const [day, id] of Object.entries(raw.schedule)) if (/^[0-6]$/.test(day) && ids.has(id)) schedule[day] = id;
  const rs = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const settings = {
    rest: int(rs.rest, 0, 1800, DEFAULT_SETTINGS.rest),
    countdown: int(rs.countdown, 0, 10, DEFAULT_SETTINGS.countdown),
    sound: rs.sound === undefined ? DEFAULT_SETTINGS.sound : Boolean(rs.sound),
    awake: rs.awake === undefined ? DEFAULT_SETTINGS.awake : Boolean(rs.awake),
    goal: int(rs.goal, 1, 14),
    warmup: rs.warmup === undefined ? DEFAULT_SETTINGS.warmup : Boolean(rs.warmup),
    plates: Array.isArray(rs.plates) ? ALL_PLATES.filter((x) => rs.plates.map(Number).includes(x)) : [...DEFAULT_SETTINGS.plates],
  };
  return { app: APP_NAME, version: DATA_VERSION, updated: raw.updated || null, settings, exercises, workouts, schedule, sessions, body: bodyList(raw.body) };
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------
function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
}

/** Apply one change to a copy of the data */
export function applyOp(data, op) {
  const d = structuredClone(data);
  switch (op.type) {
    case "putExercise": { const e = normExercise(op.exercise); if (e) upsert(d.exercises, e); break; }
    case "setExerciseNotes": {
      const e = d.exercises.find((x) => x.id === op.id);
      const notes = str(op.notes, 500).trim();
      if (e) { if (notes) e.notes = notes; else delete e.notes; }
      break;
    }
    case "putBody": {
      // kg null: the day's entry goes
      const rest = (d.body || []).filter((b) => b.date !== op.date);
      d.body = bodyList(op.kg === null || op.kg === undefined ? rest : [...rest, { date: op.date, kg: op.kg }]);
      break;
    }
    case "archiveExercise": {
      const e = d.exercises.find((x) => x.id === op.id);
      if (e) { if (op.archived === false) delete e.archived; else e.archived = true; }
      break;
    }
    case "putWorkout": { const w = normWorkout(op.workout); if (w) upsert(d.workouts, w); break; }
    case "deleteWorkout":
      d.workouts = d.workouts.filter((w) => w.id !== op.id);
      for (const [day, id] of Object.entries(d.schedule)) if (id === op.id) delete d.schedule[day];
      break;
    case "moveWorkout": {
      const i = d.workouts.findIndex((w) => w.id === op.id);
      const j = i + (op.by || 0);
      if (i >= 0 && j >= 0 && j < d.workouts.length) { const [w] = d.workouts.splice(i, 1); d.workouts.splice(j, 0, w); }
      break;
    }
    case "setDay": {
      const day = String(op.day);
      if (!/^[0-6]$/.test(day)) break;
      if (op.workout && d.workouts.some((w) => w.id === op.workout)) d.schedule[day] = op.workout;
      else delete d.schedule[day];
      break;
    }
    case "addPlan": {
      for (const w of op.workouts || []) if (!d.workouts.some((x) => x.id === w.id)) { const n = normWorkout(w); if (n) d.workouts.push(n); }
      for (const [day, id] of Object.entries(op.schedule || {})) if (!d.schedule[day] && d.workouts.some((w) => w.id === id)) d.schedule[day] = id;
      break;
    }
    case "setWeek": {            // a recommended week: its workouts you don't have yet, and exactly these days
      for (const w of op.workouts || []) if (!d.workouts.some((x) => x.id === w.id)) { const n = normWorkout(w); if (n) d.workouts.push(n); }
      const ids = new Set(d.workouts.map((w) => w.id));
      d.schedule = {};
      for (const [day, id] of Object.entries(op.schedule || {})) if (/^[0-6]$/.test(day) && ids.has(id)) d.schedule[day] = id;
      break;
    }
    case "putSession": {
      const s = normSession(op.session);
      if (s) { upsert(d.sessions, s); d.sessions.sort(bySessionStart); }
      break;
    }
    case "deleteSession":
      d.sessions = d.sessions.filter((s) => s.id !== op.id);
      break;
    case "setSetting":
      if (op.key in DEFAULT_SETTINGS) d.settings[op.key] = op.value;
      return normalize(d);
    case "replaceAll":
      return normalize(op.data);
    default:
      throw new Error(`Unknown change: ${op.type}`);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Looking things up
// ---------------------------------------------------------------------------
const cache = new WeakMap();
/** id -> exercise (archived ones too: old workouts still name them) */
export function exerciseMap(data) {
  let m = cache.get(data);
  if (!m) { m = new Map(data.exercises.map((e) => [e.id, e])); cache.set(data, m); }
  return m;
}

export const hasContent = (d) => Boolean(d && (d.sessions.length || d.workouts.length));

export function describeData(d) {
  if (!d) return "nothing yet";
  const n = d.sessions.length, w = d.workouts.length;
  const parts = [`${n} workout${n !== 1 ? "s" : ""} logged`];
  if (w) parts.push(`${w} in your plan`);
  return parts.join(", ");
}
