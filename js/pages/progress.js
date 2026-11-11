// Progress: how often you train (and your streak), how much you lift week by week, which muscles got
// the work, your newest personal records, and every exercise's best set over time.

import { h, icon, sheet, segmented, chip } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { today, weekly, streak, monthTotals, muscleSplit, recentRecords, exerciseSummaries, exerciseSeries, exerciseHistory, bestsBefore,
  fmtNum, fmtVolume, fmtDuration, fmtAxisKg, kg, plural, relDay, shortDate, parseDay, fmtSecs, timeUnit, NBSP, MINUS, MONTHS, isoDay } from "../core.js";
import { barChart, lineChart, sparkline, hbars } from "../charts.js";
import { emptyState, setsLine } from "./common.js";

let weekMetric = 0;     // workouts, volume, time

function tile(label, value, unit, sub, subTone = "") {
  return h("div", { class: "card stat" }, h("div", { class: "caption" }, label),
    h("div", { class: "stat-value" }, value, unit ? h("small", null, unit) : null),
    sub ? h("div", { class: `stat-sub ${subTone}` }, sub) : null);
}

/** Totals from the 1st of a month up to a day of it (to compare this month so far with the same days last month) */
function totalsUntil(data, year, month, day) {
  const from = isoDay(new Date(year, month, 1)), to = isoDay(new Date(year, month, day));
  const t = { count: 0, secs: 0, volume: 0 };
  for (const s of data.sessions) {
    if (s.date < from || s.date > to) continue;
    t.count += 1; t.secs += s.dur || 0;
    for (const e of s.exercises) if (e.kind !== "time") for (const x of e.sets) t.volume += (x.w || 0) * (x.r || 0);
  }
  return t;
}

/** "+2 vs Oct" with a direction; nothing when there's nothing to compare */
function versus(now, before, prevName, fmt = (x) => String(x)) {
  if (!before) return ["", ""];
  const d = now - before;
  if (Math.abs(d) < 1e-9) return [`Same as ${prevName}`, ""];
  return [`${d > 0 ? "+" : MINUS}${fmt(Math.abs(d))} vs ${prevName}`, d > 0 ? "text-up" : "text-down"];
}


export function renderProgress() {
  const data = store.data;
  if (!data.sessions.length) {
    return ["Your progress, week by week",
      emptyState("progress", "Nothing to show yet", "After your first workout you'll see how often you train, how much you lift and your records here.")];
  }
  const now = today();
  const st = streak(data, now);
  const m = monthTotals(data, now.getFullYear(), now.getMonth());
  const pmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pmDays = new Date(pmDate.getFullYear(), pmDate.getMonth() + 1, 0).getDate();
  const pm = totalsUntil(data, pmDate.getFullYear(), pmDate.getMonth(), Math.min(now.getDate(), pmDays));
  const prevName = `${MONTHS[pmDate.getMonth()].slice(0, 3)} ${now.getDate() <= pmDays ? `1–${Math.min(now.getDate(), pmDays)}` : ""}`.trim();
  const [cSub, cTone] = versus(m.count, pm.count, prevName);
  const [vSub, vTone] = versus(Math.round(m.volume), Math.round(pm.volume), prevName, (x) => `${fmtNum(x)}${NBSP}kg`);
  const avg = m.count ? m.secs / m.count : 0;
  const tiles = h("div", { class: "stats" },
    tile("This week", String(st.thisWeek), ` of ${st.goal}`, st.weeks ? `🔥 ${st.weeks}-week streak` : st.thisWeek >= st.goal ? "Goal reached" : `${st.goal - st.thisWeek} to go`),
    tile(MONTHS[now.getMonth()], String(m.count), m.count === 1 ? " workout" : " workouts", cSub, cTone),
    tile("Lifted this month", fmtNum(Math.round(m.volume)), `${NBSP}kg`, vSub, vTone),
    tile("Average workout", m.count ? String(Math.round(avg / 60)) : "–", m.count ? `${NBSP}min` : "", m.count ? `${fmtDuration(m.secs)} this month` : ""));

  // week by week
  const weeks = weekly(data, 12, now);
  const metrics = [
    { name: "Workouts", value: (w) => w.count, fmt: (v) => String(v), axis: (v) => String(v), goal: st.goal, big: (w) => [String(w.count), w.count === 1 ? " workout" : " workouts"] },
    { name: "Volume", value: (w) => w.volume, fmt: fmtVolume, axis: fmtAxisKg, goal: null, big: (w) => [fmtNum(Math.round(w.volume)), `${NBSP}kg`] },
    { name: "Time", value: (w) => Math.round(w.secs / 60), fmt: (v) => fmtDuration(v * 60), axis: (v) => (v >= 60 ? `${Math.round(v / 6) / 10}h` : `${v}m`), goal: null, big: (w) => [fmtDuration(w.secs), ""] },
  ];
  const chartSlot = h("div");
  const bigSlot = h("div");
  const drawWeeks = () => {
    const mt = metrics[weekMetric];
    const items = weeks.map((w, i) => ({
      label: `${w.start.getDate()} ${MONTHS[w.start.getMonth()].slice(0, 3)}`,
      value: mt.value(w), current: i === weeks.length - 1,
      tip: { value: mt.fmt(mt.value(w)), title: i === weeks.length - 1 ? "This week (so far)" : `Week of ${shortDate(w.start)}`, sub: w.count ? plural(w.count, "workout") : "No workouts" },
    }));
    const last = weeks.at(-1), prev = weeks.at(-2);
    const [big, unit] = mt.big(prev);
    bigSlot.replaceChildren(h("div", { class: "caption" }, "Last week"), h("div", { class: "chart-big" }, big, unit ? h("small", null, unit) : null));
    chartSlot.replaceChildren(barChart(items, { height: 170, goal: mt.goal, format: mt.axis, ariaLabel: `${mt.name} per week, last 12 weeks` }),
      h("div", { class: "chart-legend", style: { marginTop: "8px" } },
        mt.goal ? h("span", { class: "legend-key" }, h("span", { class: "key-dash" }), `Your goal: ${st.goal} a week`) : null,
        h("span", { class: "legend-key" }, `This week so far: ${mt.fmt(mt.value(last))}`)));
  };
  drawWeeks();
  const weekCard = h("div", { class: "card chart-card" },
    h("div", { class: "chart-top" }, bigSlot, segmented(metrics.map((x) => x.name), weekMetric, (i) => { weekMetric = i; drawWeeks(); }, "small")),
    chartSlot);

  const parts = ["Your progress, week by week", tiles, weekCard];

  // muscles
  const split = muscleSplit(data, 30, now);
  if (split.length) parts.push(h("div", { class: "card" },
    h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Sets per muscle group"), h("span", { class: "muted" }, "last 30 days")),
    hbars(split.map((x) => ({ label: x.muscle, value: x.sets, text: String(x.sets) })))));

  // records
  const recs = recentRecords(data, 5);
  if (recs.length) parts.push(h("div", { class: "section-caption" }, "Newest personal records"),
    h("div", { class: "group" }, recs.map((r) => h("button", { type: "button", class: "pr-row", style: { width: "100%", textAlign: "left" }, onclick: () => openExerciseDetail(r.entry.ex) },
      h("span", { class: "pr-icon" }, icon("trophy", 19)),
      h("span", { class: "pr-text" }, h("div", { class: "pr-title" }, exerciseMap(data).get(r.entry.ex)?.name || r.entry.name),
        h("div", { class: "pr-sub" }, `${r.record.label} · ${relDay(r.session.date)}`)),
      h("span", { class: "pr-value" }, r.record.value)))));

  // every exercise
  const sums = exerciseSummaries(data, now);
  parts.push(h("div", { class: "section-caption" }, "Exercises"),
    h("div", { class: "group" }, sums.map((x) => {
      const ch = x.change;
      const chText = !ch || x.count < 2 ? null : x.kind === "weight" ? `${ch > 0 ? "+" : MINUS}${kg(Math.abs(Math.round(ch * 10) / 10))}` : x.kind === "reps" ? `${ch > 0 ? "+" : MINUS}${Math.abs(Math.round(ch))}` : `${ch > 0 ? "+" : MINUS}${fmtSecs(Math.abs(Math.round(ch)))}`;
      return h("button", { type: "button", class: "ex-row", onclick: () => openExerciseDetail(x.id) },
        h("span", { class: "ex-text" }, h("span", { class: "ex-name" }, x.name),
          h("span", { class: "ex-sub" }, `${plural(x.count, "time")} · last: ${relDay(x.last.session.date)}`)),
        h("span", { class: "ex-right" }, sparkline(x.scores.slice(-10)), chText ? chip(chText, ch > 0 ? "up" : "down", "small") : null),
        icon("chevron", 15, "chev"));
    })));
  return parts;
}

// ---------------------------------------------------------------------------
// One exercise
// ---------------------------------------------------------------------------
export function openExerciseDetail(exId) {
  const data = store.data;
  const ex = exerciseMap(data).get(exId);
  const hist = exerciseHistory(data, exId);
  if (!hist.length) return;
  const kind = hist.at(-1).entry.kind;
  const unit = timeUnit(ex);
  const best = bestsBefore(data, exId, Infinity);
  const metrics = kind === "weight"
    ? [["e1rm", "Best set"], ["weight", "Heaviest"], ["volume", "Volume"]]
    : kind === "reps" ? [["reps", "Best set"], ["total", "All reps"]] : [["time", "Longest"]];
  let mi = 0;
  const chartSlot = h("div");
  const explain = h("div", { class: "muted", style: { fontSize: "13px" } });
  const draw = () => {
    const [metric] = metrics[mi];
    // a record is a point higher than every point before it
    let top = 0;
    const pts = exerciseSeries(data, exId, metric).map((p, i) => {
      const record = i > 0 && p.y > top;
      top = Math.max(top, p.y);
      const v = metric === "volume" ? fmtVolume(p.y) : metric === "e1rm" || metric === "weight" ? kg(p.y) : metric === "time" ? fmtSecs(p.y, unit) : plural(p.y, "rep");
      return { ...p, record, tip: { value: v, title: shortDate(parseDay(p.h.session.date)), sub: setsLine(data, p.h.entry) } };
    });
    explain.textContent = metric === "e1rm" ? "Estimated one-rep max: what your best set says you could lift once. Orange dots are new records."
      : metric === "weight" ? "The heaviest weight in each workout." : metric === "volume" ? "Kilos lifted in each workout: weight × reps, all sets."
        : metric === "total" ? "All the reps in each workout." : "Orange dots are new records.";
    chartSlot.replaceChildren(pts.length >= 2 ? lineChart(pts, { height: 200, format: (v) => (metric === "volume" ? fmtAxisKg(v) : metric === "time" ? fmtSecs(v, unit) : String(Math.round(v))), ariaLabel: metrics[mi][1] })
      : h("div", { class: "empty-small" }, "Do it once more to see a line here."));
  };
  draw();
  const cards = kind === "weight"
    ? [["Best set (est. 1RM)", kg(best.e1rm)], ["Heaviest", kg(best.maxW)], ["Most volume", fmtVolume(best.volume)], ["Times done", String(hist.length)]]
    : kind === "reps" ? [["Most reps", plural(best.maxReps, "rep")], ["Most added", best.maxW ? `+${kg(best.maxW)}` : "–"], ["Times done", String(hist.length)], ["Last time", relDay(hist.at(-1).session.date)]]
      : [["Longest", fmtSecs(best.maxSecs, unit)], ["Times done", String(hist.length)]];
  const body = h("div", { class: "sheet-stack" },
    h("div", { class: "pr-cards" }, cards.map(([l, v]) => h("div", { class: "pr-card" }, h("div", { class: "caption" }, l), h("div", { class: "stat-value" }, v)))),
    h("div", { class: "card chart-card" },
      metrics.length > 1 ? segmented(metrics.map((x) => x[1]), mi, (i) => { mi = i; draw(); }, "full") : h("div", { class: "card-title" }, metrics[0][1]),
      chartSlot, explain),
    h("div", { class: "section-caption" }, "Every time"),
    h("div", { class: "group" }, [...hist].reverse().map((x) => h("div", { class: "info-row", style: { flexDirection: "column", gap: "3px" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px" } }, h("b", { style: { fontWeight: "600" } }, shortDate(parseDay(x.session.date))),
        h("span", { class: "muted" }, x.session.name)),
      h("div", { class: "num", style: { color: "var(--label2)", fontSize: "14px" } }, setsLine(data, x.entry))))));
  sheet({ title: ex?.name || hist.at(-1).entry.name, right: { text: "Done", bold: true, onClick: (a) => a.close() }, body });
}

