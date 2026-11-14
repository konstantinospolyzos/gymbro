// History: a calendar with your gym days, every logged workout (newest first), each one's summary,
// changing a logged workout, and logging one you did without the app.

import { h, icon, sheet, group, caption, footer, alertBox, actionSheet, toast, selectOnFocus, actionRow } from "../ui.js";
import { store } from "../store.js";
import { uid, exerciseMap } from "../data.js";
import { today, isoDay, parseDay, addDays, startOfWeek, monthTitle, MONTHS, WEEKDAYS, plural, fmtDuration, fmtVolume, monthTotals,
  shortDate, longDate, fmtKg, parseNum, parseSecs, timeUnit, timeOfDay } from "../core.js";
import { prefill } from "../workout.js";
import { sessionCard, chooseWorkout, emptyState, NO } from "./common.js";
import { summaryContent } from "./summary.js";
import { openExercisePicker } from "./editors.js";
import { openCoach } from "./coach.js";
import { sessionReport } from "../coach.js";

let calMonth = null;          // the month the calendar shows (its first day)
let shown = 30;               // workouts in the list before "Show more"

function calendarCard(data) {
  const now = today(), todayIso = isoDay(now);
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const first = calMonth;
  const byDay = new Map();
  for (const s of data.sessions) { if (!byDay.has(s.date)) byDay.set(s.date, []); byDay.get(s.date).push(s); }
  const gridStart = startOfWeek(first);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    if (i >= 35 && d.getMonth() !== first.getMonth()) break;
    const iso = isoDay(d);
    const sess = byDay.get(iso) || [];
    const out = d.getMonth() !== first.getMonth();
    const cls = ["cal-day", out ? "out" : "", sess.length ? "trained" : "", iso === todayIso ? "today" : "", iso > todayIso ? "future" : ""].join(" ");
    cells.push(h("button", { type: "button", class: cls, disabled: out || null, "aria-label": `${longDate(d)}${sess.length ? `: ${sess.map((s) => s.name).join(", ")}` : ""}`,
      onclick: () => dayTapped(iso, sess) },
      h("span", { class: `cal-num ${sess.length ? `c-${sess[0].color}` : ""}` }, String(d.getDate())),
      h("span", { class: "cal-dots" }, sess.slice(1, 3).map((s) => h("span", { class: `dot c-${s.color}` })))));
  }
  const t = monthTotals(data, first.getFullYear(), first.getMonth());
  const move = (by) => { calMonth = new Date(first.getFullYear(), first.getMonth() + by, 1); store.emit(); };
  const atNow = first.getFullYear() === now.getFullYear() && first.getMonth() === now.getMonth();
  return h("div", { class: "card" },
    h("div", { class: "cal-head" }, h("div", { class: "cal-title" }, monthTitle(first)),
      h("div", { class: "cal-nav" },
        h("button", { type: "button", class: "icon-btn", "aria-label": "Previous month", onclick: () => move(-1) }, icon("chevronLeft", 20)),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Next month", disabled: atNow || null, style: atNow ? { opacity: "0.3" } : null, onclick: () => move(1) }, icon("chevron", 20)))),
    h("div", { class: "cal-grid" }, [1, 2, 3, 4, 5, 6, 0].map((d) => h("div", { class: "cal-dow" }, WEEKDAYS[d].slice(0, 1))), cells),
    h("div", { class: "cal-foot" }, h("span", null, h("b", null, String(t.count)), ` workout${t.count !== 1 ? "s" : ""}`),
      h("span", null, h("b", null, fmtDuration(t.secs || 0))), h("span", null, h("b", null, fmtVolume(t.volume)))));
}

async function dayTapped(iso, sessions) {
  if (sessions.length === 1) return openSessionDetail(sessions[0]);
  if (sessions.length > 1) {
    const id = await actionSheet({ title: longDate(parseDay(iso)), actions: sessions.map((s) => ({ text: s.name, value: s.id, color: s.color, detail: `${timeOfDay(s.start)} · ${fmtDuration(s.dur)}` })) });
    const s = sessions.find((x) => x.id === id);
    if (s) openSessionDetail(s);
    return;
  }
  if (iso > isoDay(today())) return;
  const v = await actionSheet({ title: longDate(parseDay(iso)), message: "No workout logged this day.", actions: [{ text: "Log a workout for this day", value: "log" }] });
  if (v === "log") openSessionEditor(null, { date: iso });
}

export function renderHistory() {
  const data = store.data;
  const n = data.sessions.length;
  if (!n) {
    return ["Your logged workouts",
      emptyState("history", "No workouts yet", "Finish a workout and it shows up here with every set. You can also log one you did without the app.",
        h("button", { type: "button", class: "btn tinted wide", onclick: () => openSessionEditor(null) }, icon("plus", 18), "Log a past workout"))];
  }
  const subtitle = `${plural(n, "workout")} since ${monthTitle(parseDay(data.sessions[0].date))}`;
  const list = [];
  const newest = [...data.sessions].reverse();
  let month = null, groupEl = null;
  for (const s of newest.slice(0, shown)) {
    const m = s.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const [y, mm] = m.split("-").map(Number);
      const t = monthTotals(data, y, mm - 1);
      groupEl = h("div", { class: "sess-list" });
      list.push(h("div", { class: "month-head" }, h("span", { class: "month-title" }, `${MONTHS[mm - 1]}${y !== today().getFullYear() ? ` ${y}` : ""}`),
        h("span", { class: "month-sum" }, `${plural(t.count, "workout")} · ${fmtDuration(t.secs)}`)), groupEl);
    }
    groupEl.appendChild(sessionCard(data, s, () => openSessionDetail(s)));
  }
  if (n > shown) list.push(h("button", { type: "button", class: "btn plain", onclick: () => { shown += 50; store.emit(); } }, `Show more (${n - shown})`));
  return [subtitle, calendarCard(data), ...list];
}

// ---------------------------------------------------------------------------
// One logged workout
// ---------------------------------------------------------------------------
export function openSessionDetail(session) {
  let feel = session.feel || null, notes = session.notes || "";
  const body = h("div", { class: "sheet-stack" });
  body.append(...summaryContent(store.data, session, { onFeel: (f) => { feel = f; }, onNotes: (t) => { notes = t; } }),
    h("div", { class: "group", style: { marginTop: "6px" } },
      actionRow("sparkle", "Ask Claude how it went", () => {
        const cur = store.data.sessions.find((x) => x.id === session.id) || session;
        openCoach({ id: `s:${session.id}`, title: `${session.name} on ${shortDate(parseDay(session.date))}`,
          report: () => sessionReport(store.data, { ...cur, feel: feel || undefined, notes: notes.trim() || undefined }) });
      }, { detail: "Feedback on the sets you did, against the plan and the last times" }),
      h("button", { type: "button", class: "action-row", onclick: () => { api.close(); openSessionEditor(store.data.sessions.find((x) => x.id === session.id) || session); } },
        icon("edit", 20, "row-icon"), h("span", { class: "action-text" }, "Change sets, date or time"), icon("chevron", 15, "chev"))),
    h("button", { type: "button", class: "btn destructive-row", onclick: async () => {
      const ok = await alertBox({ title: `Delete this ${session.name}?`, message: `${longDate(parseDay(session.date))}. It's removed from your history and progress.`,
        buttons: [NO, { text: "Delete", value: true, style: "destructive" }] });
      if (!ok) return;
      store.deleteSession(session.id);
      api.close();
      toast("Workout deleted");
    } }, "Delete workout"));
  const api = sheet({
    title: shortDate(parseDay(session.date)), right: { text: "Done", bold: true, onClick: (a) => a.close() }, body,
    onClose: () => {
      const cur = store.data.sessions.find((x) => x.id === session.id);
      if (cur && (feel !== (cur.feel || null) || notes.trim() !== (cur.notes || ""))) store.saveSession({ ...cur, feel: feel || undefined, notes: notes.trim() || undefined });
    },
  });
}

/** Log a workout you did without the app, or change one: its day, time, length and every set */
export async function openSessionEditor(session = null, { date = null } = {}) {
  const data = store.data;
  const exMap = exerciseMap(data);
  let s;
  if (session) s = structuredClone(session);
  else {
    const choice = await chooseWorkout("Which workout did you do?");
    if (!choice) return;
    const w = choice === "empty" ? null : choice;
    const day = date || isoDay(today());
    const start = new Date(`${day}T18:00:00`).getTime();
    s = { id: uid("s"), date: day, start, end: start + 3600000, dur: 3600, workout: w?.id || null, name: w?.name || "Workout", color: w?.color || "blue", manual: true,
      exercises: w ? w.items.filter((it) => exMap.has(it.ex)).map((it) => {
        const ex = exMap.get(it.ex);
        return { ex: it.ex, name: ex.name, kind: ex.kind, muscle: ex.muscle, sets: Array.from({ length: it.sets }, (_, i) => prefill(data, it.ex, i, it, start)) };
      }) : [] };
  }
  const body = h("div", { class: "form" });
  const dateIn = h("input", { class: "form-input", type: "date", value: s.date, max: isoDay(today()), "aria-label": "Day" });
  const timeIn = h("input", { class: "form-input", type: "time", value: timeOfDay(s.start), "aria-label": "Start time" });
  const durIn = selectOnFocus(h("input", { class: "form-input", type: "text", inputmode: "numeric", value: String(Math.round(s.dur / 60)), "aria-label": "Minutes" }));
  const nameIn = h("input", { class: "form-input", type: "text", value: s.name, "aria-label": "Name" });
  const exWrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" } });

  const drawExercises = () => {
    exWrap.replaceChildren(...s.exercises.map((e, ei) => {
      const ex = exMap.get(e.ex) || exerciseMap(store.data).get(e.ex);
      const kind = ex?.kind || e.kind, unit = timeUnit(ex);
      const rows = e.sets.map((st, si) => {
        const field = (key, value, mode, label) => {
          const el = selectOnFocus(h("input", { class: "set-input", type: "text", inputmode: mode, value, placeholder: label, "aria-label": label }));
          el.addEventListener("input", () => {
            if (key === "w") st.w = parseNum(el.value);
            else if (key === "r") { const n = parseNum(el.value); st.r = n === null ? null : Math.round(n); }
            else { const n = unit === "min" ? parseNum(el.value) : parseSecs(el.value); st.s = n === null ? null : Math.round(unit === "min" ? n * 60 : n); }
          });
          return el;
        };
        const del = h("button", { type: "button", class: "set-check", "aria-label": `Remove set ${si + 1}`, onclick: () => { e.sets.splice(si, 1); drawExercises(); } }, icon("minus", 18));
        return kind === "time"
          ? h("div", { class: "set-row time" }, h("span", { class: "set-num" }, String(si + 1)), h("span", { class: "set-prev" }, unit === "min" ? "minutes" : "seconds"),
            field("s", st.s ? String(unit === "min" ? Math.round((st.s / 60) * 10) / 10 : st.s) : "", unit === "min" ? "decimal" : "numeric", unit), del)
          : h("div", { class: "set-row" }, h("span", { class: "set-num" }, String(si + 1)), h("span", { class: "set-prev" }, ""),
            field("w", st.w ? fmtKg(st.w).replace(/ /g, "") : "", "decimal", kind === "reps" ? "+kg" : "kg"),
            field("r", st.r ? String(st.r) : "", "numeric", "reps"), del);
      });
      return h("div", { class: "ex-card" },
        h("div", { class: "ex-head" }, h("div", { class: "ex-title", style: { flex: "1" } }, ex?.name || e.name),
          h("button", { type: "button", class: "icon-btn danger", "aria-label": `Remove ${ex?.name || "exercise"}`, onclick: () => { s.exercises.splice(ei, 1); drawExercises(); } }, icon("trash", 19))),
        h("div", { class: "sets" }, h("div", { class: `set-head ${kind === "time" ? "time" : ""}` },
          (kind === "time" ? ["Set", "", unit === "min" ? "Min" : "Sec", ""] : ["Set", "", kind === "reps" ? "+kg" : "kg", "Reps", ""]).map((c) => h("span", null, c))), rows),
        h("div", { class: "ex-actions" }, h("button", { type: "button", class: "link-btn", onclick: () => {
          const last = e.sets.at(-1);
          e.sets.push(last ? { ...last } : { w: null, r: null, s: null });
          drawExercises();
        } }, icon("plus", 16), "Add set")));
    }), h("button", { type: "button", class: "btn tinted wide", onclick: () => openExercisePicker({ title: "Add exercises", exclude: s.exercises.map((x) => x.ex), onDone: (ids) => {
      const m = exerciseMap(store.data);
      for (const id of ids) { const ex = m.get(id); if (ex) s.exercises.push({ ex: id, name: ex.name, kind: ex.kind, muscle: ex.muscle, sets: [prefill(store.data, id, 0, null, s.start)] }); }
      drawExercises();
    } }) }, icon("plus", 18), "Add exercises"));
  };
  drawExercises();

  body.append(caption("Workout"), group(
    h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Name"), nameIn),
    h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Day"), dateIn),
    h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Started"), timeIn),
    h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Length"), durIn, h("span", { class: "form-unit" }, "min"))),
  footer(session ? "" : "The sets start from what you did last time: change them to what you did that day. Empty sets aren't saved."),
  caption("Exercises"), exWrap);

  sheet({
    title: session ? "Change workout" : "Log a workout",
    left: { text: "Cancel" },
    right: { text: "Save", bold: true, onClick: (a) => {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(dateIn.value) ? dateIn.value : s.date;
      const [hh, mm] = (timeIn.value || "18:00").split(":").map(Number);
      const start = new Date(`${day}T00:00:00`); start.setHours(hh || 0, mm || 0, 0, 0);
      const mins = Math.max(1, Math.round(parseNum(durIn.value) ?? s.dur / 60));
      const exercises = s.exercises.map((e) => {
        const kind = exerciseMap(store.data).get(e.ex)?.kind || e.kind;
        const sets = e.sets.filter((st) => (kind === "time" ? st.s > 0 : st.r > 0))
          .map((st) => (kind === "time" ? { s: st.s } : kind === "reps" ? { w: st.w || null, r: st.r } : { w: st.w || 0, r: st.r }));
        return sets.length ? { ...e, kind, sets } : null;
      }).filter(Boolean);
      if (!exercises.length) { toast("Add at least one set with reps"); return; }
      const clean = { ...s, name: nameIn.value.trim() || s.name, date: day, start: start.getTime(), dur: mins * 60, end: start.getTime() + mins * 60000, exercises };
      store.saveSession(clean);
      a.close();
      toast(session ? "Saved" : `${clean.name} logged for ${shortDate(parseDay(day))}`);
    } },
    body,
  });
}
