// Checks for the data file (js/data.js) and the numbers (js/core.js), with hand-worked answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, applyOp, normalize, sampleOp, hasContent } from "../js/data.js";
import { e1rm, parseNum, parseSecs, fmtKg, fmtNum, clock, fmtRest, fmtDuration, compareSession, streak, weekly, recordsIn,
  previousSession, exStats, changeOf, muscleSplit, expectedMinutes, relDay, parseDay, recordCounts, exerciseSummaries, setText, slip,
  plannedWith, weekMuscles, volumeOf } from "../js/core.js";
import { VOLUME_MUSCLES } from "../js/library.js";

const withPlan = () => applyOp(emptyData(), sampleOp(emptyData()));
const T = (iso, hh = 18) => new Date(`${iso}T${String(hh).padStart(2, "0")}:00:00`).getTime();
const session = (id, iso, sets, extra = {}) => ({
  id, date: iso, start: T(iso), end: T(iso) + 3600000, dur: 3600, workout: "rec-back", name: "Back", color: "blue",
  exercises: [{ ex: "ex-barbell-row", name: "Barbell row", kind: "weight", muscle: "Back", sets }], ...extra,
});

test("a new file has the library, and the sample week puts back on Monday", () => {
  const d = withPlan();
  assert.ok(d.exercises.length > 50);
  assert.equal(d.workouts.length, 5);
  assert.equal(d.schedule["1"], "rec-back");
  assert.equal(d.schedule["0"], undefined);
  assert.equal(d.workouts[0].items[0].ex, "ex-lat-pulldown");
  assert.deepEqual([d.workouts[0].items[0].reps, d.workouts[0].items[0].hi], [8, 12]);
  assert.ok(hasContent(d));
  // adding the sample twice changes nothing
  assert.deepEqual(applyOp(d, sampleOp(d)), d);
  // the file survives a round trip
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(d))), d);
});

test("removing a workout frees its days; sessions stay in date order", () => {
  let d = withPlan();
  d = applyOp(d, { type: "deleteWorkout", id: "rec-legs" });
  assert.equal(d.schedule["3"], undefined);
  d = applyOp(d, { type: "putSession", session: session("b", "2026-11-09", [{ w: 60, r: 10 }]) });
  d = applyOp(d, { type: "putSession", session: session("a", "2026-11-02", [{ w: 57.5, r: 10 }]) });
  assert.deepEqual(d.sessions.map((s) => s.id), ["a", "b"]);
  d = applyOp(d, { type: "setDay", day: 6, workout: "rec-arms" });
  assert.equal(d.schedule["6"], "rec-arms");
  d = applyOp(d, { type: "setDay", day: 6, workout: null });
  assert.equal(d.schedule["6"], undefined);
  assert.throws(() => normalize({ hello: 1 }), /isn't a GymBro file/);
});

test("numbers: commas from a Swedish keypad, the clock, rests and lengths", () => {
  assert.equal(parseNum("62,5"), 62.5);
  assert.equal(parseNum(" 60 kg"), 60);
  assert.equal(parseNum("abc"), null);
  assert.equal(parseSecs("1:30"), 90);
  assert.equal(parseSecs("45"), 45);
  assert.equal(fmtKg(62.5), "62.5");
  assert.equal(fmtKg(60), "60");
  assert.equal(fmtNum(12340), "12 340");
  assert.equal(clock(65000), "1:05");
  assert.equal(clock(3725000), "1:02:05");
  assert.equal(fmtRest(90), "1:30");
  assert.equal(fmtRest(120), "2 min");
  assert.equal(fmtRest(45), "45 s");
  assert.equal(fmtDuration(3900), "1 h 05 min");
  assert.equal(setText({ w: 10, r: 8 }, "reps"), "+10 kg × 8");
});

test("estimated one-rep max (Epley)", () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 133.3);    // 100 × (1 + 10/30)
  assert.equal(e1rm(60, 8), 76);         // 60 × 1.2667 = 76.0
  assert.equal(e1rm(0, 10), 0);
  const st = exStats([{ w: 60, r: 10 }, { w: 65, r: 6 }, { w: 55, r: 12 }], "weight");
  assert.equal(st.top.w, 60);            // 80 beats 78 and 77
  assert.equal(st.volume, 600 + 390 + 660);
  assert.equal(st.maxW, 65);
});

test("the summary compares with the last time and finds new records", () => {
  let d = withPlan();
  d = applyOp(d, { type: "putSession", session: session("s1", "2026-11-02", [{ w: 60, r: 8 }, { w: 60, r: 8 }, { w: 60, r: 7 }]) });
  const today = session("s2", "2026-11-09", [{ w: 62.5, r: 8 }, { w: 62.5, r: 8 }, { w: 60, r: 8 }], { dur: 3300 });
  d = applyOp(d, { type: "putSession", session: today });
  const s2 = d.sessions.find((s) => s.id === "s2");
  assert.equal(previousSession(d, s2).id, "s1");
  const c = compareSession(d, s2);
  assert.equal(c.durDiff, -300);
  // 62.5×8×2 + 60×8 = 1480 vs 60×8×2 + 60×7 = 1380: +7.2 %
  assert.equal(c.volumePct, 7.2);
  assert.equal(c.exercises[0].change.dir, "up");
  assert.equal(c.exercises[0].change.text, "+2.5 kg");
  assert.equal(c.records.length, 1);
  assert.equal(c.records[0].type, "weight");
  // the first time is no record
  assert.deepEqual(recordsIn(d, d.sessions[0], d.sessions[0].exercises[0]), []);
  assert.equal(recordCounts(d).get("s2"), 1);
  assert.equal(changeOf(exStats([{ w: 60, r: 9 }], "weight"), exStats([{ w: 60, r: 8 }], "weight"), "weight").text, "+1 rep");
  const sum = exerciseSummaries(d, parseDay("2026-11-10"));
  assert.equal(sum[0].count, 2);
  assert.ok(sum[0].change > 0);
});

test("weeks, the goal and the streak", () => {
  let d = withPlan();     // 5 planned days: the goal is 5 a week
  const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30",   // week 1: 5
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06",               // week 2: 5
    "2026-11-09", "2026-11-10"];                                                        // this week: 2 so far
  days.forEach((iso, i) => { d = applyOp(d, { type: "putSession", session: session(`s${i}`, iso, [{ w: 50, r: 10 }]) }); });
  const now = parseDay("2026-11-11");
  const st = streak(d, now);
  assert.equal(st.goal, 5);
  assert.equal(st.thisWeek, 2);
  assert.equal(st.weeks, 2);
  const w = weekly(d, 3, now);
  assert.deepEqual(w.map((x) => x.count), [5, 5, 2]);
  d = applyOp(d, { type: "setSetting", key: "goal", value: 2 });
  assert.equal(streak(d, now).weeks, 3);
  assert.deepEqual(muscleSplit(d, 30, now), [{ muscle: "Back", sets: 12 }]);
});

test("how long a workout takes: an estimate, then the usual time", () => {
  let d = withPlan();
  const back = d.workouts[0];
  assert.equal(expectedMinutes(d, back).usual, false);
  d = applyOp(d, { type: "putSession", session: session("s1", "2026-11-02", [{ w: 60, r: 8 }], { dur: 3000 }) });
  d = applyOp(d, { type: "putSession", session: session("s2", "2026-11-09", [{ w: 60, r: 8 }], { dur: 3600 }) });
  assert.deepEqual(expectedMinutes(d, back), { minutes: 60, usual: true });     // median of 50 and 60 min: the higher middle
});

test("relative days", () => {
  const now = parseDay("2026-11-11");
  assert.equal(relDay("2026-11-11", now), "Today");
  assert.equal(relDay("2026-11-10", now), "Yesterday");
  assert.equal(relDay("2026-11-07", now), "Saturday");
  assert.equal(relDay("2026-10-20", now), "Tue 20 Oct");
  assert.equal(relDay("2025-10-20", now), "Mon 20 Oct 2025");
});

test("the recommended workouts and weeks are complete", async () => {
  const { RECOMMENDED, WEEKS, TIPS, weekOp, weeksFor } = await import("../js/library.js");
  const lib = new Set(emptyData().exercises.map((e) => e.id));
  for (const r of RECOMMENDED) {
    const sets = r.items.reduce((a, it) => a + it.sets, 0);
    assert.ok(r.items.length >= 4 && sets >= 9 && sets <= 17, `${r.name}: ${sets} sets`);
    for (const it of r.items) {
      assert.ok(lib.has(it.ex), `${r.name}: ${it.ex} is in the library`);
      assert.ok(TIPS[it.ex], `${it.ex} has a tip`);
      assert.ok(it.reps < it.hi && it.sets >= 2 && it.sets <= 4 && it.rest >= 60 && it.rest <= 180, `${r.name}: ${it.ex}`);
    }
  }
  for (const w of WEEKS) assert.equal(Object.keys(w.schedule).length, w.days);
  for (const n of [2, 3, 4, 5, 6]) assert.ok(weeksFor(n).length >= 1);
  // a week replaces the days, adds the workouts you don't have, and keeps your own
  let d = applyOp(emptyData(), { type: "putWorkout", workout: { id: "mine", name: "My back", color: "blue", rest: 90, items: [] } });
  d = applyOp(d, { type: "setDay", day: 0, workout: "mine" });
  d = applyOp(d, weekOp("ul4", d));
  assert.deepEqual(d.schedule, { 1: "wk-upper-a", 2: "wk-lower-a", 4: "wk-upper-b", 5: "wk-lower-b" });
  assert.deepEqual(d.workouts.map((w) => w.id), ["mine", "wk-upper-a", "wk-lower-a", "wk-upper-b", "wk-lower-b"]);
  assert.deepEqual(applyOp(d, weekOp("ul4", d)), d);
});

test("an older file gets the exercises added to the library since", () => {
  const old = { ...emptyData(), exercises: emptyData().exercises.filter((e) => e.id !== "ex-seated-leg-curl") };
  assert.ok(normalize(old).exercises.some((e) => e.id === "ex-seated-leg-curl"));
});

test("a slip of the finger: 800 kg for 80, 8 for 80, 625 for 62.5, 100 reps for 10", () => {
  // an extra digit, a lost decimal point, a double tap, a lost digit
  assert.deepEqual(slip(800, 80), { fix: 80 });
  assert.deepEqual(slip(625, 62.5), { fix: 62.5 });
  assert.deepEqual(slip(660, 60), { fix: 60 });
  assert.deepEqual(slip(8, 80), { fix: 80 });
  assert.deepEqual(slip(2.5, 25), { fix: 25 });
  assert.deepEqual(slip(100, 10, { reps: true }), { fix: 10 });
  assert.deepEqual(slip(88, 8, { reps: true }), { fix: 8 });
  assert.deepEqual(slip(105, 10, { reps: true }), { fix: 10 });
  // far off with no good guess: still asked, with nothing to offer
  assert.deepEqual(slip(9000, 12), { fix: null });
  // fine: normal jumps, drop sets, failed sets, nothing typed
  for (const [v, u] of [[100, 80], [40, 100], [25, 20], [10, 2.5], [0, 80], [null, 80]]) assert.equal(slip(v, u), null, `${v} for ${u}`);
  assert.equal(slip(3, 10, { reps: true }), null);
  assert.equal(slip(30, 10, { reps: true }), null);
  // nothing to compare with: only kilos nobody lifts
  assert.equal(slip(140, null), null);
  assert.deepEqual(slip(1000, null), { fix: 100 });
  assert.equal(slip(500, null, { reps: true }), null);
});

test("sets a week per muscle with a workout as it's being edited", () => {
  const d = applyOp(emptyData(), sampleOp(emptyData()));      // Mon back, Tue chest, Wed legs, Thu shoulders, Fri arms
  const w = structuredClone(d.workouts.find((x) => x.id === "rec-back"));
  const get = (rows, m) => rows.find((r) => r.muscle === m).planned;
  const plan = (schedule) => weekMuscles({ ...d, schedule, sessions: [] });
  const sum = (rows, m) => rows.find((r) => r.muscle === m)?.planned || 0;
  const rest = plan({ 2: "rec-chest", 3: "rec-legs", 4: "rec-shoulders", 5: "rec-arms" });
  // unchanged: the week's plan as it is; on no day it counts once, like now
  for (const m of VOLUME_MUSCLES) {
    assert.equal(get(plannedWith(d, w, [1]), m), sum(weekMuscles(d), m), m);
    assert.equal(get(plannedWith(d, w, []), m), get(plannedWith(d, w, [1]), m), m);
  }
  // a set more of the first exercise: its muscles go up by their share of it
  const before = plannedWith(d, w, [1]);
  w.items[0].sets += 1;
  const once = plannedWith(d, w, [1]);
  for (const m of VOLUME_MUSCLES) assert.equal(get(once, m) - get(before, m), volumeOf(w.items[0].ex, null)[m] || 0, m);
  // on Saturday too it counts twice; on Wednesday too it also takes the day from legs
  const twice = plannedWith(d, w, [1, 6]), wed = plannedWith(d, w, [1, 3]);
  const noLegs = plan({ 2: "rec-chest", 4: "rec-shoulders", 5: "rec-arms" });
  for (const m of VOLUME_MUSCLES) {
    const back = get(once, m) - sum(rest, m);
    assert.equal(get(twice, m), sum(rest, m) + 2 * back, m);
    assert.equal(get(wed, m), sum(noLegs, m) + 2 * back, m);
  }
});
