// Export: every set, and your body weight, as CSV files for Excel, Numbers or Python (pandas.read_csv).
// Commas between the values and a full stop in decimals, one row per set.

import { exerciseMap } from "./data.js";
import { e1rm, timeOfDay } from "./core.js";

const cell = (v) => {
  if (v === null || v === undefined) return "";
  const t = String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const line = (cells) => cells.map(cell).join(",");
const file = (rows) => `${rows.join("\r\n")}\r\n`;

/** One row per set: date, time, workout, exercise, muscle, type, set, weight, reps, seconds, e1RM, note */
export function setsCsv(data) {
  const exMap = exerciseMap(data);
  const rows = [line(["date", "time", "workout", "exercise", "muscle", "type", "set", "weight_kg", "reps", "seconds", "e1rm_kg", "note"])];
  for (const s of data.sessions) {
    for (const e of s.exercises) {
      const name = exMap.get(e.ex)?.name || e.name, time = e.kind === "time";
      e.sets.forEach((x, i) => rows.push(line([s.date, timeOfDay(s.start), s.name, name, e.muscle, e.kind, i + 1,
        time ? "" : x.w ?? "", time ? "" : x.r ?? "", time ? x.s ?? "" : "",
        e.kind === "weight" ? e1rm(x.w, x.r) || "" : "", i === 0 ? e.note || "" : ""])));
    }
  }
  return file(rows);
}

/** One row per weigh-in: date, weight */
export function bodyCsv(data) {
  return file([line(["date", "weight_kg"]), ...(data.body || []).map((b) => line([b.date, b.kg]))]);
}
