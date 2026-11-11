// Checks for the workout in progress (js/workout.js): the next set, the rest, and what gets saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, applyOp, sampleOp, exerciseMap } from "../js/data.js";
import { startActive, completeSet, current, nextAfter, tick, addRest, restLeft, toSession, addSet, removeSet, counts,
  addExercise, prefill, skipRest, uncompleteSet, noteFor, setNote, notesChanged, notesToSave } from "../js/workout.js";

const plan = () => applyOp(emptyData(), sampleOp(emptyData()));
const NOW = new Date("2026-11-09T18:00:00").getTime();

test("a workout from the plan: its exercises, sets and rest", () => {
  const d = plan();
  const back = d.workouts.find((w) => w.id === "rec-back");
  const a = startActive(d, back, NOW);
  assert.equal(a.name, "Back");
  assert.equal(a.rest, 120);
  assert.equal(a.exercises.length, 5);
  assert.equal(a.exercises[0].sets.length, 3);
  assert.equal(a.exercises[0].sets[0].r, 8);              // the bottom of the plan's 8–12 until there's a last time
  assert.deepEqual(current(a), { e: 0, s: 0 });
  assert.deepEqual(counts(a), { done: 0, total: 3 + 3 + 3 + 2 + 2 });
});

test("Set done starts the rest; it ends on time; the next set follows", () => {
  const d = plan();
  const a = startActive(d, d.workouts[0], NOW);
  const rest = completeSet(a, 0, 0, NOW + 60000);
  assert.equal(rest, 120);                                   // the lat pulldown's own rest
  assert.deepEqual({ e: a.resting.e, s: a.resting.s }, { e: 0, s: 1 });
  assert.equal(restLeft(a, NOW + 60000 + 115000), 5000);    // the last five seconds: the beeps
  addRest(a, 15, NOW + 60000 + 115000);
  assert.equal(restLeft(a, NOW + 60000 + 115000), 20000);
  assert.equal(tick(a, NOW + 60000 + 130000), false);
  assert.equal(tick(a, NOW + 60000 + 135000), true);
  assert.equal(a.resting, null);
  assert.deepEqual(current(a), { e: 0, s: 1 });
  // the last set of an exercise rests into the next exercise
  completeSet(a, 0, 1, NOW + 300000);
  completeSet(a, 0, 2, NOW + 400000);
  assert.deepEqual({ e: a.resting.e, s: a.resting.s }, { e: 1, s: 0 });
  skipRest(a);
  assert.equal(restLeft(a), 0);
});

test("a skipped set comes back at the end; the very last set has no rest", () => {
  const d = plan();
  const a = startActive(d, d.workouts[1], NOW);
  a.focus = { e: 0, s: 1 };                           // tapped the second set first
  completeSet(a, 0, 1, NOW);
  assert.deepEqual(nextAfter(a, 0, 1), { e: 0, s: 2 });
  // everything else done...
  a.exercises.forEach((x, e) => x.sets.forEach((s, i) => { if (!(e === 0 && i === 0)) { s.done = true; s.at = NOW; } }));
  assert.deepEqual(current(a), { e: 0, s: 0 });        // ...but the first set, which was skipped
  assert.equal(completeSet(a, 0, 0, NOW + 1000), 0);   // nothing left: no rest
  assert.equal(current(a), null);
});

test("a heavier first set carries on to the straight sets after it; a pyramid keeps its own", () => {
  const d = plan();
  const a = startActive(d, d.workouts[0], NOW);
  const sets = a.exercises[1].sets;                                         // chest-supported row, 3 sets
  sets.forEach((st) => { st.w = 60; st.orig.w = 60; });                     // straight sets: 60 kg
  sets[0].w = 62.5;                                                         // today: heavier
  completeSet(a, 1, 0, NOW);
  assert.deepEqual(sets.map((st) => st.w), [62.5, 62.5, 62.5]);
  sets[1].w = 65;                                                           // changed by hand: stays
  completeSet(a, 1, 1, NOW);
  assert.deepEqual(sets.map((st) => st.w), [62.5, 65, 65]);                 // the untouched last set follows
  const b = startActive(d, d.workouts[0], NOW);
  [60, 65, 70].forEach((w, i) => { b.exercises[1].sets[i].w = w; b.exercises[1].sets[i].orig.w = w; });   // a pyramid
  b.exercises[1].sets[0].w = 62.5;
  completeSet(b, 1, 0, NOW);
  assert.deepEqual(b.exercises[1].sets.map((st) => st.w), [62.5, 65, 70]);
});

test("only the sets that were done are saved, and they fill in the next workout", () => {
  let d = plan();
  const a = startActive(d, d.workouts[0], NOW);
  const x = a.exercises[1];                                  // chest-supported row
  x.sets[0].w = 70; x.sets[0].r = 8;
  completeSet(a, 1, 0, NOW + 60000);
  x.sets[1].w = 72.5; x.sets[1].r = 6;
  completeSet(a, 1, 1, NOW + 200000);
  addSet(a, 1);
  assert.equal(x.sets.length, 4);
  assert.equal(x.sets[3].r, 8);                              // copies the set before it
  removeSet(a, 1, 3);
  uncompleteSet(a, 1, 1);
  completeSet(a, 1, 1, NOW + 210000);
  const s = toSession(a, d, NOW + 3000000);
  assert.equal(s.exercises.length, 1);
  assert.deepEqual(s.exercises[0].sets, [{ w: 70, r: 8 }, { w: 72.5, r: 6 }]);
  assert.equal(s.dur, 3000);
  assert.equal(s.date, "2026-11-09");
  d = applyOp(d, { type: "putSession", session: s });
  // next week: last time's weights come first
  assert.deepEqual(prefill(d, "ex-chest-supported-row", 1), { w: 72.5, r: 6, s: null });
  assert.deepEqual(prefill(d, "ex-chest-supported-row", 3), { w: 72.5, r: 6, s: null });
  const next = startActive(d, d.workouts[0], NOW + 7 * 86400000);
  assert.equal(next.exercises[1].prev.length, 2);
  assert.equal(next.exercises[1].sets[0].w, 70);
  assert.equal(next.exercises[1].up, null);                  // 8 and 6 reps: not yet at the top of 8–12
  // an empty workout saves nothing
  assert.equal(toSession(startActive(d, null, NOW), d, NOW + 1000), null);
  const e = startActive(d, null, NOW);
  addExercise(e, d, "ex-plank", NOW);
  e.exercises[0].sets[0].s = 60;
  completeSet(e, 0, 0, NOW + 1000);
  assert.deepEqual(toSession(e, d, NOW + 90000).exercises[0].sets[0], { s: 60 });
});

test("the top of the rep range in every set: next time the weight goes up", () => {
  let d = plan();
  const back = d.workouts[0];
  const T0 = NOW - 7 * 86400000;
  d = applyOp(d, { type: "putSession", session: { id: "s1", date: "2026-11-02", start: T0, dur: 3600, workout: "rec-back", name: "Back", color: "blue",
    exercises: [{ ex: "ex-lat-pulldown", name: "Lat pulldown", kind: "weight", muscle: "Back", sets: [{ w: 60, r: 12 }, { w: 60, r: 12 }, { w: 60, r: 13 }] },
      { ex: "ex-chest-supported-row", name: "Chest-supported row", kind: "weight", muscle: "Back", sets: [{ w: 50, r: 12 }, { w: 50, r: 10 }] }] } });
  const a = startActive(d, back, NOW);
  assert.deepEqual(a.exercises[0].up, { kg: 5, reps: 12 });            // the pulldown's +/− step is 5 kg
  // the first heavy lift: two warm-up sets (a machine), from the new weight, then the working sets
  assert.deepEqual(a.exercises[0].sets.map((s) => [s.w, s.r, Boolean(s.warm)]),
    [[35, 10, true], [50, 5, true], [65, 8, false], [65, 8, false], [65, 8, false]]);
  assert.equal(a.exercises[1].up, null);                                // one set short of 12: same weight
  assert.deepEqual(a.exercises[1].sets.map((s) => s.w), [50, 50, 50]);
});

test("notes: typed in a workout they go to the exercise, and the workout keeps what was written that day", () => {
  let d = plan();
  const back = d.workouts.find((w) => w.id === "rec-back");
  const a = startActive(d, back, NOW);
  const id = a.exercises[0].ex;
  assert.equal(noteFor(a, d, 0), "");
  assert.equal(notesChanged(a), false);
  setNote(a, d, 0, "  Seat 4, thumbs over  ");
  assert.equal(noteFor(a, d, 0), "  Seat 4, thumbs over  ");
  assert.equal(notesChanged(a), true);
  assert.deepEqual(notesToSave(a, d), [{ ex: id, notes: "Seat 4, thumbs over" }]);
  for (const n of notesToSave(a, d)) d = applyOp(d, { type: "setExerciseNotes", id: n.ex, notes: n.notes });
  assert.equal(exerciseMap(d).get(id).notes, "Seat 4, thumbs over");
  assert.deepEqual(notesToSave(a, d), []);                       // saved: nothing more to do
  completeSet(a, 0, 0, NOW + 60000);
  completeSet(a, 1, 0, NOW + 200000);
  const s = toSession(a, d, NOW + 3600000);
  assert.equal(s.exercises[0].note, "Seat 4, thumbs over");
  assert.equal("note" in s.exercises[1], false);                 // nothing written on that one
  d = applyOp(d, { type: "putSession", session: s });
  assert.equal(d.sessions.at(-1).exercises[0].note, "Seat 4, thumbs over");   // kept in the file

  // next week the note is on the exercise; leaving it as it is adds nothing to that day
  const T = NOW + 7 * 86400000;
  const b = startActive(d, back, T);
  assert.equal(noteFor(b, d, 0), "Seat 4, thumbs over");
  completeSet(b, 0, 0, T + 60000);
  assert.equal(notesChanged(b), false);
  assert.equal("note" in toSession(b, d, T + 3600000).exercises[0], false);
  // changed and changed back: nothing changed today
  setNote(b, d, 0, "Seat 5");
  setNote(b, d, 0, "Seat 4, thumbs over ");
  assert.equal(notesChanged(b), false);
  assert.deepEqual(notesToSave(b, d), []);
  // emptied: the exercise loses its note
  setNote(b, d, 0, "");
  assert.deepEqual(notesToSave(b, d), [{ ex: id, notes: "" }]);
  d = applyOp(d, { type: "setExerciseNotes", id, notes: "" });
  assert.equal("notes" in exerciseMap(d).get(id), false);
  // at most 500 characters; an exercise that isn't there changes nothing
  d = applyOp(d, { type: "setExerciseNotes", id, notes: "x".repeat(600) });
  assert.equal(exerciseMap(d).get(id).notes.length, 500);
  assert.doesNotThrow(() => applyOp(d, { type: "setExerciseNotes", id: "ex-nope", notes: "hi" }));
});
