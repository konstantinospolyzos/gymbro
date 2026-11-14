// Version 1.11: dragging exercises into another order (supersets stay right), and each exercise's video.
import { test } from "node:test";
import assert from "node:assert/strict";
import { moveItem, regroup, supersets } from "../js/core.js";
import { VIDEOS, youTubeId, videoIdOf } from "../js/library.js";
import { libraryExercises, normalize, emptyData } from "../js/data.js";

const L = (s) => s.split(" ").map((t) => { const [ex, g] = t.split(":"); return g ? { ex, group: g } : { ex }; });
const show = (l) => l.map((x) => x.ex + (x.group ? `:${x.group.startsWith("g") && x.group.length > 2 ? "N" : x.group}` : "")).join(" ");

test("moving an exercise: its place, and supersets that still make sense", () => {
  assert.equal(show(moveItem(L("a b:x c:x d"), 3, 0)), "d a b:x c:x");
  assert.equal(show(moveItem(L("a b:x c:x d"), 2, 1)), "a c:x b:x d", "inside its superset: stays in it");
  assert.equal(show(moveItem(L("a b:x c:x d"), 1, 3)), "a c d b", "out of a pair: no superset left");
  assert.equal(show(moveItem(L("a b:x c:x d"), 0, 1)), "b:x a:x c:x d", "dropped between two of a superset: joins it");
  assert.equal(show(moveItem(L("a:y b:y c:x d:x"), 0, 3)), "b c:x d:x a");
  const l = moveItem(L("a b c"), 0, 0);
  assert.equal(show(l), "a b c", "same place: nothing");
  assert.equal(show(moveItem(L("a b c"), 0, 9)), "a b c", "nowhere: nothing");
  // a superset split in two by another exercise is two supersets
  const split = regroup(L("a:x b:x c d:x e:x"));
  const s = supersets(split);
  assert.equal(s[0].label, "A");
  assert.equal(s[3].label, "B");
  assert.notEqual(split[0].group, split[3].group);
});

test("videos: one for every exercise of the library but the cardio machines, played here", () => {
  for (const e of libraryExercises()) {
    if (e.muscle === "Cardio") continue;
    assert.ok(VIDEOS[e.id], `${e.name} has a video`);
  }
  const ids = Object.values(VIDEOS);
  assert.ok(ids.every((id) => /^[\w-]{11}$/.test(id)), "YouTube ids");
  assert.equal(new Set(ids).size, ids.length, "each video once");
  assert.ok(Object.keys(VIDEOS).every((k) => libraryExercises().some((e) => e.id === k)), "only exercises that exist");
});

test("your own video: any YouTube link, saved as the video's id, and it comes first", () => {
  for (const [link, id] of [
    ["https://www.youtube.com/watch?v=ykPUIEj4-W0", "ykPUIEj4-W0"], ["https://youtu.be/-Vyt2QdsR7E?si=abc", "-Vyt2QdsR7E"],
    ["https://youtube.com/shorts/8fXfwG4ftaQ?feature=share", "8fXfwG4ftaQ"], ["https://m.youtube.com/watch?pp=x&v=yd1uXb9sLT4", "yd1uXb9sLT4"],
    ["https://www.youtube.com/embed/Nqh7q3zDCoQ", "Nqh7q3zDCoQ"], ["https://www.youtube.com/live/c3Z8NXdcvEs?si=1", "c3Z8NXdcvEs"],
    ["  TMnxKjdYcME ", "TMnxKjdYcME"], ["https://vimeo.com/123", null], ["squat video", null], ["", null]]) {
    assert.equal(youTubeId(link), id, link);
  }
  const squat = libraryExercises().find((e) => e.id === "ex-squat");
  assert.equal(videoIdOf(squat), VIDEOS["ex-squat"]);
  assert.equal(videoIdOf({ ...squat, video: "https://youtu.be/ykPUIEj4-W0" }), "ykPUIEj4-W0");
  assert.equal(videoIdOf({ id: "ex-mine", name: "Mine" }), null);
  const d = normalize({ ...emptyData(), exercises: [{ ...squat, video: "https://youtu.be/ykPUIEj4-W0" }, { id: "ex-x", name: "X", video: "nope" }] });
  assert.equal(d.exercises.find((e) => e.id === "ex-squat").video, "ykPUIEj4-W0");
  assert.equal(d.exercises.find((e) => e.id === "ex-x").video, undefined);
});
