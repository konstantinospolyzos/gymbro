// Ask Claude about a workout: in GymBro with your own Anthropic API key (the answer and follow-ups right
// here, kept for next time), or without one, handed to the Claude app (which a Claude plan covers).

import { h, icon, sheet, group, footer, actionRow, toast, copyText, askText, alertBox, switchRow, chip } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { lsGet, lsSet, lsDel } from "../cloud/common.js";
import { key } from "../profiles.js";
import { askClaude, firstMessage, forClaudeApp, blocks, inline, weekReport, planMessage, forClaudeAppPlan, askClaudePlan, planFromText, proposal,
  planSignature } from "../coach.js";
import { shortDate, repRange, fmtRest, fmtSecs, timeUnit, WEEKDAYS, WEEK_ORDER } from "../core.js";
import { NO, workoutTile } from "./common.js";

// the key is the phone's (every profile here uses it); the answers are each profile's own
const KEY_API = "gym.claudeKey";
const keepKey = () => key("claude");
const KEEP = 30;

export const apiKey = () => lsGet(KEY_API, "") || "";
export function setApiKey(k) { if (k) lsSet(KEY_API, k.trim()); else lsDel(KEY_API); }

const threads = () => lsGet(keepKey(), {}) || {};
const loadThread = (id) => threads()[id] || null;
function saveThread(id, t) {
  const all = threads();
  if (t) all[id] = t; else delete all[id];
  // only the latest few
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP);
  lsSet(keepKey(), Object.fromEntries(keep));
}

/** Claude's answer as headings, paragraphs and lists */
function answerView(text) {
  const runs = (t) => inline(t).map((p) => (p.bold ? h("b", null, p.text) : p.text));
  return h("div", { class: "coach-answer" }, blocks(text).map((b) => {
    if (b.type === "h") return h("div", { class: "coach-h" }, b.text);
    if (b.type === "p") return h("p", null, runs(b.text));
    return h(b.type, null, b.items.map((it) => h("li", null, runs(it))));
  }));
}

/** Add or change the API key: resolves true when there's one */
export async function editApiKey() {
  const k = await askText({ title: "Anthropic API key", value: apiKey(), placeholder: "sk-ant-…", ok: "Save", mode: "text",
    message: "From console.anthropic.com › API keys. It stays on this phone." });
  if (!k) return Boolean(apiKey());
  if (!/^sk-ant-/.test(k.trim())) {
    const ok = await alertBox({ title: "That doesn't look like a key", message: "Anthropic API keys start with sk-ant-. Save it anyway?",
      buttons: [NO, { text: "Save", value: true, style: "bold" }] });
    if (!ok) return Boolean(apiKey());
  }
  setApiKey(k);
  toast("Key saved");
  return true;
}

/** A sheet to read what Claude is told */
function showReport(text) {
  sheet({ title: "What Claude sees", right: { text: "Done", bold: true, onClick: (a) => a.close() },
    body: h("div", { class: "form" },
      h("div", { class: "group" }, h("pre", { class: "coach-report" }, text)),
      footer("Your workouts, plan and notes as GymBro sends them: no name, email or sign-in."),
      group(actionRow("copy", "Copy", async () => toast((await copyText(text)) ? "Copied" : "Couldn't copy")))) });
}

/** Hand it to the Claude app: the share sheet (pick Claude), or copy it and open claude.ai */
async function toClaudeApp(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (err) { if (err?.name === "AbortError") return; }
  }
  const ok = await copyText(text);
  await alertBox({ title: ok ? "Copied for Claude" : "Couldn't copy", message: ok ? "Paste it into a new chat in the Claude app or at claude.ai." : "Use “What Claude sees” to copy it." });
  if (ok) window.open("https://claude.ai/new", "_blank", "noopener");
}

/**
 * Ask Claude about a workout.
 * id: where its answers are kept ("w:<workout>" or "s:<session>"); title: what it's about;
 * report(): what Claude is told, worked out when asked (so a plan's unsaved edits are in it).
 */
export function openCoach({ id, title, report }) {
  const body = h("div", { class: "form coach" });
  let thread = loadThread(id);          // {at, msgs: [{role, content, show}]}
  let busy = null;                      // the question being asked (an AbortController)
  let error = "";

  const question = h("textarea", { class: "note-input coach-input", rows: 2, maxlength: 1000 });
  const send = async () => {
    const k = apiKey();
    if (!k) return;
    const q = question.value.trim();
    if (thread && !q) { question.focus(); return; }
    const msgs = thread ? [...thread.msgs, { role: "user", content: q, show: q }]
      : [{ role: "user", content: firstMessage(report(), q), show: q }];
    busy = new AbortController();
    error = "";
    draw(msgs);
    try {
      const answer = await askClaude(k, msgs.map(({ role, content }) => ({ role, content })), { signal: busy.signal });
      thread = { at: Date.now(), msgs: [...msgs, { role: "assistant", content: answer }] };
      saveThread(id, thread);
      question.value = "";
    } catch (err) {
      if (err?.name === "AbortError") return;
      error = err.message;
    }
    busy = null;
    draw();
  };

  function draw(pending = null) {
    const k = apiKey();
    const msgs = pending || thread?.msgs || [];
    const parts = [];
    if (!msgs.length) {
      parts.push(h("div", { class: "card coach-intro" }, h("span", { class: "coach-badge" }, icon("sparkle", 22)),
        h("div", null, h("div", { class: "card-title" }, `Feedback on ${title}`),
          h("div", { class: "muted" }, "Claude looks at it with your whole week and the last times you did each exercise, then says what to keep and what to change."))));
    } else {
      if (thread && !pending) parts.push(h("div", { class: "caption coach-when" }, `Feedback from ${shortDate(new Date(thread.at))}`));
      msgs.forEach((m) => {
        if (m.role === "assistant") parts.push(h("div", { class: "card" }, answerView(m.content)));
        else if (m.show) parts.push(h("div", { class: "coach-q" }, m.show));
      });
    }
    if (busy) parts.push(h("div", { class: "card coach-wait" }, icon("sparkle", 20, "coach-spin"), "Claude is looking at your workout…"));
    if (error) parts.push(h("div", { class: "card coach-error" }, error));

    if (k) {
      question.placeholder = thread ? "Ask a follow-up…" : "Anything to ask? (optional) For example: my lower back is tired after this one";
      parts.push(h("div", { class: "group" }, question),
        h("button", { type: "button", class: "btn primary wide", disabled: Boolean(busy), onclick: send },
          icon("sparkle", 18), thread ? "Send" : error ? "Try again" : "Get feedback"));
    } else {
      question.placeholder = "Anything to ask? (optional)";
      parts.push(h("div", { class: "group" }, question),
        h("button", { type: "button", class: "btn primary wide", onclick: () => toClaudeApp(forClaudeApp(report(), question.value)) },
          icon("upload", 18), "Open in the Claude app"),
        footer("The share sheet opens: pick Claude, and it gets your workout, your week and the last times, ready to send."),
        group(actionRow("sparkle", "Get the answer here in GymBro", async () => { if (await editApiKey()) draw(); },
          { detail: "With an Anthropic API key: a few cents an answer" })));
    }
    parts.push(group(actionRow("doc", "What Claude sees", () => showReport(thread?.msgs[0]?.content || firstMessage(report(), question.value))),
      thread && !busy ? actionRow("trash", "Start over", () => { thread = null; saveThread(id, null); error = ""; draw(); }, { tone: "danger" }) : null));
    body.replaceChildren(...parts.filter(Boolean));
  }

  draw();
  sheet({ title: "Ask Claude", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body,
    onClose: () => busy?.abort() });
}

// ---------------------------------------------------------------------------
// The whole week: Claude proposes a better plan; you see each workout's changes and choose what to use
// ---------------------------------------------------------------------------
const planKey = () => key("claudePlan");

function itemSub(it, ex) {
  const t = ex?.kind === "time" ? `${it.sets} × ${fmtSecs(it.secs ?? 60, timeUnit(ex))}` : `${it.sets} × ${repRange(it)}`;
  return `${t}${it.rest != null ? ` · rest ${fmtRest(it.rest)}` : ""}`;
}

/** One workout's changes: its new list (new and changed marked), what's out, and a switch to use it */
function changeCard(ch, on, onToggle, done) {
  const exMap = exerciseMap(store.data);
  const days = WEEK_ORDER.filter((d) => store.data.schedule[String(d)] === ch.old.id).map((d) => WEEKDAYS[d].slice(0, 3)).join(", ");
  const tags = [ch.moved ? "new order" : null, ch.restChanged ? `rest ${fmtRest(ch.next.rest)}` : null, ch.supersets ? "supersets" : null].filter(Boolean);
  return h("div", { class: `card plan-change ${on ? "" : "off"}` },
    h("div", { class: "plan-change-head" }, workoutTile(ch.old, 38),
      h("div", null, h("div", { class: "card-title" }, ch.old.name), h("div", { class: "muted plan-change-sub" }, [days, ...tags].filter(Boolean).join(" · ")))),
    ch.why ? h("p", { class: "plan-why" }, ch.why) : null,
    h("ol", { class: "plan-items" }, ch.next.items.map((it) => {
      const ex = exMap.get(it.ex);
      const added = ch.added.includes(it.ex), changed = ch.changed.find((c) => c.ex === it.ex);
      return h("li", { class: added ? "added" : "" },
        h("span", { class: "plan-item-name" }, ex?.name || it.ex, added ? chip("New", "up", "small") : null),
        h("span", { class: "plan-item-sub" }, itemSub(it, ex), changed ? h("span", { class: "plan-was" }, ` (was ${changed.from})`) : null));
    })),
    ch.removed.length ? h("div", { class: "plan-out" }, `Out: ${ch.removed.join(", ")}`) : null,
    done ? null : h("div", { class: "group plan-use" }, switchRow("Use these changes", on, onToggle)));
}

/** Ask Claude to check the whole week, then apply the changes you want */
export function openPlanCoach() {
  const body = h("div", { class: "form coach" });
  let saved = lsGet(planKey(), null);    // {at, sig, msgs, toolId, asked, prop, applied}
  let picked = new Set(saved?.prop?.changes.map((c) => c.old.id) || []);
  let busy = null, error = "";
  const question = h("textarea", { class: "note-input coach-input", rows: 2, maxlength: 1000 });
  const keep = (v) => { saved = v; if (v) lsSet(planKey(), v); else lsDel(planKey()); };
  const got = (input, extra) => {
    const prop = proposal(store.data, input);
    keep({ at: Date.now(), sig: planSignature(store.data), prop, applied: null, ...extra });
    picked = new Set(prop.changes.map((c) => c.old.id));
    question.value = "";
  };

  const send = async () => {
    const k = apiKey();
    const q = question.value.trim();
    const follow = saved?.msgs?.length && saved.toolId && !saved.applied;
    if (follow && !q) { question.focus(); return; }
    const msgs = follow
      ? [...saved.msgs, { role: "user", content: [{ type: "tool_result", tool_use_id: saved.toolId, content: "Shown to the lifter. Nothing applied yet." }, { type: "text", text: q }] }]
      : [{ role: "user", content: planMessage(weekReport(store.data), q) }];
    busy = new AbortController(); error = "";
    draw();
    try {
      const r = await askClaudePlan(k, msgs, { signal: busy.signal });
      got(r.input, { msgs: [...msgs, { role: "assistant", content: r.content }], toolId: r.toolId, asked: [...(follow ? saved.asked || [] : []), q].filter(Boolean) });
    } catch (err) {
      if (err?.name === "AbortError") return;
      error = err.message;
    }
    busy = null;
    draw();
  };

  const paste = () => {
    const box = h("textarea", { class: "note-input", rows: 10, placeholder: "Paste Claude's whole answer here (with the code block at its end)" });
    const api = sheet({ title: "Claude's answer", left: { text: "Cancel" }, right: { text: "Review", bold: true, onClick: async (a) => {
      const input = planFromText(box.value);
      if (!input) { await alertBox({ title: "No plan in that text", message: "Copy Claude's whole answer, including the code block at the end, and paste it here." }); return; }
      got(input, { msgs: [], asked: [] });
      a.close();
      draw();
    } }, body: h("div", { class: "form" }, h("div", { class: "group" }, box),
      navigator.clipboard?.readText ? h("button", { type: "button", class: "btn tinted wide", style: { marginTop: "12px" }, onclick: async () => {
        try { box.value = await navigator.clipboard.readText(); } catch { toast("Tap and hold in the box, then Paste"); }
      } }, "Paste from the clipboard") : null) });
    setTimeout(() => box.focus(), 350);
    return api;
  };

  const apply = () => {
    const chosen = saved.prop.changes.filter((c) => picked.has(c.old.id));
    for (const c of chosen) store.saveWorkout(c.next);
    keep({ ...saved, applied: { at: Date.now(), ids: chosen.map((c) => c.old.id) }, sig: planSignature(store.data) });
    toast(`${chosen.length === 1 ? chosen[0].old.name : `${chosen.length} workouts`} updated`);
    draw();
  };
  const undo = () => {
    for (const c of saved.prop.changes) if (saved.applied.ids.includes(c.old.id)) store.saveWorkout(c.old);
    keep({ ...saved, applied: null, sig: planSignature(store.data) });
    toast("Back to your plan as it was");
    draw();
  };

  function draw() {
    const k = apiKey();
    const parts = [];
    const p = saved?.prop;
    if (!p) {
      parts.push(h("div", { class: "card coach-intro" }, h("span", { class: "coach-badge" }, icon("sparkle", 22)),
        h("div", null, h("div", { class: "card-title" }, "Check my week"),
          h("div", { class: "muted" }, "Claude checks all your workouts together: the exercises, their order, sets, reps and rest, and the sets each muscle gets. You see every change and choose what to use."))));
    } else {
      parts.push(h("div", { class: "caption coach-when" }, `Claude's plan from ${shortDate(new Date(saved.at))}`));
      for (const q of saved.asked || []) parts.push(h("div", { class: "coach-q" }, q));
      parts.push(h("div", { class: "card" }, answerView([p.verdict, p.notes].filter(Boolean).join("\n\n") || "Here's the plan.")));
      const stale = !saved.applied && planSignature(store.data) !== saved.sig;
      if (saved.applied) {
        parts.push(h("div", { class: "card plan-done" }, icon("checkBold", 20), h("span", null, "Your plan is updated"),
          h("button", { type: "button", class: "btn plain", onclick: undo }, "Undo")));
      } else if (stale) {
        parts.push(h("div", { class: "card coach-error" }, "Your plan has changed since Claude looked at it. Ask again for a plan that fits it."));
      }
      if (!p.changes.length) parts.push(h("div", { class: "card" }, h("div", { class: "card-title" }, "No changes"), h("div", { class: "muted", style: { marginTop: "4px" } }, "Claude would keep your week as it is.")));
      const shown = saved.applied ? p.changes.filter((c) => saved.applied.ids.includes(c.old.id)) : p.changes;
      for (const ch of shown) parts.push(changeCard(ch, saved.applied || picked.has(ch.old.id), (v) => { if (v) picked.add(ch.old.id); else picked.delete(ch.old.id); draw(); }, Boolean(saved.applied) || stale));
      if (p.same.length) parts.push(footer(`No changes: ${p.same.join(", ")}.`));
      if (!saved.applied && !stale && p.changes.length) {
        const n = p.changes.filter((c) => picked.has(c.old.id)).length;
        parts.push(h("button", { type: "button", class: "btn primary wide big", disabled: !n, onclick: apply },
          n ? `Use the changes to ${n === 1 ? p.changes.find((c) => picked.has(c.old.id)).old.name : `${n} workouts`}` : "Nothing picked"),
          footer("Your days stay as they are, and each exercise you keep starts from your last weights. You can undo this."));
      }
    }
    if (busy) parts.push(h("div", { class: "card coach-wait" }, icon("sparkle", 20, "coach-spin"), "Claude is checking your week… (up to a minute)"));
    if (error) parts.push(h("div", { class: "card coach-error" }, error));

    const follow = p && saved.msgs?.length && !saved.applied && planSignature(store.data) === saved.sig;
    if (k) {
      question.placeholder = follow ? "Ask for something different… For example: keep the walking lunges" : "Anything Claude should know? (optional) For example: 75 minutes at most, sore knee";
      parts.push(h("div", { class: "group" }, question),
        h("button", { type: "button", class: `btn ${p && !follow ? "tinted" : "primary"} wide`, disabled: Boolean(busy), onclick: send },
          icon("sparkle", 18), follow ? "Ask for changes" : p ? "Check my week again" : error ? "Try again" : "Check my week"));
    } else {
      question.placeholder = "Anything Claude should know? (optional)";
      parts.push(h("div", { class: "group" }, question),
        h("button", { type: "button", class: "btn primary wide", onclick: () => toClaudeApp(forClaudeAppPlan(weekReport(store.data), question.value)) },
          icon("upload", 18), "Open in the Claude app"),
        footer("Claude answers in its app and ends with the new plan in a code block. Copy its whole answer, come back, and paste it here to see the changes."),
        group(actionRow("doc", "Paste Claude's answer", paste, { detail: "Review the changes, then choose what to use" }),
          actionRow("sparkle", "Get the plan here in GymBro", async () => { if (await editApiKey()) draw(); }, { detail: "With an Anthropic API key: a few cents each time" })));
    }
    parts.push(group(actionRow("doc", "What Claude sees", () => showReport(planMessage(weekReport(store.data), question.value))),
      p && !busy ? actionRow("trash", "Start over", () => { keep(null); error = ""; draw(); }, { tone: "danger" }) : null));
    body.replaceChildren(...parts.filter(Boolean));
  }

  draw();
  sheet({ title: "Check my week", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body, onClose: () => busy?.abort() });
}
