// Ask Claude about a workout: in GymBro with your own Anthropic API key (the answer and follow-ups right
// here, kept for next time), or without one, handed to the Claude app (which a Claude plan covers).

import { h, icon, sheet, group, footer, actionRow, toast, copyText, askText, alertBox } from "../ui.js";
import { lsGet, lsSet, lsDel } from "../cloud/common.js";
import { key } from "../profiles.js";
import { askClaude, firstMessage, forClaudeApp, blocks, inline } from "../coach.js";
import { shortDate } from "../core.js";
import { NO } from "./common.js";

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
