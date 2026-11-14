// Version 1.8: Ask Claude: what it's told about a workout, asking it, and its answer as blocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData, applyOp, sampleOp } from "../js/data.js";
import { planReport, sessionReport, firstMessage, forClaudeApp, askClaude, errorText, blocks, inline, INSTRUCTIONS, MODEL, API_URL } from "../js/coach.js";

const NOW = new Date("2026-11-14T12:00:00");                     // a Saturday
const session = (id, date, exercises, extra = {}) => ({ type: "putSession", session: { id, date, start: new Date(`${date}T18:00:00`).getTime(), dur: 3600,
  name: "Pull", color: "blue", exercises, ...extra } });
const sets = (w, ...reps) => reps.map((r) => ({ w, r }));
const plain = (t) => t.replace(/\u00a0/g, " ");          // the app writes "2 min" with a no-break space

function week() {
  let d = applyOp(emptyData(), sampleOp(emptyData()));
  const pull = { id: "w-pull", name: "Pull", color: "blue", rest: 120, items: [
    { id: "i1", ex: "ex-pull-up", sets: 3, reps: 10, hi: null, rest: null, w: null, secs: null },
    { id: "i2", ex: "ex-lat-pulldown", sets: 4, reps: 8, hi: 12, rest: 90, w: null, secs: null, group: "g1" },
    { id: "i3", ex: "ex-seated-cable-row", sets: 4, reps: 10, hi: 12, rest: 90, w: null, secs: null, group: "g1" }] };
  d = applyOp(d, { type: "putWorkout", workout: pull });
  d = applyOp(d, { type: "setDay", day: 3, workout: "w-pull" });
  d = applyOp(d, { type: "putExercise", exercise: { ...d.exercises.find((e) => e.id === "ex-lat-pulldown"), notes: "Seat on 4" } });
  d = applyOp(d, session("s1", "2026-11-04", [{ ex: "ex-lat-pulldown", kind: "weight", sets: sets(60, 12, 10, 9, 8) }], { workout: "w-pull" }));
  d = applyOp(d, session("s2", "2026-11-11", [{ ex: "ex-lat-pulldown", kind: "weight", sets: sets(62.5, 12, 11, 10, 9), note: "Felt strong" },
    { ex: "ex-pull-up", kind: "reps", sets: [{ r: 10 }, { r: 8 }] }], { workout: "w-pull", feel: 3, notes: "Short on time" }));
  return d;
}

test("a planned workout: its exercises and the last times, the week, sets per muscle, the exercise list", () => {
  const d = week();
  const w = d.workouts.find((x) => x.id === "w-pull");
  const r = plain(planReport(d, w, null, NOW));
  assert.match(r, /THE WORKOUT TO REVIEW: Pull, on Wednesday\. Rest between sets: 2 min/);
  assert.match(r, /1\. Pull-up \(body weight; \+kg is added weight\): 3 × 10 reps\n {3}Last times: Wed 11 Nov: 10 · 8\n/);
  assert.match(r, /2\. Lat pulldown: 4 × 8–12 reps, rest 1:30, superset A/);
  assert.match(r, /Last times: Wed 11 Nov: 62\.5×12 · 62\.5×11 · 62\.5×10 · 62\.5×9 \| Wed 4 Nov: 60×12/);
  assert.match(r, /My notes: Seat on 4/);
  assert.match(r, /MY WEEK:\nMonday: /);
  assert.match(r, /Wednesday: Pull \(11 sets\): Pull-up 3 × 10, Lat pulldown 4 × 8–12/);
  assert.match(r, /HARD SETS PER MUSCLE A WEEK IN MY PLAN[^\n]*\nChest \d/);
  assert.match(r, /THE APP'S EXERCISE LIST:\n(.|\n)*Seated calf raise/);
  assert.doesNotMatch(r, /undefined|NaN|null/);
});

test("a planned workout with edits not saved yet: the new days and exercises count", () => {
  const d = week();
  const w = structuredClone(d.workouts.find((x) => x.id === "w-pull"));
  w.items.push({ id: "i4", ex: "ex-incline-dumbbell-curl", sets: 3, reps: 8, hi: 12, rest: null, w: null, secs: null });
  const r = plain(planReport(d, w, [6], NOW));
  assert.match(r, /Pull, on Saturday\./);
  assert.match(r, /Wednesday: (?!Pull)/);
  assert.match(r, /Saturday: Pull \(14 sets\)/);
  assert.match(r, /4\. Incline dumbbell curl: 3 × 8–12 reps\n/);
});

test("a logged workout: the sets against the plan and the last time, how it felt, what was skipped", () => {
  const d = week();
  const r = plain(sessionReport(d, d.sessions.find((s) => s.id === "s2"), NOW));
  assert.match(r, /THE WORKOUT TO REVIEW: Pull, done Wed 11 Nov 18:00–19:00 \(1 h 00 min\)\. It felt: Great\. My notes on it: Short on time/);
  assert.match(r, /1\. Lat pulldown: 62\.5×12 · 62\.5×11 · 62\.5×10 · 62\.5×9 \(planned 4 × 8–12 reps\)\n {3}Before: Wed 4 Nov: 60×12/);
  assert.match(r, /New record: Heaviest 62\.5/);
  assert.match(r, /My notes: Felt strong/);
  assert.match(r, /2\. Pull-up \(body weight[^)]*\): 10 · 8 \(planned 3 × 10 reps\)/);
  assert.match(r, /In the plan but not done: Seated cable row\./);
  assert.match(r, /Against the last Pull \(Wed 4 Nov\): volume \+[\d.]+%/);
  assert.match(r, /PLANNED \(done so far\)[^\n]*\nChest \d+ \(done \d/);
  assert.doesNotMatch(r, /undefined|NaN|null/);
});

test("the message: the question first, then the workout; the Claude app also gets the instructions", () => {
  assert.equal(firstMessage("REPORT"), "Please look at this workout from my gym app and give me feedback.\n\nREPORT");
  assert.equal(firstMessage("REPORT", "  Is it too long? "), "Please look at this workout from my gym app and give me feedback.\n\nMy question: Is it too long?\n\nREPORT");
  assert.ok(forClaudeApp("REPORT").startsWith(INSTRUCTIONS));
  assert.ok(forClaudeApp("REPORT").endsWith("REPORT"));
});

test("asking Claude: the request, the answer, and errors in plain words", async () => {
  let seen = null;
  const ok = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "## Verdict\nGood." }] }) }; };
  const msgs = [{ role: "user", content: "hi" }];
  assert.equal(await askClaude("sk-ant-x", msgs, { fetchFn: ok }), "## Verdict\nGood.");
  assert.equal(seen.url, API_URL);
  assert.equal(seen.opts.headers["x-api-key"], "sk-ant-x");
  assert.equal(seen.opts.headers["anthropic-version"], "2023-06-01");
  assert.equal(seen.opts.headers["anthropic-dangerous-direct-browser-access"], "true");
  const sent = JSON.parse(seen.opts.body);
  assert.equal(sent.model, MODEL);
  assert.equal(sent.system, INSTRUCTIONS);
  assert.deepEqual(sent.messages, msgs);

  const fail = (status, message) => async () => ({ ok: false, status, json: async () => ({ error: { message } }) });
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(401, "invalid x-api-key") }), /doesn't work/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(400, "Your credit balance is too low") }), /out of credit/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(529, "Overloaded") }), /busy/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => { throw new TypeError("Load failed"); } }), /No connection/);
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => { throw abort; } }), (e) => e === abort);
  assert.equal(errorText(400, { error: { message: "bad" } }), "Claude couldn't answer (400: bad).");
});

test("the answer as blocks: headings, paragraphs, lists, bold", () => {
  const md = "Solid pull day.\n\n## Keep\n- **Pull-ups** first\n- The rows\n\n**Change:**\n1. Swap X for Y\n2. Rest 2 min\n   on rows\n---\nDone *now*.";
  assert.deepEqual(blocks(md), [
    { type: "p", text: "Solid pull day." },
    { type: "h", text: "Keep" },
    { type: "ul", items: ["**Pull-ups** first", "The rows"] },
    { type: "p", text: "**Change:**" },
    { type: "ol", items: ["Swap X for Y", "Rest 2 min on rows"] },
    { type: "p", text: "Done *now*." },
  ]);
  assert.deepEqual(inline("**Pull-ups** first"), [{ text: "Pull-ups", bold: true }, { text: " first" }]);
  assert.deepEqual(inline("Done *now* `x`."), [{ text: "Done now x." }]);
  assert.deepEqual(inline("3 * 4 sets"), [{ text: "3 * 4 sets" }]);
});
