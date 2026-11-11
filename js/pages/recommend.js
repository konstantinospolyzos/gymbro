// Recommended workouts and weeks: browse the workouts by muscle group, see why each exercise is there, add
// one to your plan on the days you pick (or start it now), or let the app pick a whole week for the number of
// days you can train. Everything can be changed afterwards like your own workouts.

import { h, icon, sheet, caption, footer, toast, alertBox, tile, initials, chip, segmented } from "../ui.js";
import { store } from "../store.js";
import { exerciseMap } from "../data.js";
import { RECOMMENDED, GROUPS, GROUP_LABELS, TIPS, RESEARCH, recommendedById, asWorkout, weeksFor, weekOp } from "../library.js";
import { WEEKDAYS, WEEK_ORDER, fmtRest, plural, workoutSets, expectedMinutes, repRange, plannedDays, timeUnit, fmtSecs } from "../core.js";
import { startWorkout } from "./live.js";

const meta = (data, w) => {
  const est = expectedMinutes(data, w);
  return `${plural(w.items.length, "exercise")} · ${plural(workoutSets(w), "set")} · about ${est.minutes} min`;
};

function targetText(it, ex) {
  const kind = ex?.kind || "weight";
  const reps = kind === "time" ? (it.secs ? fmtSecs(it.secs, timeUnit(ex)) : "time") : `${repRange(it)} reps`;
  return `${it.sets} × ${reps} · rest ${fmtRest(it.rest ?? 0)}`;
}

/** The list of recommended workouts. forDay: choosing for a day of the plan; onPick(workout): starting a new workout from one */
export function openRecommended({ forDay = null, onPick = null } = {}) {
  const data = store.data;
  const mine = new Set(data.workouts.map((w) => w.id));
  const body = h("div", { class: "form" });
  let api = null;
  const intro = forDay !== null ? `A workout for ${WEEKDAYS[forDay]}s. Tap one to see its exercises.`
    : onPick ? "Start from one of these, then change anything you like."
      : "Workouts for a fully equipped gym, with the exercises the research rates best for each muscle. Tap one to see them, add it to your plan or start it now.";
  body.append(h("div", { class: "rec-intro" }, intro),
    h("div", { class: "group", style: { marginTop: "12px" } },
      h("button", { type: "button", class: "action-row", onclick: openResearch }, icon("sparkle", 20, "row-icon"),
        h("span", { class: "action-text" }, "Why these exercises", h("span", { class: "action-detail" }, "The research behind the choices, with links")), icon("chevron", 15, "chev"))));
  if (!onPick && forDay === null) {
    body.append(h("div", { class: "group", style: { marginTop: "12px" } },
      h("button", { type: "button", class: "action-row", onclick: () => { api.close(); openWeekRecommender(); } }, icon("calendar", 20, "row-icon"),
        h("span", { class: "action-text" }, "Recommend a whole week", h("span", { class: "action-detail" }, "For the number of days you can train")), icon("chevron", 15, "chev"))));
  }
  for (const g of GROUPS) {
    const recs = RECOMMENDED.filter((r) => r.group === g);
    body.append(caption(GROUP_LABELS[g] || g), h("div", { class: "group" }, recs.map((r) => {
      const w = asWorkout(r);
      return h("button", { type: "button", class: "item-row rec-row", onclick: () => openPreview(r, { forDay, onPick, parent: api }) },
        tile(r.color, initials(r.name), 42),
        h("span", { class: "item-text" },
          h("span", { class: "item-name" }, r.name, mine.has(r.id) ? h("span", { class: "rec-mine" }, chip("In your plan", "up", "small")) : null),
          h("span", { class: "item-sub" }, meta(data, w)),
          h("span", { class: "rec-focus" }, r.focus)),
        icon("chevron", 15, "chev"));
    })));
  }
  body.append(footer("Sets are the hard ones, 1–3 reps short of failure. Warm-up sets come on top, with lighter weights."));
  api = sheet({ title: forDay !== null ? WEEKDAYS[forDay] : "Recommended workouts", left: forDay !== null || onPick ? { text: "Cancel" } : null,
    right: forDay !== null || onPick ? null : { text: "Done", bold: true, onClick: (a) => a.close() }, body });
  return api;
}

/** One recommended workout: its exercises and why, the days, Add / Start */
export function openPreview(rec, { forDay = null, onPick = null, parent = null } = {}) {
  const data = store.data;
  const exMap = exerciseMap(data);
  const w = asWorkout(rec);
  const own = data.workouts.find((x) => x.id === rec.id) || null;
  const days = new Set(forDay !== null ? [forDay] : WEEK_ORDER.filter((d) => data.schedule[String(d)] === rec.id));
  const body = h("div", { class: "form" });
  let api = null;

  const dayChips = h("div", { class: "day-chips" });
  const dayFoot = footer("");
  const drawDays = () => {
    dayChips.replaceChildren(...WEEK_ORDER.map((d) => {
      const other = data.schedule[String(d)] && data.schedule[String(d)] !== rec.id ? data.workouts.find((x) => x.id === data.schedule[String(d)]) : null;
      return h("button", { type: "button", class: `day-chip ${days.has(d) ? "on" : ""} ${other ? "taken" : ""}`, "aria-pressed": String(days.has(d)), "aria-label": WEEKDAYS[d],
        onclick: () => { if (days.has(d)) days.delete(d); else days.add(d); drawDays(); } }, WEEKDAYS[d].slice(0, 3));
    }));
    const taken = [...days].map((d) => [d, data.schedule[String(d)]]).filter(([, id]) => id && id !== rec.id)
      .map(([d, id]) => `${WEEKDAYS[d]} (now ${data.workouts.find((x) => x.id === id)?.name})`);
    dayFoot.textContent = taken.length ? `It takes over ${taken.join(", ")}.` : days.size ? "" : "No day picked: it's in your plan and you start it from Today when you like.";
  };
  drawDays();

  const closeAll = () => { api.close(); parent?.close(); };
  const add = () => {
    if (!own) store.saveWorkout(w);
    for (const d of WEEK_ORDER) {
      const has = store.data.schedule[String(d)] === rec.id;
      if (days.has(d) && !has) store.setDay(d, rec.id);
      else if (!days.has(d) && has) store.setDay(d, null);
    }
    closeAll();
    toast(own ? "Days saved" : `${rec.name} added${days.size ? ` on ${[...days].map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")}` : " to your plan"}`);
  };

  body.append(
    h("div", { class: "rec-head" }, tile(rec.color, initials(rec.name), 64),
      h("div", { class: "rec-title" }, rec.name), h("div", { class: "rec-text" }, rec.focus),
      h("div", { class: "hero-meta", style: { justifyContent: "center" } },
        h("span", { class: "meta-chip" }, plural(w.items.length, "exercise")), h("span", { class: "meta-chip" }, plural(workoutSets(w), "set")),
        h("span", { class: "meta-chip" }, `about ${expectedMinutes(data, w).minutes} min`))),
    caption("Exercises"),
    h("div", { class: "group" }, w.items.map((it, i) => {
      const ex = exMap.get(it.ex);
      return h("div", { class: "rec-ex" }, h("span", { class: "item-num" }, String(i + 1)),
        h("div", { class: "rec-ex-text" }, h("div", { class: "rec-ex-name" }, ex?.name || "Exercise"),
          h("div", { class: "rec-ex-target" }, targetText(it, ex)),
          TIPS[it.ex] ? h("div", { class: "rec-ex-tip" }, TIPS[it.ex]) : null));
    })),
    footer(own ? "This workout is in your plan (with your changes, if you made any). Start uses your version." : "After adding it, you can change any exercise, set, rep or rest in Plan."));
  if (!onPick) body.append(caption("Days"), h("div", { class: "group" }, dayChips), dayFoot);
  body.append(h("div", { class: "rec-buttons" },
    onPick
      ? h("button", { type: "button", class: "btn primary wide", onclick: () => { closeAll(); onPick(w); } }, "Use this workout")
      : h("button", { type: "button", class: "btn primary wide", onclick: add }, own ? "Save the days" : forDay !== null && days.size === 1 && days.has(forDay) ? `Add on ${WEEKDAYS[forDay]}` : "Add to my plan"),
    onPick ? null : h("button", { type: "button", class: "btn tinted wide", onclick: () => { closeAll(); startWorkout(own || w); } }, icon("play", 17), "Start it now")));
  api = sheet({ title: rec.name, left: { text: "Back" }, body });
}

/** The research behind the workouts */
export function openResearch() {
  const body = h("div", { class: "form" },
    h("div", { class: "rec-intro" }, "How the recommended workouts were put together, from studies and evidence-based coaches. Good to know for your own workouts too."),
    ...RESEARCH.map((r) => h("div", { class: "card research-card" }, h("div", { class: "research-text" }, r.text),
      r.links.length ? h("div", { class: "research-links" }, r.links.map(([t, url]) => h("a", { href: url, target: "_blank", rel: "noopener", class: "research-link" }, icon("link", 14), t))) : null)));
  sheet({ title: "Why these exercises", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body });
}

/** Pick a week: how many days, then the recommended week (and the other options) */
export function openWeekRecommender() {
  const data = store.data;
  const choices = [2, 3, 4, 5, 6];
  let days = choices.includes(plannedDays(data)) ? plannedDays(data) : 5;
  const slot = h("div");
  const body = h("div", { class: "form" },
    caption("How many days a week can you train?"),
    h("div", { class: "group", style: { padding: "10px" } }, segmented(choices.map(String), choices.indexOf(days), (i) => { days = choices[i]; draw(); }, "full")),
    slot,
    footer("Your own workouts stay in Plan; only the days change. Everything can be changed afterwards."));
  let api = null;

  const use = async (week) => {
    const hasWeek = Object.keys(store.data.schedule).length > 0;
    if (hasWeek) {
      const ok = await alertBox({ title: `Use “${week.name}”?`, message: "Your week's days change to this. Your own workouts stay in Plan.",
        buttons: [{ text: "Cancel", value: false, style: "cancel" }, { text: "Use it", value: true, style: "bold" }] });
      if (!ok) return;
    }
    store.addPlan(weekOp(week.id, store.data));
    api.close();
    toast(`${week.name}: your week is set`);
  };

  function draw() {
    slot.replaceChildren(...weeksFor(days).map((week, i) => {
      const grid = h("div", { class: "week-grid" }, WEEK_ORDER.map((d) => {
        const r = week.schedule[d] ? recommendedById(week.schedule[d]) : null;
        return h("div", { class: `week-cell ${r ? "on" : ""}` }, h("span", { class: "week-dow" }, WEEKDAYS[d].slice(0, 3)),
          r ? h("span", { class: `dot c-${r.color}` }) : h("span", { class: "dot rest-dot" }),
          h("span", { class: "week-name" }, r ? r.short : "Rest"));
      }));
      return h("div", { class: "card week-card" },
        h("div", { class: "card-head", style: { marginBottom: "4px" } }, h("div", { class: "card-title" }, week.name), i === 0 && weeksFor(days).length > 1 ? chip("Recommended", "info") : null),
        h("div", { class: "rec-text", style: { textAlign: "left" } }, week.text),
        grid,
        h("button", { type: "button", class: `btn ${i === 0 ? "primary" : "tinted"} wide`, onclick: () => use(week) }, "Use this week"));
    }));
  }
  draw();
  api = sheet({ title: "Recommend a week", left: { text: "Cancel" }, body });
}
