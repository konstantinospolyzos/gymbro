// Today: today's workout from your plan with one big Start button, this week at a glance (and your
// streak), the last workout, and the other workouts to start instead.

import { h, icon, chip, toast } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { longDate, today, isoDay, addDays, startOfWeek, WEEKDAYS, workoutForDay, expectedMinutes, workoutSets, lastFor, setShort, timeUnit,
  plural, fmtRest, streak, repRange, sessionStats, fmtDuration, fmtVolume, timeOfDay, clock, recordCounts } from "../core.js";
import { counts } from "../workout.js";
import { workoutTile, sessionCard, chooseRest, chooseWorkout, emptyState } from "./common.js";
import { startWorkout, openLive } from "./live.js";
import { openSessionDetail } from "./history.js";
import { openWorkoutEditor } from "./editors.js";
import { openRecommended, openWeekRecommender } from "./recommend.js";

function exerciseList(data, w) {
  const exMap = exerciseMap(data);
  return h("div", { class: "hero-list" }, w.items.map((it) => {
    const ex = exMap.get(it.ex);
    const kind = ex?.kind || "weight";
    const last = lastFor(data, it.ex);
    const target = kind === "time" ? `${it.sets} × ${it.secs ? setShort({ s: it.secs }, "time", timeUnit(ex)) : "time"}` : `${it.sets} × ${repRange(it)}`;
    return h("div", { class: "hero-ex" },
      h("span", { class: "hero-ex-name" }, ex?.name || "Exercise"),
      h("span", { class: "hero-ex-sets" }, target),
      h("span", { class: "hero-ex-last num", title: "Your best set last time" }, last?.stats.top ? setShort(last.stats.top, kind, timeUnit(ex)) : ""));
  }));
}

function workoutHero(data, w, label) {
  const est = expectedMinutes(data, w);
  const restBtn = h("button", { type: "button", class: "meta-chip", "aria-label": "Change the rest between sets", onclick: async () => {
    const v = await chooseRest(w.rest, { title: `Rest between sets in ${w.name}` });
    if (v === null) return;
    store.saveWorkout({ ...w, rest: v });
    toast(`Rest ${fmtRest(v)}`);
  } }, icon("timer", 15), `Rest ${fmtRest(w.rest)}`);
  return h("div", { class: "card hero-card" },
    h("span", { class: `hero-glow c-${w.color}` }),
    h("div", { class: "hero-top" }, workoutTile(w, 52),
      h("div", { class: "hero-text" }, h("div", { class: "caption" }, label), h("div", { class: "hero-name" }, w.name)),
      h("button", { type: "button", class: "icon-btn", "aria-label": `Edit ${w.name}`, onclick: () => openWorkoutEditor(w) }, icon("edit", 20))),
    h("div", { class: "hero-meta" },
      h("span", { class: "meta-chip" }, plural(w.items.length, "exercise")),
      h("span", { class: "meta-chip" }, plural(workoutSets(w), "set")),
      h("span", { class: "meta-chip" }, `${est.usual ? "usually" : "about"} ${est.minutes} min`),
      restBtn),
    w.items.length ? exerciseList(data, w) : h("div", { class: "muted" }, "No exercises yet. Tap the pencil to add some."),
    h("button", { type: "button", class: `start-btn tile-${w.color}`, onclick: () => startWorkout(w) }, icon("play", 22), "Start workout"));
}

function activeCard(a) {
  const { done, total } = counts(a);
  return h("div", { class: "card hero-card" },
    h("span", { class: `hero-glow c-${a.color}` }),
    h("div", { class: "hero-top" }, workoutTile(a, 52),
      h("div", { class: "hero-text" }, h("div", { class: "caption" }, "Workout in progress"), h("div", { class: "hero-name" }, a.name))),
    h("div", { class: "hero-meta" },
      h("span", { class: "meta-chip" }, `Started ${timeOfDay(a.start)}`),
      h("span", { class: "meta-chip num" }, clock(Date.now() - a.start)),
      h("span", { class: "meta-chip" }, `${done} of ${plural(total, "set")}`)),
    h("button", { type: "button", class: `start-btn tile-${a.color}`, onclick: () => openLive() }, icon("play", 22), "Back to the workout"));
}

function doneCard(data, sessions) {
  const s = sessions.at(-1);
  const st = sessionStats(s);
  const prs = recordCounts(data).get(s.id) || 0;
  return h("div", { class: "card hero-card" },
    h("div", { class: "done-banner" }, h("span", { class: "done-check" }, icon("checkBold", 24)),
      h("div", { class: "hero-text" }, h("div", { class: "caption" }, sessions.length > 1 ? `${sessions.length} workouts today` : "Done today"),
        h("div", { class: "hero-name" }, s.name))),
    h("div", { class: "hero-meta" },
      h("span", { class: "meta-chip" }, icon("timer", 15), fmtDuration(s.dur)),
      st.volume ? h("span", { class: "meta-chip" }, fmtVolume(st.volume)) : null,
      h("span", { class: "meta-chip" }, plural(st.sets, "set")),
      prs ? chip(`${prs} new PR${prs > 1 ? "s" : ""}`, "gold") : null),
    h("div", { class: "button-row" },
      h("button", { type: "button", class: "btn tinted", onclick: () => openSessionDetail(s) }, "Summary"),
      h("button", { type: "button", class: "btn gray", onclick: async () => { const w = await chooseWorkout("Another workout"); if (w) startWorkout(w === "empty" ? null : w); } }, "Another")));
}

function restCard(data) {
  const next = nextPlanned(data);
  return h("div", { class: "card hero-card" },
    h("div", { class: "rest-day" }, h("span", { class: "rest-icon" }, icon("moon", 26)),
      h("div", { class: "hero-text" }, h("div", { class: "caption" }, "Rest day"), h("div", { class: "hero-name", style: { fontSize: "22px" } }, "Nothing planned today"),
        next ? h("div", { class: "muted", style: { marginTop: "4px" } }, `Next: ${next.when} · ${next.w.name}`) : null)),
    h("div", { class: "button-row" },
      h("button", { type: "button", class: "btn tinted", onclick: async () => { const w = await chooseWorkout(); if (w) startWorkout(w === "empty" ? null : w); } },
        icon("play", 16), "Train anyway"),
      h("button", { type: "button", class: "btn gray", onclick: () => openRecommended() }, icon("sparkle", 16), "Recommended")));
}

function nextPlanned(data, from = today()) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(from, i);
    const w = workoutForDay(data, d);
    if (w) return { w, when: i === 1 ? "tomorrow" : WEEKDAYS[d.getDay()] };
  }
  return null;
}

function weekCard(data) {
  const now = today(), todayIso = isoDay(now);
  const start = startOfWeek(now);
  const strip = h("div", { class: "week-strip" }, Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i), iso = isoDay(d);
    const sess = data.sessions.filter((s) => s.date === iso);
    const planned = workoutForDay(data, d);
    const color = sess.length ? sess[0].color : planned?.color;
    const label = sess.length ? sess[0].name : planned ? planned.name : iso < todayIso ? "" : "Rest";
    const missed = !sess.length && planned && iso < todayIso;
    return h("div", { class: `wday ${sess.length ? "done" : planned ? "planned" : ""} ${missed ? "missed" : ""} ${iso === todayIso ? "today" : ""}`,
      style: color ? { "--wc": `var(--w-${color})` } : null, "aria-label": `${WEEKDAYS[d.getDay()]}: ${sess.length ? `${label}, done` : planned ? `${label}, planned` : "rest"}` },
      h("span", { class: "wday-name" }, WEEKDAYS[d.getDay()].slice(0, 1)),
      h("span", { class: "wday-circle" }, sess.length ? icon("checkBold", 16) : String(d.getDate())),
      h("span", { class: "wday-label" }, label));
  }));
  const st = streak(data, now);
  const pct = Math.min(100, (st.thisWeek / st.goal) * 100);
  return h("div", { class: "card" },
    h("div", { class: "card-head" }, h("div", { class: "card-title" }, "This week"),
      st.weeks ? h("span", { class: "streak", title: "Weeks in a row you reached your goal" }, icon("flame", 17), `${st.weeks} week${st.weeks !== 1 ? "s" : ""}`) : null),
    strip,
    h("div", { class: "goal-row" }, h("span", { class: "goal-text" }, `${st.thisWeek} of ${st.goal} `, h("span", { class: "muted" }, "workouts")),
      h("span", { class: "muted", style: { fontSize: "13.5px" } }, st.thisWeek >= st.goal ? "Goal reached 🎉" : `${st.goal - st.thisWeek} to go`)),
    h("div", { class: "meter" }, h("span", { style: { width: `${pct}%`, background: st.thisWeek >= st.goal ? "var(--green)" : "var(--blue)" } })));
}

export function renderToday() {
  const data = store.data;
  const now = today();
  const parts = [];
  const a = store.active;
  const planned = workoutForDay(data, now);
  const todays = data.sessions.filter((s) => s.date === isoDay(now));

  if (a) parts.push(activeCard(a));
  else if (!data.workouts.length && !data.sessions.length) {
    parts.push(emptyState("dumbbell", "Set up your week",
      "Give each day a workout, for example Monday back with your back exercises. Or let the app recommend a week: workouts for each muscle group with the exercises the research rates best.",
      h("button", { type: "button", class: "btn primary wide", onclick: () => openWeekRecommender() }, icon("sparkle", 18), "Recommend a week for me"),
      h("button", { type: "button", class: "btn tinted wide", onclick: () => openRecommended() }, "Browse recommended workouts"),
      h("div", { class: "button-row", style: { width: "100%" } },
        h("button", { type: "button", class: "btn gray", onclick: () => openWorkoutEditor(null) }, "Make my own"),
        h("button", { type: "button", class: "btn gray", onclick: () => startWorkout(null) }, "Empty workout"))));
  } else if (todays.length) parts.push(doneCard(data, todays));
  else if (planned) parts.push(workoutHero(data, planned, `Today · ${WEEKDAYS[now.getDay()]}`));
  else parts.push(restCard(data));

  if (data.workouts.length || data.sessions.length) parts.push(weekCard(data));

  const last = [...data.sessions].reverse().find((s) => s.date !== isoDay(now));
  if (last) parts.push(h("div", { class: "section-caption" }, "Last workout"), sessionCard(data, last, () => openSessionDetail(last)));

  const others = data.workouts.filter((w) => !a && w.id !== planned?.id);
  if (others.length) {
    parts.push(h("div", { class: "section-caption" }, planned ? "Something else today?" : "Your workouts"),
      h("div", { class: "pill-row" }, others.map((w) => h("button", { type: "button", class: "pill-btn", onclick: () => startWorkout(w) }, h("span", { class: `dot c-${w.color}` }), w.name)),
        h("button", { type: "button", class: "pill-btn", style: { color: "var(--blue)" }, onclick: () => startWorkout(null) }, icon("plus", 15), "Empty")));
  }
  return [longDate(now), ...parts];
}
