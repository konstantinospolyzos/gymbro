// Version 1.3: plates, warm-ups, supersets, swapping, sets per muscle, stalled lifts, body weight, CSV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, applyOp, sampleOp, normalize, exerciseMap, uid } from "../js/data.js";
import { platesFor, platesText, warmupSets, supersets, linkNext, unlink, weekMuscles, plateaus, alternatives, bodyTrend, barOf } from "../js/core.js";
import { startActive, completeSet, counts, toSession, sequence, nextAfter, swapExercise, addWarmups, removeWarmups, workIndex,
  addExercise, retargetRest, WARMUP_REST } from "../js/workout.js";
import { setsCsv, bodyCsv } from "../js/csv.js";

const NOW = new Date("2026-11-11T18:00:00").getTime();          // a Wednesday
const plan = () => applyOp(emptyData(), sampleOp(emptyData()));
const session = (id, date, exercises, extra = {}) => ({ type: "putSession", session: { id, date, start: new Date(`${date}T18:00:00`).getTime(), dur: 3600,
  name: "Workout", color: "blue", exercises, ...extra } });
const sets = (w, ...reps) => reps.map((r) => ({ w, r }));

test("plates: the biggest first for each side; what's missing; less than the bar", () => {
  assert.deepEqual(platesFor(102.5, 20).side, [25, 15, 1.25]);
  assert.deepEqual(platesFor(60, 20, [20, 10, 5, 2.5]).side, [20]);
  assert.deepEqual(platesFor(61, 20, [20, 10, 5, 2.5]), { side: [20], left: 0.5, under: false });
  assert.equal(platesText(102.5, 20), "Each side: 25 + 15 + 1.25");
  assert.equal(platesText(61, 20, [20, 10, 5, 2.5]), "Each side: 20 (0.5 kg short)");
  assert.equal(platesText(20, 20), "Just the bar (20 kg)");
  assert.equal(platesText(15, 20), "Less than the bar (20 kg)");
  assert.equal(platesText(30, 10, [5, 2.5]), "Each side: 5 + 5");                 // an EZ bar
  const ex = exerciseMap(emptyData());
  assert.equal(barOf(ex.get("ex-squat")), 20);
  assert.equal(barOf(ex.get("ex-ez-bar-curl")), 10);
  assert.equal(barOf(ex.get("ex-leg-press")), null);
  assert.equal(barOf({ ...ex.get("ex-squat"), bar: 0 }), null);                     // a Smith machine: no plates
  assert.equal(normalize({ ...emptyData(), exercises: [{ ...ex.get("ex-squat"), bar: 0 }] }).exercises[0].bar, 0);
});

test("warm-ups: up to four for a heavy barbell lift, two for a machine, none when it's light", () => {
  assert.deepEqual(warmupSets(100, { bar: 20 }), [{ w: 40, r: 8 }, { w: 60, r: 5 }, { w: 75, r: 3 }, { w: 85, r: 2 }]);
  assert.deepEqual(warmupSets(60, { bar: 20 }), [{ w: 30, r: 8 }, { w: 42.5, r: 5 }, { w: 50, r: 2 }]);
  assert.deepEqual(warmupSets(40, { bar: 20 }), [{ w: 20, r: 8 }, { w: 30, r: 4 }]);
  assert.deepEqual(warmupSets(65, { step: 5 }), [{ w: 35, r: 10 }, { w: 50, r: 5 }]);
  assert.deepEqual(warmupSets(15, { step: 5 }), []);
  assert.deepEqual(warmupSets(25, { bar: 20 }), []);
  assert.deepEqual(warmupSets(null), []);
});

test("warm-up sets in a workout: first, not counted, not saved, a short rest, nothing carried over", () => {
  let d = applyOp(plan(), session("old", "2026-11-04", [{ ex: "ex-squat", name: "Squat", kind: "weight", muscle: "Legs", sets: sets(80, 8, 8, 8) }]));
  const w = { id: "w-legs", name: "Legs", color: "green", rest: 120, items: [{ id: "i1", ex: "ex-squat", sets: 3, reps: 8, hi: 10, rest: null }] };
  d = applyOp(d, { type: "putWorkout", workout: w });
  const a = startActive(d, d.workouts.find((x) => x.id === "w-legs"), NOW);
  const x = a.exercises[0];
  assert.deepEqual(x.sets.map((s) => [s.w, Boolean(s.warm)]), [[40, true], [55, true], [67.5, true], [80, false], [80, false], [80, false]]);
  assert.deepEqual(counts(a), { done: 0, total: 3 });
  assert.equal(workIndex(x, 0), null);
  assert.equal(workIndex(x, 3), 0);
  x.sets[0].w = 45;                                        // a heavier first warm-up: the working sets keep 80
  assert.equal(completeSet(a, 0, 0, NOW), WARMUP_REST);
  assert.equal(x.sets[3].w, 80);
  completeSet(a, 0, 1, NOW + 60000);
  completeSet(a, 0, 2, NOW + 120000);
  assert.equal(completeSet(a, 0, 3, NOW + 200000), 120);   // the first working set: the workout's rest
  assert.deepEqual(counts(a), { done: 1, total: 3 });
  assert.deepEqual(toSession(a, d, NOW + 3600000).exercises[0].sets, [{ w: 80, r: 8 }]);
  // switched off in Settings: no warm-ups
  const off = applyOp(d, { type: "setSetting", key: "warmup", value: false });
  assert.equal(startActive(off, off.workouts.find((y) => y.id === "w-legs"), NOW).exercises[0].sets.some((s) => s.warm), false);
  // added and taken away by hand (the rest that points at a set moves with it)
  const b = startActive(off, off.workouts.find((y) => y.id === "w-legs"), NOW);
  completeSet(b, 0, 0, NOW);
  assert.equal(b.resting.s, 1);
  assert.equal(addWarmups(b, off, 0), 3);
  assert.equal(b.resting.s, 4);
  removeWarmups(b, 0);
  assert.equal(b.resting.s, 1);
  assert.equal(b.exercises[0].sets.length, 3);
});

test("supersets: linked exercises in turn, no rest inside a round, the longer rest after it", () => {
  const list = [{}, {}, {}, {}];
  linkNext(list, 1, true);
  assert.deepEqual(supersets(list).map((g) => g && `${g.label}${g.pos}`), [null, "A0", "A1", null]);
  linkNext(list, 2, true);
  assert.deepEqual(supersets(list).map((g) => g && `${g.label}${g.pos}`), [null, "A0", "A1", "A2"]);
  unlink(list, 2);                                          // out of the middle: the others aren't next to each other any more
  assert.deepEqual(supersets(list), [null, null, null, null]);

  const d = plan();
  const w = { id: "w-ss", name: "Arms", color: "purple", rest: 90, items: [
    { id: "i1", ex: "ex-dumbbell-curl", sets: 3, reps: 10, rest: null, group: "g1" },
    { id: "i2", ex: "ex-triceps-pushdown", sets: 2, reps: 12, rest: 60, group: "g1" },
    { id: "i3", ex: "ex-lateral-raise", sets: 2, reps: 15, rest: null }] };
  const d2 = applyOp(d, { type: "putWorkout", workout: w });
  assert.equal(d2.workouts.find((x) => x.id === "w-ss").items[0].group, "g1");      // kept in the file
  const a = startActive(d2, d2.workouts.find((x) => x.id === "w-ss"), NOW);
  assert.deepEqual(sequence(a).map((p) => `${p.e}${p.s}`), ["00", "10", "01", "11", "02", "20", "21"]);
  for (const x of a.exercises) for (const s of x.sets) s.r = 10;
  assert.equal(completeSet(a, 0, 0, NOW), 0);               // curl → pushdown straight away
  assert.deepEqual(nextAfter(a, 0, 0), { e: 1, s: 0 });
  assert.equal(completeSet(a, 1, 0, NOW + 60000), 90);      // after the round: the longer of 90 and 60
  assert.deepEqual(a.resting && { e: a.resting.e, s: a.resting.s }, { e: 0, s: 1 });
  completeSet(a, 0, 1, NOW + 200000);
  completeSet(a, 1, 1, NOW + 260000);
  assert.equal(completeSet(a, 0, 2, NOW + 400000), 90);     // the curl's third set: the pushdown has no third
  assert.deepEqual({ e: a.resting.e, s: a.resting.s }, { e: 2, s: 0 });
  // made during a workout: the rest points at what's next now
  const b = startActive(d, d.workouts.find((x) => x.id === "rec-arms") || d.workouts[0], NOW);
  for (const x of b.exercises) for (const s of x.sets) s.r = 10;
  const firstWork = b.exercises[0].sets.findIndex((s) => !s.warm);
  completeSet(b, 0, firstWork, NOW);
  linkNext(b.exercises, 0, true);
  retargetRest(b);
  assert.equal(b.resting.e, 1);
});

test("swap: before any set, in place; after one, the sets still to do go to the new exercise", () => {
  let d = applyOp(plan(), session("old", "2026-11-04", [{ ex: "ex-dumbbell-bench-press", name: "Dumbbell bench press", kind: "weight", muscle: "Chest", sets: sets(24, 10, 9) }]));
  d = applyOp(d, { type: "setSetting", key: "warmup", value: false });
  const w = { id: "w-c", name: "Chest", color: "red", rest: 120, items: [
    { id: "i1", ex: "ex-chest-press-machine", sets: 3, reps: 8, hi: 12, rest: 150, group: "g" }, { id: "i2", ex: "ex-seated-cable-fly", sets: 3, reps: 12, rest: null, group: "g" }] };
  d = applyOp(d, { type: "putWorkout", workout: w });
  const start = () => startActive(d, d.workouts.find((x) => x.id === "w-c"), NOW);
  const a = start();
  assert.equal(swapExercise(a, d, 0, "ex-dumbbell-bench-press", NOW), 0);
  const x = a.exercises[0];
  assert.equal(x.ex, "ex-dumbbell-bench-press");
  assert.deepEqual(x.sets.map((s) => s.w), [24, 24, 24]);  // its own weights from last time
  assert.equal(x.rest, 150);
  assert.deepEqual(supersets(a.exercises).map((g) => g?.label ?? null), ["A", "A"]);    // still a superset
  const b = start();
  for (const y of b.exercises) for (const s of y.sets) s.r = 8;
  completeSet(b, 0, 0, NOW);
  completeSet(b, 1, 0, NOW + 30000);
  assert.equal(b.resting.e, 0);
  assert.equal(swapExercise(b, d, 0, "ex-dumbbell-bench-press", NOW + 60000), 1);
  assert.deepEqual(b.exercises.map((y) => [y.ex, y.sets.length]), [["ex-chest-press-machine", 1], ["ex-dumbbell-bench-press", 2], ["ex-seated-cable-fly", 3]]);
  assert.deepEqual({ e: b.resting.e, s: b.resting.s }, { e: 1, s: 0 });
  assert.deepEqual(supersets(b.exercises).map((g) => g?.label ?? null), [null, "A", "A"]);
  // what to swap for: the same movement first, then the same muscle group
  const alt = alternatives(d, "ex-chest-press-machine", ["ex-seated-cable-fly"]);
  assert.equal(alt.similar[0].id, "ex-dumbbell-bench-press");   // done most recently
  assert.ok(alt.similar.every((e) => ["Chest"].includes(e.muscle)));
  assert.ok(alt.same.some((e) => e.id === "ex-chest-fly-machine"));
  assert.ok(!alt.same.concat(alt.similar).some((e) => e.id === "ex-seated-cable-fly" || e.id === "ex-chest-press-machine"));
});

test("sets per muscle this week: a press counts half for triceps and shoulders; the plan's week", () => {
  let d = plan();
  d = applyOp(d, session("mon", "2026-11-09", [{ ex: "ex-bench-press", name: "Bench press", kind: "weight", muscle: "Chest", sets: sets(60, 8, 8, 8, 8) },
    { ex: "ex-triceps-pushdown", name: "Triceps pushdown", kind: "weight", muscle: "Triceps", sets: sets(20, 12, 12) }]));
  d = applyOp(d, session("last-week", "2026-11-06", [{ ex: "ex-bench-press", name: "Bench press", kind: "weight", muscle: "Chest", sets: sets(60, 8, 8) }]));
  const rows = new Map(weekMuscles(d, new Date("2026-11-11T12:00:00")).map((r) => [r.muscle, r]));
  assert.equal(rows.get("Chest").done, 4);
  assert.equal(rows.get("Triceps").done, 4);               // 2 pushdowns + 4 × ½
  assert.equal(rows.get("Shoulders").done, 2);
  assert.ok(rows.get("Back").planned >= 10);                // the sample week has a back day
  assert.equal(rows.get("Quads").done, 0);
});

test("stalled lifts: the best is 4+ weeks old and the 3+ times since didn't beat it", () => {
  let d = plan();
  const add = (id, date, w, r) => { d = applyOp(d, session(id, date, [{ ex: "ex-bench-press", name: "Bench press", kind: "weight", muscle: "Chest", sets: sets(w, r) }])); };
  add("a", "2026-09-20", 70, 8); add("b", "2026-10-01", 80, 8); add("c", "2026-10-12", 77.5, 8); add("d", "2026-10-26", 80, 7); add("e", "2026-11-08", 80, 8);
  const now = new Date("2026-11-11T12:00:00");
  const p = plateaus(d, now);
  assert.equal(p.length, 1);
  assert.equal(p[0].id, "ex-bench-press");
  assert.equal(p[0].since, 3);                              // a tie isn't better
  assert.equal(p[0].best.session.date, "2026-10-01");
  assert.equal(p[0].weeks, 5);
  add("f", "2026-11-10", 82.5, 8);                          // beaten: moving again
  assert.equal(plateaus(d, now).length, 0);
});

test("body weight: one a day, sorted, deleted with null; the change in 30 days", () => {
  let d = emptyData();
  d = applyOp(d, { type: "putBody", date: "2026-11-10", kg: 82.4 });
  d = applyOp(d, { type: "putBody", date: "2026-10-20", kg: 83.5 });
  d = applyOp(d, { type: "putBody", date: "2026-11-10", kg: 82.1 });   // the same day again: replaced
  d = applyOp(d, { type: "putBody", date: "2026-09-01", kg: 85 });
  assert.deepEqual(d.body.map((b) => b.date), ["2026-09-01", "2026-10-20", "2026-11-10"]);
  assert.deepEqual(bodyTrend(d, 30, new Date("2026-11-11T12:00:00")), { last: { date: "2026-11-10", kg: 82.1 }, count: 3, since: "2026-10-20", change: -1.4 });
  d = applyOp(d, { type: "putBody", date: "2026-09-01", kg: null });
  assert.equal(d.body.length, 2);
  assert.deepEqual(normalize({ ...d, body: [{ date: "x", kg: 80 }, { date: "2026-01-01", kg: 5 }, { date: "2026-01-02", kg: "79.5" }] }).body, [{ date: "2026-01-02", kg: 79.5 }]);
  assert.equal(bodyTrend(emptyData()), null);
});

test("CSV: a row per set, quoted where needed; body weight", () => {
  let d = emptyData();
  d = applyOp(d, session("s1", "2026-11-11", [{ ex: "ex-squat", name: "Squat", kind: "weight", muscle: "Legs", sets: sets(100, 5, 5), note: 'Belt, "tight"' },
    { ex: "ex-plank", name: "Plank", kind: "time", muscle: "Core", sets: [{ s: 60 }] }], { name: "Legs, heavy" }));
  d = applyOp(d, { type: "putBody", date: "2026-11-11", kg: 81.5 });
  const lines = setsCsv(d).trim().split("\r\n");
  assert.equal(lines[0], "date,time,workout,exercise,muscle,type,set,weight_kg,reps,seconds,e1rm_kg,note");
  assert.equal(lines[1], '2026-11-11,18:00,"Legs, heavy",Squat,Legs,weight,1,100,5,,116.7,"Belt, ""tight"""');
  assert.equal(lines[2], '2026-11-11,18:00,"Legs, heavy",Squat,Legs,weight,2,100,5,,116.7,');
  assert.equal(lines[3], '2026-11-11,18:00,"Legs, heavy",Plank,Core,time,1,,,60,,');
  assert.equal(bodyCsv(d), "date,weight_kg\r\n2026-11-11,81.5\r\n");
  assert.ok(uid("g").startsWith("g-"));
});

test("an exercise added during a workout and the order still work without supersets", () => {
  const d = plan();
  const a = startActive(d, null, NOW);
  addExercise(a, d, "ex-plank", NOW);
  addExercise(a, d, "ex-crunch", NOW);
  assert.deepEqual(sequence(a).map((p) => `${p.e}${p.s}`), ["00", "01", "02", "10", "11", "12"]);
  a.exercises[1].sets[0].done = true;
  assert.deepEqual(nextAfter(a, 1, 0), { e: 1, s: 1 });
  for (const s of a.exercises[1].sets) s.done = true;
  assert.deepEqual(nextAfter(a, 1, 2), { e: 0, s: 0 });   // then anything skipped
});
