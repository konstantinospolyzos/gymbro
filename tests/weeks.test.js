// Version 1.12: a recommended week gives every muscle at least 10 hard sets a week (the bottom of the 10–20
// that builds muscle, counted the way the Progress card counts them), and more with more days.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, applyOp } from "../js/data.js";
import { WEEKS, WEEK_WORKOUTS, TIPS, VOLUME_MUSCLES, weekOp, weeksFor, recommendedById } from "../js/library.js";
import { weekMuscles, expectedMinutes, workoutSets, supersets } from "../js/core.js";

const NOW = new Date("2026-11-16T12:00:00");
const BIG = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes"];
// the least for the big muscles by days a week: the more days, the higher in the range
const FLOOR = { 3: 10, 4: 12, 5: 14, 6: 15 };
const planned = (week) => {
  const d = applyOp(emptyData(), weekOp(week.id, emptyData()));
  return Object.fromEntries(weekMuscles(d, NOW).filter((m) => VOLUME_MUSCLES.includes(m.muscle)).map((m) => [m.muscle, m.planned]));
};

test("every recommended week: each muscle 10–20 hard sets a week, and the big ones higher with more days", () => {
  assert.deepEqual(WEEKS.map((w) => w.days), [3, 4, 5, 6]);
  for (const week of WEEKS) {
    const v = planned(week);
    for (const m of VOLUME_MUSCLES) {
      assert.ok(v[m] >= 10, `${week.name}: ${m} ${v[m]} is under 10`);
      assert.ok(v[m] <= 20, `${week.name}: ${m} ${v[m]} is over 20`);
    }
    for (const m of BIG) assert.ok(v[m] >= FLOOR[week.days], `${week.name}: ${m} ${v[m]} (at least ${FLOOR[week.days]} with ${week.days} days)`);
  }
  // the bottom of each week climbs with the days
  const lows = WEEKS.map((w) => Math.min(...BIG.map((m) => planned(w)[m])));
  assert.deepEqual([...lows].sort((a, b) => a - b), lows);
});

test("the weeks' workouts: about an hour, exercises from the library with how-to, supersets in pairs", () => {
  const lib = new Set(emptyData().exercises.map((e) => e.id));
  const used = new Set(WEEKS.flatMap((w) => Object.values(w.schedule)));
  assert.deepEqual([...used].sort(), WEEK_WORKOUTS.map((w) => w.id).sort(), "every week workout is used, and only those");
  for (const w of WEEK_WORKOUTS) {
    const mins = expectedMinutes(emptyData(), w).minutes;
    assert.ok(workoutSets(w) <= 27 && mins <= 80, `${w.name}: ${workoutSets(w)} sets, about ${mins} min`);
    const ss = supersets(w.items);
    w.items.forEach((it, i) => {
      assert.ok(lib.has(it.ex) && TIPS[it.ex], `${w.name}: ${it.ex}`);
      assert.ok(it.reps < it.hi && it.sets >= 2 && it.sets <= 5 && it.rest >= 60 && it.rest <= 180, `${w.name}: ${it.ex}`);
      if (it.group) assert.equal(ss[i]?.size, 2, `${w.name}: ${it.ex} is in a pair`);
    });
    assert.equal(recommendedById(w.id), w);
  }
});

test("fewer than 3 days gets the 3-day week; more than 6 the 6-day one", () => {
  assert.equal(weeksFor(2)[0].days, 3);
  assert.equal(weeksFor(3)[0].id, "full3");
  assert.equal(weeksFor(7)[0].days, 6);
});

test("the time a workout takes: a superset rests once a round, its longest rest", () => {
  const w = (items) => ({ id: "w", rest: 120, items });
  // 2 sets of 60 s + 90 s rest each, + 5 min warming up = 10 min
  assert.equal(expectedMinutes(emptyData(), w([{ ex: "a", sets: 2, rest: 90 }, { ex: "b", sets: 2, rest: 90 }])).minutes, 15);
  assert.equal(expectedMinutes(emptyData(), w([{ ex: "a", sets: 2, rest: 90, group: "g" }, { ex: "b", sets: 2, rest: 60, group: "g" }])).minutes, 10);
});
