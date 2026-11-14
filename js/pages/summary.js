// The summary after a workout (and in History): the total time, the totals, how it went against the last
// time you did this workout, new personal records, and each exercise against its last time.

import { h, s, icon, chip, darkStatusBar } from "../ui.js";
import { store } from "../store.js";
import { compareSession, clock, fmtDuration, fmtVolume, fmtNum, longDate, parseDay, timeOfDay, relDay, MINUS, NBSP,
  sessionStats, shortDate, fmtAxisKg } from "../core.js";
import { barChart } from "../charts.js";
import { setsLine, noteText } from "./common.js";
import { openCoach } from "./coach.js";
import { sessionReport } from "../coach.js";

const FEELS = [[1, "😮‍💨", "Hard"], [2, "🙂", "Good"], [3, "💪", "Great"]];

const signed = (v, fmt = (x) => fmtNum(x)) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `${MINUS}${fmt(-v)}` : "Same");
const tone = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");

function statTile(label, value, unit = "") {
  return h("div", { class: "card stat" }, h("div", { class: "caption" }, label),
    h("div", { class: "stat-value" }, value, unit ? h("small", null, unit) : null));
}

/** The summary's parts. opts: {fresh: just finished, onFeel(n), onNotes(text)} */
export function summaryContent(data, session, { fresh = false, onFeel = null, onNotes = null } = {}) {
  const c = compareSession(data, session);
  const st = c.now;
  const d = parseDay(session.date);
  const parts = [];

  parts.push(h("div", { class: "sum-hero" },
    fresh ? s("svg", { class: "sum-check", viewBox: "0 0 88 88" }, s("circle", { cx: 44, cy: 44, r: 40 }), s("path", { d: "M27 45.5l11.5 11.5L62 33" })) : null,
    h("div", { class: "sum-title" }, fresh ? "Workout complete" : session.name),
    h("div", { class: "sum-sub" }, `${fresh ? `${session.name} · ` : ""}${longDate(d)} · ${timeOfDay(session.start)}–${timeOfDay(session.end)}`),
    h("div", { class: "sum-time num" }, clock(session.dur * 1000)),
    h("div", { class: "sum-time-label" }, "Total time")));

  parts.push(h("div", { class: "stats" },
    statTile("Volume", fmtNum(st.volume), `${NBSP}kg`),
    statTile("Sets", fmtNum(st.sets)),
    statTile("Reps", fmtNum(st.reps)),
    statTile("Exercises", fmtNum(st.exercises))));

  // against the last time
  if (c.prev) {
    const b = c.before;
    const rows = [
      ["Time", fmtDuration(st.dur), fmtDuration(b.dur), c.durDiff === 0 ? chip("Same", "flat") : chip(`${c.durDiff > 0 ? "+" : MINUS}${fmtDuration(Math.abs(c.durDiff))}`, "flat")],
      ["Volume", fmtVolume(st.volume), fmtVolume(b.volume), c.volumePct === null ? null : chip(c.volumePct === 0 ? "Same" : `${signed(c.volumePct, (x) => String(x))}${NBSP}%`, tone(c.volumePct))],
      ["Sets", fmtNum(st.sets), fmtNum(b.sets), chip(signed(c.setsDiff), tone(c.setsDiff))],
    ];
    const improved = c.exercises.filter((x) => x.change.dir === "up").length;
    const compared = c.exercises.filter((x) => x.change.dir !== "new").length;
    parts.push(h("div", { class: "card" },
      h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Against last time"), h("span", { class: "muted" }, relDay(c.prev.date))),
      rows.map(([label, now, before, ch]) => h("div", { class: "cmp-row" },
        h("span", { class: "cmp-label" }, label), h("span", { class: "cmp-values num" }, `${now} vs ${before}`), ch)),
      compared ? h("div", { class: "cmp-row" }, h("span", { class: "cmp-label" }, "Exercises better than last time"),
        chip(`${improved} of ${compared}`, improved ? "up" : "flat")) : null));
  } else {
    parts.push(h("div", { class: "card" }, h("div", { class: "card-title" }, `Your first ${session.name}`),
      h("div", { class: "muted", style: { marginTop: "4px", lineHeight: "1.4" } }, "Next time, this is where you'll see how it went against today.")));
  }

  // records
  if (c.records.length) {
    parts.push(h("div", { class: "card", style: { padding: "6px 0" } },
      h("div", { class: "card-head", style: { padding: "10px 16px 0", marginBottom: "2px" } },
        h("div", { class: "card-title" }, c.records.length === 1 ? "New personal record" : `${c.records.length} new personal records`), icon("trophy", 22, "text-gold")),
      c.records.map((r) => h("div", { class: "pr-row" }, h("span", { class: "pr-icon" }, icon("trophy", 19)),
        h("span", { class: "pr-text" }, h("div", { class: "pr-title" }, r.name), h("div", { class: "pr-sub" }, `${r.label}${r.before ? ` · was ${r.before}` : ""}`)),
        h("span", { class: "pr-value" }, r.value)))));
  }

  // each exercise
  parts.push(h("div", { class: "card" },
    h("div", { class: "card-title", style: { marginBottom: "4px" } }, "Exercises"),
    c.exercises.map((x) => h("div", { class: "sx-row" },
      h("div", { class: "sx-top" }, h("span", { class: "sx-name" }, x.name),
        x.records.length ? icon("trophy", 17, "text-gold") : null,
        chip(x.change.text, x.change.dir === "up" ? "up" : x.change.dir === "down" ? "down" : x.change.dir === "new" ? "new" : "flat")),
      h("div", { class: "sx-sets num" }, setsLine(data, x.entry)),
      x.last ? h("div", { class: "sx-before num" }, `${relDay(x.last.session.date)}: ${setsLine(data, x.last.entry)}`) : null,
      x.entry.note ? noteText(x.entry.note) : null))));

  // this workout over time
  const same = data.sessions.filter((x) => x.start <= session.start && (session.workout ? x.workout === session.workout : x.name === session.name)).slice(-8);
  if (same.length >= 2) {
    const items = same.map((x) => {
      const v = sessionStats(x).volume;
      return { label: shortDate(parseDay(x.date)).slice(4), value: v, muted: x.id !== session.id,
        tip: { value: fmtVolume(v), title: shortDate(parseDay(x.date)), sub: fmtDuration(x.dur) } };
    });
    parts.push(h("div", { class: "card chart-card" },
      h("div", null, h("div", { class: "card-title" }, `Volume, your last ${same.length} ${session.name} workouts`),
        h("div", { class: "muted", style: { fontSize: "13px", marginTop: "2px" } }, "Kilos lifted in each (weight × reps, all sets)")),
      barChart(items, { height: 150, format: fmtAxisKg, ariaLabel: "Volume of each workout" })));
  }

  // how it felt
  if (onFeel || onNotes) {
    let feel = session.feel || null;
    const row = h("div", { class: "feel-row" });
    const drawFeel = () => row.replaceChildren(...FEELS.map(([n, emoji, text]) => h("button", { type: "button", class: `feel ${feel === n ? "on" : ""}`,
      onclick: () => { feel = feel === n ? null : n; drawFeel(); onFeel?.(feel); } }, h("span", { class: "feel-emoji" }, emoji), text)));
    drawFeel();
    const notes = h("textarea", { class: "note-input", placeholder: "Notes: how it went, what to change next time…", rows: 3 });
    notes.value = session.notes || "";
    notes.addEventListener("input", () => onNotes?.(notes.value));
    parts.push(h("div", { class: "card" }, h("div", { class: "card-title", style: { marginBottom: "10px" } }, "How did it feel?"), row));
    parts.push(h("div", { class: "card note-card" }, notes));
  } else if (session.notes) {
    parts.push(h("div", { class: "card" }, h("div", { class: "caption" }, "Notes"), h("div", { style: { marginTop: "6px", whiteSpace: "pre-wrap", lineHeight: "1.45" } }, session.notes)));
  }
  return parts;
}

/** Full screen, right after finishing */
export function showSummary(session, { fresh = false } = {}) {
  const wrap = h("div", { class: "summary dark-scope", role: "dialog", "aria-modal": "true", "aria-label": "Workout summary" });
  const body = h("div", { class: "sum-body" });
  let feel = session.feel || null, notes = session.notes || "";
  const done = () => {
    if (feel !== (session.feel || null) || notes.trim() !== (session.notes || "")) {
      const cur = store.data.sessions.find((x) => x.id === session.id) || session;
      store.saveSession({ ...cur, feel: feel || undefined, notes: notes.trim() || undefined });
    }
    wrap.classList.remove("open");
    document.documentElement.classList.remove("locked");
    darkStatusBar(false);
    setTimeout(() => wrap.remove(), 320);
    if (store.needsTap) store.syncFromTap();      // this tap can sign in again, so the workout reaches the cloud
    store.emit();
  };
  body.append(...summaryContent(store.data, session, { fresh, onFeel: (f) => { feel = f; }, onNotes: (t) => { notes = t; } }),
    h("button", { type: "button", class: "btn gray wide sum-claude", onclick: () => openCoach({ id: `s:${session.id}`, title: session.name,
      report: () => sessionReport(store.data, { ...(store.data.sessions.find((x) => x.id === session.id) || session), feel: feel || undefined, notes: notes.trim() || undefined }) }) },
      icon("sparkle", 18), "Ask Claude how it went"),
    h("button", { type: "button", class: "btn primary wide big", onclick: done }, "Done"));
  wrap.appendChild(body);
  document.body.appendChild(wrap);
  document.documentElement.classList.add("locked");
  darkStatusBar(true);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
}
