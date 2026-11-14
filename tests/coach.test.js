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

/** Claude's API streaming an answer: thinking (with its signature), then the text, cut into awkward pieces */
function sse(text, { stop = "end_turn", events = null, cut = 7, end = true } = {}) {
  const evs = events || [
    { type: "message_start", message: { id: "m1", role: "assistant", content: [] } },
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "SIG123" } },
    { type: "content_block_stop", index: 0 },
    { type: "ping" },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    ...[...text.matchAll(/[\s\S]{1,5}/g)].map((m) => ({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: m[0] } })),
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: 9 } },
    ...(end ? [{ type: "message_stop" }] : []),
  ];
  const wire = evs.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(wire);
  let i = 0;
  const stream = new ReadableStream({ pull(c) { if (i >= bytes.length) c.close(); else { c.enqueue(bytes.slice(i, i + cut)); i += cut; } } });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

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

test("asking Claude: a streamed request, the answer as it's written, and errors in plain words", async () => {
  let seen = null;
  const ok = async (url, opts) => { seen = { url, opts }; return sse("## Verdict\nGood. Ünïcode ✓ too."); };
  const msgs = [{ role: "user", content: "hi" }];
  const texts = [], phases = [];
  const r = await askClaude("sk-ant-x", msgs, { fetchFn: ok, onText: (t) => texts.push(t), onPhase: (p) => phases.push(p) });
  assert.equal(r.text, "## Verdict\nGood. Ünïcode ✓ too.");
  assert.deepEqual(r.content, [{ type: "thinking", thinking: "", signature: "SIG123" }, { type: "text", text: "## Verdict\nGood. Ünïcode ✓ too." }]);
  assert.ok(texts.length > 3 && texts.at(-1) === r.text, "the text arrives bit by bit");
  assert.deepEqual(phases, ["thinking", "writing"]);
  assert.equal(seen.url, API_URL);
  assert.equal(seen.opts.headers["x-api-key"], "sk-ant-x");
  assert.equal(seen.opts.headers["anthropic-version"], "2023-06-01");
  assert.equal(seen.opts.headers["anthropic-dangerous-direct-browser-access"], "true");
  const sent = JSON.parse(seen.opts.body);
  assert.equal(sent.model, MODEL);
  assert.equal(sent.stream, true);
  assert.equal(sent.system, INSTRUCTIONS);
  assert.deepEqual(sent.output_config, { effort: "medium" });
  assert.ok(sent.max_tokens >= 8000, "room to think before answering");
  assert.equal(sent.tools, undefined);
  assert.equal(sent.tool_choice, undefined);
  assert.deepEqual(sent.messages, msgs);

  const fail = (status, message) => async () => ({ ok: false, status, json: async () => ({ error: { message } }) });
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(401, "invalid x-api-key") }), /doesn't work/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(400, "Your credit balance is too low") }), /out of credit/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: fail(529, "Overloaded") }), /busy/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => { throw new TypeError("Load failed"); } }), /No connection/);
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => { throw abort; } }), (e) => e === abort);
  assert.equal(errorText(400, { error: { message: "bad" } }), "Claude couldn't answer (400: bad).");
  // trouble in the middle of the answer
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => sse("", { events: [{ type: "message_start", message: {} },
    { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }] }) }), /busy/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => sse("Half an ans", { end: false }) }), /connection dropped/);
  await assert.rejects(askClaude("k", msgs, { fetchFn: async () => sse("", { stop: "refusal" }) }), /didn't answer this one/);
  const cut = await askClaude("k", msgs, { fetchFn: async () => sse("A long answer", { stop: "max_tokens" }) });
  assert.equal(cut.text, "A long answer");
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

// ---------------------------------------------------------------------------
// Version 1.9: Claude checks the whole week
// ---------------------------------------------------------------------------
import { weekReport, planMessage, forClaudeAppPlan, askClaudePlan, planFromText, proposal, planSignature, PLAN_SCHEMA, PLAN_INSTRUCTIONS } from "../js/coach.js";

test("the week: every planned workout with its id and its exercises' ids, and the exercise list with ids", () => {
  const d = week();
  const r = plain(weekReport(d, NOW));
  assert.match(r, /^MY WEEK: Mon: Back · Tue: Chest · Wed: Pull · Thu: Shoulders · Fri: Arms · Sat: rest · Sun: rest\./);
  assert.match(r, /PULL \[id w-pull\], on Wednesday\. Rest between sets: 2 min\. 11 sets\.\n1\. Pull-up \[ex-pull-up\] \(body weight[^)]*\): 3 × 10 reps/);
  assert.match(r, /2\. Lat pulldown \[ex-lat-pulldown\]: 4 × 8–12 reps, rest 1:30, superset A\n {3}Last times: Wed 11 Nov: 62\.5×12/);
  assert.match(r, /THE APP'S EXERCISE LIST \(name \[id\]\):\n(.|\n)*Seated leg curl \[ex-seated-leg-curl\]/);
  assert.match(r, /Plank \[ex-plank\] \(timed\)/);
  assert.doesNotMatch(r, /undefined|NaN|null/);
  assert.match(planMessage("R", "bad knee"), /What you should know: bad knee\n\nR$/);
  const app = forClaudeAppPlan("R");
  assert.ok(app.startsWith(PLAN_INSTRUCTIONS) && app.includes("```json") && app.endsWith("R"));
});

test("Claude's plan: checked against the app, weights kept, the changes per workout", () => {
  const d = week();
  const p = proposal(d, { verdict: "Good week.", workouts: [
    { id: "w-pull", why: "Rows first, curls added.", rest_seconds: null, items: [
      { ex: "ex-seated-cable-row", sets: 4, reps: 10, reps_max: 12, rest_seconds: 90, superset_with_next: false },
      { ex: "ex-lat-pulldown", sets: 4, reps: 8, reps_max: 12, rest_seconds: 90 },
      { ex: "Incline dumbbell curl", sets: 3, reps: 8, reps_max: 12, superset_with_next: true },
      { ex: "ex-hammer-curl", sets: 3, reps: 10, reps_max: 8 },
      { ex: "ex-made-up", sets: 3 },
      { ex: "ex-lat-pulldown", sets: 9 }] },
    { id: "w-nope", why: "", items: [] },
  ] });
  assert.equal(p.verdict, "Good week.");
  assert.deepEqual(p.skipped, ["ex-made-up", "w-nope"]);
  assert.equal(p.changes.length, 1);
  const c = p.changes[0];
  assert.equal(c.why, "Rows first, curls added.");
  assert.deepEqual(c.next.items.map((x) => x.ex), ["ex-seated-cable-row", "ex-lat-pulldown", "ex-incline-dumbbell-curl", "ex-hammer-curl"]);
  assert.deepEqual(c.added, ["ex-incline-dumbbell-curl", "ex-hammer-curl"]);
  assert.deepEqual(c.removed, ["Pull-up"]);
  assert.equal(c.moved, true);
  assert.deepEqual(c.changed, []);
  const [row, pull, curl, hammer] = c.next.items;
  assert.equal(row.id, "i3");                                       // the same item as before
  assert.equal(pull.group, undefined); assert.equal(row.group, undefined);   // the old superset is gone
  assert.ok(curl.group && curl.group === hammer.group);            // a new one
  assert.equal(hammer.hi, null);                                    // 10–8 isn't a range
  assert.equal(c.supersets, true);
  assert.equal(c.next.rest, 120);
  // the same workout, unchanged
  const same = proposal(d, { verdict: "", workouts: [{ id: "w-pull", why: "", items: d.workouts.find((w) => w.id === "w-pull").items.map((it, i) =>
    ({ ex: it.ex, sets: it.sets, reps: it.reps, reps_max: it.hi, rest_seconds: it.rest, superset_with_next: i === 1 })) }] });
  assert.deepEqual(same.changes, []);
  assert.deepEqual(same.same, ["Pull"]);
});

test("Claude's plan: changed numbers, a timed exercise, the last weight kept", () => {
  let d = week();
  const w = structuredClone(d.workouts.find((x) => x.id === "w-pull"));
  w.items[1].w = 62.5;
  d = applyOp(d, { type: "putWorkout", workout: w });
  const p = proposal(d, { verdict: "", workouts: [{ id: "w-pull", why: "More sets.", rest_seconds: 150, items: [
    { ex: "ex-pull-up", sets: 3, reps: 10 }, { ex: "ex-lat-pulldown", sets: 5, reps: 8, reps_max: 12, rest_seconds: 90, superset_with_next: true },
    { ex: "ex-seated-cable-row", sets: 4, reps: 10, reps_max: 12, rest_seconds: 90 }, { ex: "ex-plank", sets: 3, seconds: 45 }] }] });
  const c = p.changes[0];
  assert.equal(c.next.items[1].w, 62.5);
  assert.deepEqual(c.changed.map((x) => [x.name, plain(x.from), plain(x.to)]), [["Lat pulldown", "4 × 8–12, rest 1:30", "5 × 8–12, rest 1:30"]]);
  assert.equal(c.restChanged, true);
  assert.equal(c.next.rest, 150);
  assert.deepEqual([c.next.items[3].secs, c.next.items[3].reps], [45, null]);
  assert.equal(c.supersets, false);
});

test("a pasted answer: the json block at its end", () => {
  const json = '{"verdict": "ok", "workouts": [{"id": "w-pull", "why": "", "items": []}]}';
  assert.equal(planFromText(`Here's why…\n\n\`\`\`json\n${json}\n\`\`\`\nGood luck!`).verdict, "ok");
  assert.equal(planFromText(`Example: \`\`\`json\n{"a":1}\n\`\`\`\nThe plan:\n\`\`\`\n${json}\n\`\`\``).verdict, "ok");
  assert.equal(planFromText(`Plan: ${json} done`).verdict, "ok");
  assert.equal(planFromText("No plan here"), null);
});

test("asking for the plan: JSON in the plan's shape (no forced tool: Claude Sonnet 5.5 refuses those), and its answer", async () => {
  let sent = null;
  const plan = { verdict: "v", notes: "", workouts: [{ id: "w-pull", why: "", rest_seconds: null, items: [] }] };
  const fetchFn = async (url, opts) => { sent = JSON.parse(opts.body); return sse(JSON.stringify(plan)); };
  const progress = [];
  const r = await askClaudePlan("k", [{ role: "user", content: "x" }], { fetchFn, onText: (t) => progress.push(t.length) });
  assert.deepEqual(r.input, plan);
  assert.equal(r.content.at(-1).type, "text");
  assert.equal(r.content[0].signature, "SIG123");
  assert.ok(progress.length > 3);
  assert.equal(sent.tools, undefined);
  assert.equal(sent.tool_choice, undefined);
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.output_config, { effort: "medium", format: { type: "json_schema", schema: PLAN_SCHEMA } });
  assert.equal(sent.system, PLAN_INSTRUCTIONS);
  await assert.rejects(askClaudePlan("k", [], { fetchFn: async () => sse('{"verdict": "v", "work', { stop: "max_tokens" }) }), /cut off/);
  await assert.rejects(askClaudePlan("k", [], { fetchFn: async () => sse("Sorry, no.") }), /didn't send a plan/);
  // an answer with the JSON in a code block still works
  const fenced = await askClaudePlan("k", [], { fetchFn: async () => sse("```json\n" + JSON.stringify(plan) + "\n```") });
  assert.equal(fenced.input.verdict, "v");
});

test("the plan's shape follows the API's rules for structured outputs", () => {
  let unions = 0;
  const walk = (node, path) => {
    if (Array.isArray(node.type)) unions += 1;
    for (const bad of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) assert.equal(node[bad], undefined, `${path}: ${bad} isn't supported`);
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, `${path}: additionalProperties must be false`);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `${path}: every field required`);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    }
    if (node.type === "array") walk(node.items, `${path}[]`);
  };
  walk(PLAN_SCHEMA, "plan");
  assert.ok(unions <= 16, `${unions} union types (the limit is 16)`);
});

test("Claude's plan with nulls: a weight exercise keeps its reps, a timed one gets its seconds", () => {
  const d = week();
  const p = proposal(d, { verdict: "", notes: "", workouts: [{ id: "w-pull", why: "x", rest_seconds: null, items: [
    { ex: "ex-pull-up", sets: 3, reps: null, reps_max: null, seconds: null, rest_seconds: null, superset_with_next: false },
    { ex: "ex-plank", sets: 3, reps: null, reps_max: null, seconds: null, rest_seconds: null, superset_with_next: false }] }] });
  const [pull, plank] = p.changes[0].next.items;
  assert.equal(pull.reps, 10);                  // from the plan before
  assert.equal(plank.secs, 60);
  assert.equal(pull.rest, null);
});

test("the plan's signature changes with the planned workouts, not with others", () => {
  const d = week();
  const sig = planSignature(d);
  const w = structuredClone(d.workouts.find((x) => x.id === "w-pull"));
  w.items[0].sets = 4;
  assert.notEqual(planSignature(applyOp(d, { type: "putWorkout", workout: w })), sig);
  assert.equal(planSignature(applyOp(d, { type: "putWorkout", workout: { id: "w-x", name: "Spare", color: "red", rest: 60, items: [] } })), sig);
});

// ---------------------------------------------------------------------------
// Version 1.11: Claude's alternatives to an exercise, for a reason (knee pain)
// ---------------------------------------------------------------------------
import { altMessage, alternativesFrom, askClaudeAlternatives, forClaudeAppAlt, jsonFromText, ALT_SCHEMA, ALT_INSTRUCTIONS } from "../js/coach.js";

test("alternatives: what Claude is told (the reason, the workout, the last times, the list with ids)", () => {
  const d = week();
  const r = plain(altMessage(d, { exId: "ex-lat-pulldown", reason: "  my elbow hurts  ",
    workout: { name: "Pull", lines: ["1. Pull-up: 3 × 10", "2. Lat pulldown: 4 × 8–12"] } }));
  assert.match(r, /^I want something instead of Lat pulldown \[ex-lat-pulldown\] in my Pull workout\.\n\nWhy: my elbow hurts\n\nTHE WORKOUT:\n1\. Pull-up/);
  assert.match(r, /My last times on Lat pulldown \(kg × reps\): Wed 11 Nov: 62\.5×12/);
  assert.match(r, /My notes on Lat pulldown: Seat on 4/);
  assert.match(r, /MY WEEK:\nMonday: /);
  assert.match(r, /Seated cable row \[ex-seated-cable-row\]/);
  assert.match(plain(altMessage(d, { exId: "ex-squat" })), /instead of Squat \[ex-squat\] in my workout\.\n\nWhy: no reason given/);
  assert.ok(forClaudeAppAlt("M").startsWith(ALT_INSTRUCTIONS) && forClaudeAppAlt("M").includes("```json") && forClaudeAppAlt("M").endsWith("M"));
});

test("alternatives: only exercises in the list, not the one replaced or already in the workout, each once", () => {
  const d = week();
  const out = alternativesFrom(d, { note: "Go easy at first.", alternatives: [
    { ex: "ex-lat-pulldown", why: "same", tip: "" },
    { ex: "ex-pull-up", why: "already there", tip: "" },
    { ex: "ex-made-up", why: "?", tip: "" },
    { ex: "Single-arm lat pulldown", why: "One arm at a time spares the elbow.", tip: "Neutral grip." },
    { ex: "ex-straight-arm-pulldown", why: "No elbow bend.", tip: "Arms almost straight." },
    { ex: "ex-single-arm-pulldown", why: "twice", tip: "" }] }, { exId: "ex-lat-pulldown", exclude: ["ex-pull-up"] });
  assert.equal(out.note, "Go easy at first.");
  assert.deepEqual(out.list.map((x) => x.id), ["ex-single-arm-pulldown", "ex-straight-arm-pulldown"]);
  assert.equal(out.list[0].tip, "Neutral grip.");
  assert.deepEqual(alternativesFrom(d, null).list, []);
});

test("alternatives: asked in their shape (structured output), streamed; a pasted answer works too", async () => {
  let sent = null;
  const ans = { note: "", alternatives: [{ ex: "ex-leg-press", why: "Less knee bend.", tip: "Feet high." }] };
  const r = await askClaudeAlternatives("k", [{ role: "user", content: "x" }], { fetchFn: async (u, o) => { sent = JSON.parse(o.body); return sse(JSON.stringify(ans)); } });
  assert.deepEqual(r.input, ans);
  assert.deepEqual(sent.output_config, { effort: "medium", format: { type: "json_schema", schema: ALT_SCHEMA } });
  assert.equal(sent.system, ALT_INSTRUCTIONS);
  assert.equal(sent.tool_choice, undefined);
  await assert.rejects(askClaudeAlternatives("k", [], { fetchFn: async () => sse("No idea.") }), /didn't suggest/);
  assert.equal(jsonFromText("Try these:\n```json\n" + JSON.stringify(ans) + "\n```", "alternatives").alternatives[0].ex, "ex-leg-press");
  assert.equal(jsonFromText('{"workouts": []}', "alternatives"), null);
});

test("the alternatives' shape follows the API's rules for structured outputs", () => {
  const walk = (node, path) => {
    for (const bad of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) assert.equal(node[bad], undefined, `${path}: ${bad}`);
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, path);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    }
    if (node.type === "array") walk(node.items, `${path}[]`);
  };
  walk(ALT_SCHEMA, "alternatives");
});
