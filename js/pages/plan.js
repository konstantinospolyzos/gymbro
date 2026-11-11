// Plan: your week (which workout on which day) and your workouts, each with its exercises and rest.

import { h, icon, group, caption, footer, actionSheet, chip } from "../ui.js";
import { store } from "../store.js";
import { WEEKDAYS, WEEK_ORDER, plannedDays, today } from "../core.js";
import { workoutTile, workoutLine, emptyState } from "./common.js";
import { openWorkoutEditor, openLibrary } from "./editors.js";
import { openRecommended, openWeekRecommender } from "./recommend.js";

async function pickForDay(day) {
  const data = store.data;
  const cur = data.schedule[String(day)] || null;
  const v = await actionSheet({
    title: WEEKDAYS[day],
    actions: [...data.workouts.map((w) => ({ text: w.name, value: w.id, color: w.color, checked: w.id === cur })),
      { text: "Rest day", value: "rest", checked: !cur },
      { text: "Recommended workouts…", value: "rec" },
      { text: "New workout…", value: "new" }],
  });
  if (v === null) return;
  if (v === "new") { openWorkoutEditor(null); return; }
  if (v === "rec") { openRecommended({ forDay: day }); return; }
  store.setDay(day, v === "rest" ? null : v);
}

export function renderPlan() {
  const data = store.data;
  const n = plannedDays(data);
  const subtitle = data.workouts.length ? `${n ? `${n} training day${n !== 1 ? "s" : ""} a week` : "No days planned yet"} · ${data.workouts.length} workout${data.workouts.length !== 1 ? "s" : ""}` : "Your week and your workouts";
  const todayDow = today().getDay();

  if (!data.workouts.length) {
    return [subtitle, emptyState("calendar", "Plan your week",
      "Make a workout for each day, for example Monday back with your back exercises. Or let the app recommend a week, with workouts picked from the research for each muscle group.",
      h("button", { type: "button", class: "btn primary wide", onclick: () => openWeekRecommender() }, icon("sparkle", 18), "Recommend a week for me"),
      h("button", { type: "button", class: "btn tinted wide", onclick: () => openRecommended() }, "Browse recommended workouts"),
      h("button", { type: "button", class: "btn plain", onclick: () => openWorkoutEditor(null) }, "Make my own workout")),
    footer("Every recommended exercise, set, rep and rest can be changed afterwards."),
    caption("Exercises"), group(h("button", { type: "button", class: "action-row", onclick: openLibrary }, icon("list", 20, "row-icon"),
      h("span", { class: "action-text" }, "Exercise list", h("span", { class: "action-detail" }, `${data.exercises.filter((e) => !e.archived).length} exercises`)), icon("chevron", 15, "chev")))];
  }

  const week = group(WEEK_ORDER.map((d) => {
    const w = data.workouts.find((x) => x.id === data.schedule[String(d)]);
    return h("button", { type: "button", class: `day-row ${d === todayDow ? "today" : ""}`, onclick: () => pickForDay(d) },
      h("span", { class: "day-name" }, WEEKDAYS[d], d === todayDow ? h("span", { class: "muted", style: { fontWeight: "500", fontSize: "14px" } }, "  today") : null),
      w ? h("span", { class: "day-value" }, h("span", { class: `dot c-${w.color}` }), w.name) : h("span", { class: "day-value rest" }, icon("moon", 16), "Rest"),
      icon("chevron", 15, "chev"));
  }));

  const workouts = h("div", { class: "wk-list" }, data.workouts.map((w) => {
    const days = WEEK_ORDER.filter((d) => data.schedule[String(d)] === w.id);
    return h("button", { type: "button", class: "card wk-card", onclick: () => openWorkoutEditor(w) },
      workoutTile(w, 46),
      h("span", { class: "wk-text" }, h("span", { class: "wk-name" }, w.name), h("span", { class: "wk-sub" }, workoutLine(w)),
        days.length ? h("span", { class: "wk-days" }, days.map((d) => chip(WEEKDAYS[d].slice(0, 3), "flat", "small"))) : null),
      icon("chevron", 15, "chev"));
  }));

  return [subtitle,
    caption("Week"), week, footer("Tap a day to choose its workout. Today's workout is on the Today tab, ready to start."),
    caption("Workouts", h("button", { type: "button", class: "link-btn", onclick: () => openWorkoutEditor(null) }, "New")), workouts,
    caption("Recommended"), group(
      h("button", { type: "button", class: "action-row", onclick: () => openRecommended() }, icon("sparkle", 20, "row-icon"),
        h("span", { class: "action-text" }, "Recommended workouts", h("span", { class: "action-detail" }, "One for each muscle group, with the exercises the research rates best")), icon("chevron", 15, "chev")),
      h("button", { type: "button", class: "action-row", onclick: () => openWeekRecommender() }, icon("calendar", 20, "row-icon"),
        h("span", { class: "action-text" }, "Recommend a week", h("span", { class: "action-detail" }, "For the number of days you can train")), icon("chevron", 15, "chev"))),
    caption("Exercises"), group(h("button", { type: "button", class: "action-row", onclick: openLibrary }, icon("list", 20, "row-icon"),
      h("span", { class: "action-text" }, "Exercise list", h("span", { class: "action-detail" }, `${data.exercises.filter((e) => !e.archived).length} exercises · add your own`)), icon("chevron", 15, "chev")))];
}
