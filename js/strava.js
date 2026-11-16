// What a workout looks like on Strava: a Weight Training activity with every set (Strava then shows the
// exercises, the volume and its muscle map), and a description with the hard sets per muscle and each
// exercise's sets. Strava's upload format for strength training: developers.strava.com/docs/uploads
// ("JSON - Strength Training"). js/strava-api.js sends it.

import { exerciseMap } from "./data.js";
import { volumeOf, fmtKg, fmtNum, fmtSecs, timeUnit } from "./core.js";
import { VOLUME_MUSCLES } from "./library.js";

/** Each exercise in the library as Strava knows it: its exercise_type from Strava's supported exercises */
export const STRAVA_EXERCISE = {
  "ex-pull-up": "PULL_UP_GENERIC", "ex-chin-up": "CLOSE_GRIP_CHIN_UP", "ex-lat-pulldown": "LAT_PULLDOWN",
  "ex-single-arm-pulldown": "SINGLE_ARM_LAT_PULLDOWN", "ex-chest-supported-row": "CHEST_SUPPORTED_ROW", "ex-barbell-row": "BENT_OVER_BARBELL_ROW",
  "ex-dumbbell-row": "DUMBBELL_ROW", "ex-seated-cable-row": "SEATED_CABLE_ROW", "ex-t-bar-row": "T_BAR_ROW", "ex-deadlift": "BARBELL_DEADLIFT",
  "ex-straight-arm-pulldown": "STRAIGHT_ARM_PULLDOWN", "ex-face-pull": "FACE_PULL", "ex-back-extension": "BACK_EXTENSION",
  "ex-bench-press": "BARBELL_BENCH_PRESS", "ex-incline-bench-press": "INCLINE_BARBELL_BENCH_PRESS", "ex-dumbbell-bench-press": "DUMBBELL_BENCH_PRESS",
  "ex-incline-dumbbell-press": "INCLINE_DUMBBELL_BENCH_PRESS", "ex-chest-press-machine": "MACHINE_CHEST_PRESS", "ex-chest-fly-machine": "MACHINE_CHEST_FLY",
  "ex-cable-crossover": "CABLE_CROSSOVER", "ex-seated-cable-fly": "CABLE_CROSSOVER", "ex-dumbbell-fly": "DUMBBELL_FLYE", "ex-dips": "CHEST_DIP",
  "ex-push-up": "PUSH_UP_GENERIC",
  "ex-overhead-press": "OVERHEAD_BARBELL_PRESS", "ex-dumbbell-shoulder-press": "SEATED_DUMBBELL_SHOULDER_PRESS",
  "ex-machine-shoulder-press": "MACHINE_SEATED_SHOULDER_PRESS", "ex-arnold-press": "ARNOLD_PRESS", "ex-lateral-raise": "LATERAL_RAISE_GENERIC",
  "ex-cable-lateral-raise": "CABLE_LATERAL_RAISE", "ex-front-raise": "FRONT_RAISE", "ex-rear-delt-fly": "DUMBBELL_REAR_DELT_FLY",
  "ex-reverse-pec-deck": "MACHINE_REAR_DELT_REVERSE_FLY", "ex-upright-row": "BARBELL_UPRIGHT_ROW", "ex-shrug": "SHRUG_GENERIC",
  "ex-barbell-curl": "BARBELL_BICEPS_CURL", "ex-ez-bar-curl": "STANDING_EZ_BAR_BICEPS_CURL", "ex-dumbbell-curl": "STANDING_DUMBBELL_BICEPS_CURL",
  "ex-hammer-curl": "DUMBBELL_HAMMER_CURL", "ex-incline-dumbbell-curl": "INCLINE_DUMBBELL_BICEPS_CURL", "ex-preacher-curl": "EZ_BAR_PREACHER_CURL",
  "ex-cable-curl": "CABLE_BICEPS_CURL", "ex-bayesian-curl": "BAYESIAN_CURL",
  "ex-triceps-pushdown": "CABLE_TRICEPS_PUSHDOWN", "ex-overhead-triceps-extension": "OVERHEAD_DUMBBELL_TRICEPS_EXTENSION",
  "ex-overhead-cable-extension": "CABLE_OVERHEAD_TRICEPS_EXTENSION", "ex-skull-crusher": "SKULL_CRUSHER",
  "ex-close-grip-bench-press": "CLOSE_GRIP_BARBELL_BENCH_PRESS", "ex-bench-dips": "BENCH_DIP",
  "ex-squat": "BARBELL_BACK_SQUAT", "ex-front-squat": "BARBELL_FRONT_SQUAT", "ex-leg-press": "LEG_PRESS", "ex-hack-squat": "MACHINE_HACK_SQUAT",
  "ex-romanian-deadlift": "BARBELL_ROMANIAN_DEADLIFT", "ex-leg-extension": "MACHINE_LEG_EXTENSION", "ex-seated-leg-curl": "MACHINE_LEG_CURL_SEATED",
  "ex-leg-curl": "LEG_CURL_GENERIC", "ex-walking-lunge": "WALKING_LUNGE", "ex-bulgarian-split-squat": "DUMBBELL_BULGARIAN_SPLIT_SQUATS",
  "ex-standing-calf-raise": "STANDING_CALF_RAISE", "ex-seated-calf-raise": "SEATED_CALF_RAISE", "ex-calf-raise": "MACHINE_CALF_PRESS",
  "ex-hip-thrust": "BARBELL_HIP_THRUST", "ex-glute-kickback": "CABLE_KICKBACK", "ex-hip-abduction": "MACHINE_HIP_ABDUCTION",
  "ex-plank": "PLANK_GENERIC", "ex-crunch": "CRUNCH", "ex-hanging-leg-raise": "HANGING_LEG_RAISE", "ex-cable-crunch": "CABLE_CRUNCH",
  "ex-ab-wheel": "AB_WHEEL_ROLLOUT", "ex-russian-twist": "RUSSIAN_TWIST", "ex-cable-woodchopper": "CABLE_WOODCHOP",
  "ex-treadmill": "RUNNING", "ex-rowing-machine": "ROWING_MACHINE", "ex-exercise-bike": "CARDIO_GENERIC", "ex-stair-climber": "STAIRMASTER",
};

// an exercise of your own: from its name, else from its muscle
const BY_NAME = [
  [/leg curl|hamstring curl|nordic/i, "LEG_CURL_GENERIC"], [/calf/i, "CALF_RAISE_GENERIC"], [/curl/i, "CURL_GENERIC"],
  [/pull-?ups?\b|chin-?ups?\b|pull-?down/i, "PULL_UP_GENERIC"], [/\brow\b/i, "ROW_GENERIC"], [/\bfly|flye|crossover|pec deck/i, "FLYE_GENERIC"],
  [/lateral raise|front raise|rear delt/i, "LATERAL_RAISE_GENERIC"], [/shoulder press|overhead press|military/i, "SHOULDER_PRESS_GENERIC"],
  [/bench|chest press|push-?ups?\b/i, "BENCH_PRESS_GENERIC"], [/pushdown|skull|triceps/i, "TRICEPS_EXTENSION_GENERIC"],
  [/lunge|split squat|step-?ups?\b/i, "LUNGE_GENERIC"], [/squat|leg press/i, "SQUAT_GENERIC"], [/deadlift|\brdl\b|good morning/i, "DEADLIFT_GENERIC"],
  [/hip thrust|glute bridge/i, "HIP_RAISE_GENERIC"], [/plank/i, "PLANK_GENERIC"], [/shrug/i, "SHRUG_GENERIC"], [/carry|farmer/i, "CARRY_GENERIC"],
  [/crunch|sit-?ups?\b|leg raise|\bab(s)?\b/i, "CORE_GENERIC"],
];
const BY_MUSCLE = { Back: "ROW_GENERIC", Chest: "BENCH_PRESS_GENERIC", Shoulders: "SHOULDER_PRESS_GENERIC", Biceps: "CURL_GENERIC",
  Triceps: "TRICEPS_EXTENSION_GENERIC", Legs: "SQUAT_GENERIC", Glutes: "HIP_RAISE_GENERIC", Core: "CORE_GENERIC", Cardio: "CARDIO_GENERIC" };

/** The exercise_type Strava gets for an exercise (ex: the library's, or the workout's own record of it) */
export function stravaExercise(exId, ex) {
  if (STRAVA_EXERCISE[exId]) return STRAVA_EXERCISE[exId];
  const name = ex?.name || "";
  for (const [rx, type] of BY_NAME) if (rx.test(name)) return type;
  return BY_MUSCLE[ex?.muscle] || "TOTAL_BODY_GENERIC";
}

/** 2026-11-16T17:30:00+01:00: the phone's own time with its offset from UTC */
export function isoLocal(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset();
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${new Date(ms + off * 60000).toISOString().slice(0, 19)}${off < 0 ? "-" : "+"}${pad(off / 60)}:${pad(off % 60)}`;
}

/** The file Strava gets: every set with its exercise, reps and kilos (or seconds for a timed one) */
export function stravaFile(session, data) {
  const exMap = exerciseMap(data);
  const sets = [];
  for (const e of session.exercises) {
    const ex = exMap.get(e.ex) || e;
    const type = stravaExercise(e.ex, ex);
    for (const st of e.sets) {
      if ((e.kind || ex.kind) === "time") {
        if (st.s > 0) sets.push({ exercise_type: type, duration: Math.round(st.s) });
        continue;
      }
      const set = { exercise_type: type, repetitions: Math.max(0, Math.round(st.r || 0)) };
      if (st.w > 0) set.weight = Math.round(st.w * 100) / 100;
      sets.push(set);
    }
  }
  return {
    version: "1.0",
    start_time: isoLocal(session.start),
    utc_offset: -new Date(session.start).getTimezoneOffset() * 60,
    elapsed_time: Math.max(60, Math.round(session.dur || (session.end - session.start) / 1000) || 0),
    creator: { name: "GymBro" },
    sets,
  };
}

/** Hard sets per muscle in one workout, the most first: [{muscle, sets}] (½ for a muscle that helps) */
export function musclesOf(session, data) {
  const exMap = exerciseMap(data), m = new Map();
  for (const e of session.exercises) {
    for (const [muscle, f] of Object.entries(volumeOf(e.ex, exMap.get(e.ex) || e))) m.set(muscle, (m.get(muscle) || 0) + f * e.sets.length);
  }
  const at = (k) => (VOLUME_MUSCLES.includes(k) ? VOLUME_MUSCLES.indexOf(k) : 99);
  return [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || at(a[0]) - at(b[0])).map(([muscle, sets]) => ({ muscle, sets }));
}

const n1 = (v) => fmtNum(v, v % 1 ? 1 : 0);

/** One exercise's sets in a few words: "60 kg × 10, 10 · 57.5 kg × 9", "12, 10 reps", "1:00, 0:45" */
export function setsText(entry, unit = "sec") {
  if (entry.kind === "time") return entry.sets.map((s) => fmtSecs(s.s || 0, unit)).join(", ").replace(/\u00a0/g, " ");
  const runs = [];
  for (const s of entry.sets) {
    const w = s.w > 0 ? s.w : 0, last = runs.at(-1);
    if (last && last.w === w) last.reps.push(s.r || 0); else runs.push({ w, reps: [s.r || 0] });
  }
  const added = entry.kind === "reps";
  return runs.map((r) => (r.w ? `${added ? "+" : ""}${fmtKg(r.w)} kg × ${r.reps.join(", ")}` : `${r.reps.join(", ")} reps`))
    .join(" · ").replace(/ /g, " ");
}

/** The activity's description: the sets per muscle, then each exercise with its sets */
export function stravaDescription(session, data) {
  const exMap = exerciseMap(data);
  const muscles = musclesOf(session, data);
  const lines = muscles.length ? [`Sets per muscle: ${muscles.map((m) => `${m.muscle} ${n1(m.sets)}`).join(" · ")}`, ""] : [];
  for (const e of session.exercises) {
    const ex = exMap.get(e.ex) || e;
    lines.push(`${ex.name || e.name}: ${setsText(e, timeUnit(ex))}`);
  }
  return lines.join("\n").replace(/ /g, " ");
}

/** Strava's answers can be HTML: just the words */
export const plainText = (t) => String(t ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** "duplicate of activity 21234316": it's on Strava already, as that activity (else null) */
export function duplicateOf(text) {
  const m = plainText(text).match(/duplicate of\s+(?:activity\s+)?(\d+)/i);
  return m ? m[1] : null;
}
