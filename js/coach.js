// Feedback from Claude: what it's told about a workout (the workout, the whole week, the last times you did
// each exercise, your notes), the coach's instructions, asking Claude, and its answer as blocks to show.
// Nothing here touches the page or the phone's storage, so it's tested on its own.

import { exerciseMap } from "./data.js";
import { WEEKDAYS, WEEK_ORDER, repRange, fmtRest, fmtSecs, timeUnit, setShort, exerciseHistory, compareSession, weekMuscles,
  plateaus, supersets, shortDate, parseDay, timeOfDay, fmtDuration, fmtKg, today, addDays, isoDay, workoutSets, bodyTrend } from "./core.js";
import { VOLUME_MUSCLES } from "./library.js";

export const MODEL = "claude-sonnet-5-5";
export const API_URL = "https://api.anthropic.com/v1/messages";

/** The coach's instructions (the system prompt) */
export const INSTRUCTIONS = `You are an experienced strength coach. The lifter tracks their training in GymBro, a gym app, and has
sent you one workout from it with their whole week and their recent history. They train in a fully
equipped commercial gym, mainly to build muscle and get stronger.

Go by current evidence: about 10–20 hard sets per muscle a week, sets of roughly 5–30 reps taken close to
failure, longer rests (2–3 min) on big compound lifts, and exercises that load each muscle in its
stretched position. Judge the workout as part of the week: what other days already cover matters.

Be specific and short (under 220 words). Use this shape:
- one line with your overall verdict
- **Keep:** what's working
- **Change:** concrete changes only: swap X for Y, sets × reps, rest, order. Use exercise names from the
  app's exercise list when you can, so they can be found in the app.
- **Next time:** what to aim for (weights or reps), when there's history to go on
If something is already good, say so: don't invent problems. Don't repeat their data back to them.
Plain words, short bullet points, ## headings or **bold** for the parts. No tables.`;

const FEELS = { 1: "Hard", 2: "Good", 3: "Great" };

function target(it, ex) {
  if (ex?.kind === "time") return `${it.sets} × ${fmtSecs(it.secs ?? 60, timeUnit(ex))}`;
  return `${it.sets} × ${repRange(it)} reps`;
}

const kindNote = (ex) => (ex?.kind === "reps" ? " (body weight; +kg is added weight)" : ex?.kind === "time" ? " (timed)" : "");

/** One exercise's sets: 80×8 · 80×7 (kg × reps) */
function setsText(data, entry) {
  const unit = timeUnit(exerciseMap(data).get(entry.ex) || entry);
  return entry.sets.map((s) => setShort(s, entry.kind, unit)).join(" · ");
}

/** The last few times an exercise was done (before a moment), newest first */
function lastTimes(data, exId, { before = Infinity, skip = null, n = 3 } = {}) {
  return exerciseHistory(data, exId).filter((x) => x.session.start < before && x.session.id !== skip).slice(-n).reverse()
    .map((x) => `${shortDate(parseDay(x.session.date))}: ${setsText(data, x.entry)}`);
}

/** Each day of the week and its workout, one line each */
function weekLines(data) {
  const exMap = exerciseMap(data);
  return WEEK_ORDER.map((d) => {
    const w = data.workouts.find((x) => x.id === data.schedule[String(d)]);
    if (!w) return `${WEEKDAYS[d]}: rest`;
    const items = w.items.map((it) => `${exMap.get(it.ex)?.name || "?"} ${target(it, exMap.get(it.ex)).replace(" reps", "")}`);
    return `${WEEKDAYS[d]}: ${w.name} (${workoutSets(w)} sets): ${items.join(", ")}`;
  });
}

function musclesLine(data, now, withDone = false) {
  const rows = weekMuscles(data, now).filter((m) => VOLUME_MUSCLES.includes(m.muscle));
  return rows.map((m) => `${m.muscle} ${fmtKg(m.planned)}${withDone ? ` (done ${fmtKg(m.done)})` : ""}`).join(", ");
}

/** The app's exercises (the library and your own), by muscle group */
function exerciseList(data) {
  const by = new Map();
  for (const e of data.exercises) {
    if (e.archived) continue;
    if (!by.has(e.muscle)) by.set(e.muscle, []);
    by.get(e.muscle).push(e.name);
  }
  return [...by].map(([m, names]) => `${m}: ${names.join(", ")}`);
}

function background(data, now) {
  const from = isoDay(addDays(now, -56));
  const recent = data.sessions.filter((s) => s.date >= from).length;
  const lines = [`Workouts logged in the last 8 weeks: ${recent} (${data.sessions.length} in all). Weekly goal: ${data.settings.goal || Object.keys(data.schedule).length || 3} workouts.`];
  const bw = bodyTrend(data, 30, now);
  if (bw?.last) lines.push(`Body weight: ${fmtKg(bw.last.kg)} kg${bw.change ? ` (${bw.change > 0 ? "+" : ""}${fmtKg(bw.change)} kg over 30 days)` : ""}.`);
  const stuck = plateaus(data, now);
  if (stuck.length) lines.push(`Lifts that stopped going up: ${stuck.map((p) => `${p.name} (best ${setsText(data, p.best.entry)} ${p.weeks} weeks ago, ${p.since} tries since)`).join("; ")}.`);
  return lines;
}

const section = (title, lines) => (lines.length ? `${title}\n${lines.join("\n")}` : "");

/**
 * What Claude is told about a planned workout, with the edits not saved yet: the workout and its days.
 * days: the weekdays (0 = Sunday) it's on.
 */
export function planReport(data, workout, days = null, now = today()) {
  // the week as it will be with this workout (and its days) saved
  const schedule = { ...data.schedule };
  if (days) {
    for (const [d, id] of Object.entries(schedule)) if (id === workout.id) delete schedule[d];
    for (const d of days) schedule[String(d)] = workout.id;
  }
  const week = { ...data, schedule, workouts: [...data.workouts.filter((w) => w.id !== workout.id), workout] };
  const exMap = exerciseMap(data);
  const on = WEEK_ORDER.filter((d) => schedule[String(d)] === workout.id).map((d) => WEEKDAYS[d]);
  const ss = supersets(workout.items);
  const items = workout.items.map((it, i) => {
    const ex = exMap.get(it.ex);
    const extra = [it.rest != null ? `rest ${fmtRest(it.rest)}` : null, ss[i] ? `superset ${ss[i].label}` : null].filter(Boolean);
    const lines = [`${i + 1}. ${ex?.name || "Exercise"}${kindNote(ex)}: ${target(it, ex)}${extra.length ? `, ${extra.join(", ")}` : ""}`];
    const last = lastTimes(data, it.ex);
    if (last.length) lines.push(`   Last times: ${last.join(" | ")}`);
    if (ex?.notes) lines.push(`   My notes: ${ex.notes}`);
    return lines.join("\n");
  });
  return [
    `THE WORKOUT TO REVIEW: ${workout.name || "Workout"}, ${on.length ? `on ${on.join(", ")}` : "not on a day yet"}. Rest between sets: ${fmtRest(workout.rest)} unless an exercise says otherwise. Sets are kg × reps.`,
    items.join("\n"),
    section("MY WEEK:", weekLines(week)),
    section("HARD SETS PER MUSCLE A WEEK IN MY PLAN (a set counts fully for its main muscle and half for helpers, e.g. a press is half a set for the triceps; the app's target is 10–20):", [musclesLine(week, now)]),
    section("BACKGROUND:", background(data, now)),
    section("THE APP'S EXERCISE LIST:", exerciseList(data)),
  ].filter(Boolean).join("\n\n");
}

/** What Claude is told about a logged workout: what was done against the plan and the last times */
export function sessionReport(data, session, now = today()) {
  const c = compareSession(data, session);
  const exMap = exerciseMap(data);
  const plan = session.workout ? data.workouts.find((w) => w.id === session.workout) : null;
  const head = [`THE WORKOUT TO REVIEW: ${session.name}, done ${shortDate(parseDay(session.date))} ${timeOfDay(session.start)}–${timeOfDay(session.end)} (${fmtDuration(session.dur)}).`];
  if (session.feel) head.push(`It felt: ${FEELS[session.feel]}.`);
  if (session.notes) head.push(`My notes on it: ${session.notes}`);
  const items = c.exercises.map((x, i) => {
    const ex = exMap.get(x.entry.ex);
    const it = plan?.items.find((p) => p.ex === x.entry.ex);
    const lines = [`${i + 1}. ${x.name}${kindNote(ex)}: ${setsText(data, x.entry)}${it ? ` (planned ${target(it, ex)})` : ""}`];
    const last = lastTimes(data, x.entry.ex, { before: session.start, skip: session.id });
    if (last.length) lines.push(`   Before: ${last.join(" | ")}`);
    if (x.records.length) lines.push(`   New record: ${x.records.map((r) => `${r.label} ${r.value}`).join(", ")}`);
    const note = x.entry.note || ex?.notes;
    if (note) lines.push(`   My notes: ${note}`);
    return lines.join("\n");
  });
  const skipped = plan ? plan.items.filter((it) => !session.exercises.some((e) => e.ex === it.ex)).map((it) => exMap.get(it.ex)?.name).filter(Boolean) : [];
  const vs = c.prev ? [`Against the last ${session.name} (${shortDate(parseDay(c.prev.date))}): volume ${c.volumePct === null ? "n/a" : `${c.volumePct > 0 ? "+" : ""}${c.volumePct}%`}, ${c.now.sets} sets vs ${c.before.sets}, ${fmtDuration(c.now.dur)} vs ${fmtDuration(c.before.dur)}.`] : [];
  return [
    head.join(" "),
    `WHAT I DID (kg × reps per set):\n${items.join("\n")}`,
    skipped.length ? `In the plan but not done: ${skipped.join(", ")}.` : "",
    vs.join(""),
    section("MY WEEK:", weekLines(data)),
    section("HARD SETS PER MUSCLE THIS WEEK, PLANNED (done so far) (a set counts fully for its main muscle and half for helpers; the app's target is 10–20):", [musclesLine(data, parseDay(session.date), true)]),
    section("BACKGROUND:", background(data, now)),
    section("THE APP'S EXERCISE LIST:", exerciseList(data)),
  ].filter(Boolean).join("\n\n");
}

/** The first message: the report, and your question if you asked one */
export function firstMessage(report, question = "") {
  const q = question.trim();
  return `Please look at this workout from my gym app and give me feedback.${q ? `\n\nMy question: ${q}` : ""}\n\n${report}`;
}

/** Everything in one text, for the Claude app (which doesn't get the instructions separately) */
export const forClaudeApp = (report, question = "") => `${INSTRUCTIONS}\n\n---\n\n${firstMessage(report, question)}`;

/** Ask Claude. messages: [{role, content}] -> the answer's text. Throws an Error with a message to show. */
export async function askClaude(apiKey, messages, { signal, fetchFn = fetch } = {}) {
  let res;
  try {
    res = await fetchFn(API_URL, {
      method: "POST", signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01",
        // the key is the user's own and stays on their phone, so the browser may call the API directly
        "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: INSTRUCTIONS, messages }),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new Error("No connection: Claude needs the internet. Try again when you have a signal.");
  }
  let body = null;
  try { body = await res.json(); } catch { /* below */ }
  if (!res.ok) throw new Error(errorText(res.status, body));
  const text = (body?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
  if (!text) throw new Error("Claude didn't answer. Try again.");
  return text;
}

/** An API error as something to show */
export function errorText(status, body) {
  const msg = body?.error?.message || "";
  if (status === 401 || status === 403) return "The API key doesn't work. Check it in Settings › Claude.";
  if (/credit balance/i.test(msg)) return "Your Anthropic account is out of credit: add some at console.anthropic.com › Billing.";
  if (status === 429) return "Too many questions at once: try again in a minute.";
  if (status === 529 || status >= 500) return "Claude is busy right now: try again in a minute.";
  return `Claude couldn't answer (${status}${msg ? `: ${msg}` : ""}).`;
}

// ---------------------------------------------------------------------------
// The answer, as blocks to show: headings, paragraphs and lists, with **bold**
// ---------------------------------------------------------------------------
/** "a **b** c" -> [{text: "a "}, {text: "b", bold: true}, {text: " c"}] */
export function inline(text) {
  const out = [];
  const rx = /\*\*(.+?)\*\*|__(.+?)__/g;
  let at = 0, m;
  while ((m = rx.exec(text))) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: m[1] ?? m[2], bold: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out.map((p) => ({ ...p, text: p.text.replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1$2").replace(/`([^`]+)`/g, "$1") }));
}

/** Markdown-ish text -> [{type: "h"|"p"|"ul"|"ol", text | items}] */
export function blocks(md) {
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push({ type: "p", text: para.join(" ") }); para = []; } };
  const list = (type, text) => {
    const last = out.at(-1);
    if (!para.length && last?.type === type) last.items.push(text);
    else { flush(); out.push({ type, items: [text] }); }
  };
  for (const raw of String(md).split("\n")) {
    const line = raw.trim();
    let m;
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); continue; }
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { flush(); out.push({ type: "h", text: m[1].replace(/\*\*/g, "") }); }
    else if ((m = line.match(/^[-*•]\s+(.*)$/))) list("ul", m[1]);
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) list("ol", m[1]);
    else if (/^\s{2,}\S/.test(raw) && out.at(-1)?.items && !para.length) { const l = out.at(-1).items; l[l.length - 1] += ` ${line}`; }
    else para.push(line);
  }
  flush();
  return out;
}
