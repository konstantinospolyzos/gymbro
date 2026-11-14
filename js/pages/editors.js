// Editing the plan: a workout (name, colour, days, rest, exercises), one exercise in it (sets, reps,
// weight, its own rest), choosing exercises from the library, and the library itself.

import { h, icon, sheet, group, caption, footer, alertBox, toast, segmented, stepper, selectOnFocus, tile, initials, switchRow, actionRow } from "../ui.js";
import { store } from "../store.js";
import { uid, MUSCLES, COLORS, KIND_LABELS, exerciseMap } from "../data.js";
import { WEEKDAYS, WEEK_ORDER, fmtRest, fmtKg, kg, parseNum, timeUnit, fmtSecs, repRange, barOf, supersets, linkNext, alternatives, lastFor, relDay } from "../core.js";
import { TIPS } from "../library.js";
import { openRecommended } from "./recommend.js";
import { NO, chooseRest, setsLine } from "./common.js";

const KIND_ORDER = ["weight", "reps", "time"];
const STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

/** "3 × 10 · 60 kg · rest 2:00" for a workout's exercise */
export function itemLine(item, ex, workoutRest = null) {
  const kind = ex?.kind || "weight";
  const parts = [];
  if (kind === "time") parts.push(`${item.sets} × ${item.secs ? fmtSecs(item.secs, timeUnit(ex)) : "time"}`);
  else parts.push(`${item.sets} × ${repRange(item)}${kind === "reps" ? " reps" : ""}`);
  if (item.w) parts.push(kind === "reps" ? `+${kg(item.w)}` : kg(item.w));
  if (item.rest !== null && item.rest !== undefined && item.rest !== workoutRest) parts.push(`rest ${fmtRest(item.rest)}`);
  return parts.join(" · ");
}

function newItem(ex) {
  const kind = ex.kind;
  return { id: uid("i"), ex: ex.id, sets: 3, reps: kind === "time" ? null : kind === "reps" ? 10 : 10, w: null,
    secs: kind === "time" ? (ex.muscle === "Cardio" ? 1200 : 60) : null, rest: null };
}

// ---------------------------------------------------------------------------
// Choosing exercises
// ---------------------------------------------------------------------------
/** The library as a list to pick from. multi: tick several, then Add. onDone(ids) */
export function openExercisePicker({ title = "Add exercises", multi = true, dark = false, exclude = [], onDone }) {
  const picked = [];
  const inWorkout = new Set(exclude);
  const search = selectOnFocus(h("input", { class: "search-input", type: "search", placeholder: "Search", autocomplete: "off", "aria-label": "Search exercises" }));
  const list = h("div", { class: "form" });
  let api = null;

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const all = store.data.exercises.filter((e) => !e.archived && (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)));
    const parts = [h("div", { class: "group", style: { marginTop: "12px" } },
      h("button", { type: "button", class: "action-row", onclick: () => openExerciseEditor(null, { dark, name: search.value.trim(), onSaved: (ex) => {
        if (multi) { picked.push(ex.id); draw(); updateNav(); } else { api.close(); onDone([ex.id]); }
      } }) }, icon("plus", 20, "row-icon"), h("span", { class: "action-text" }, h("span", null, q ? `New exercise “${search.value.trim()}”` : "New exercise")), icon("chevron", 15, "chev")))];
    for (const m of MUSCLES) {
      const rows = all.filter((e) => e.muscle === m);
      if (!rows.length) continue;
      parts.push(caption(m), h("div", { class: "group" }, rows.map((e) => {
        const on = picked.includes(e.id);
        return h("button", { type: "button", class: `pick-row ${on ? "on" : ""}`, onclick: () => {
          if (!multi) { api.close(); onDone([e.id]); return; }
          const i = picked.indexOf(e.id);
          if (i >= 0) picked.splice(i, 1); else picked.push(e.id);
          draw(); updateNav();
        } },
        h("span", { class: "pick-name" }, e.name, h("div", { class: "pick-kind" }, [KIND_LABELS[e.kind], inWorkout.has(e.id) ? "in this workout" : null].filter(Boolean).join(" · "))),
        multi ? h("span", { class: "pick-box" }, on ? icon("check", 15) : null) : icon("chevron", 15, "chev"));
      })));
    }
    if (parts.length === 1) parts.push(h("div", { class: "empty-small" }, "No exercise with that name yet. Tap New exercise to add it."));
    list.replaceChildren(...parts);
  };
  const updateNav = () => api?.setRight({ text: picked.length ? `Add (${picked.length})` : "Add", disabled: !picked.length });
  search.addEventListener("input", draw);
  draw();
  api = sheet({
    title, className: dark ? "dark-scope" : "",
    left: { text: "Cancel" },
    right: multi ? { text: "Add", bold: true, disabled: true, onClick: (a) => { a.close(); onDone([...picked]); } } : null,
    body: h("div", null, h("div", { class: "search-wrap", style: { marginTop: "4px" } }, icon("search", 16, "search-icon"), search), list),
  });
  return api;
}

// ---------------------------------------------------------------------------
// One exercise in the library
// ---------------------------------------------------------------------------
export function openExerciseEditor(exercise, { dark = false, name = "", onSaved = null } = {}) {
  const isNew = !exercise;
  const ex = exercise ? { ...exercise } : { id: uid("ex"), name, muscle: "Other", kind: "weight", step: 2.5 };
  const body = h("div", { class: "form" });
  const nameIn = h("input", { class: "form-input left", type: "text", value: ex.name, placeholder: "For example Cable row", autocapitalize: "sentences", "aria-label": "Name" });
  nameIn.addEventListener("input", () => { ex.name = nameIn.value; api.setRight({ disabled: !ex.name.trim() }); });
  const muscleSel = h("select", { class: "form-select", "aria-label": "Muscle group" }, MUSCLES.map((m) => {
    const o = h("option", { value: m }, m); if (m === ex.muscle) o.selected = true; return o;
  }));
  muscleSel.addEventListener("change", () => { ex.muscle = muscleSel.value; });
  const stepSel = h("select", { class: "form-select", "aria-label": "Weight steps" }, STEPS.map((v) => {
    const o = h("option", { value: String(v) }, `${fmtKg(v)} kg`); if (v === (ex.step || 2.5)) o.selected = true; return o;
  }));
  stepSel.addEventListener("change", () => { ex.step = Number(stepSel.value); });
  const stepRow = h("label", { class: "form-row" }, h("span", { class: "form-label" }, "+/− buttons"), stepSel, icon("chevron", 14, "select-chev"));
  const BARS = [[0, "No bar"], [10, "EZ bar · 10 kg"], [15, "Bar · 15 kg"], [20, "Olympic bar · 20 kg"]];
  const barNow = barOf({ ...ex, kind: "weight" }) || 0;
  const barSel = h("select", { class: "form-select", "aria-label": "Bar" }, BARS.map(([v, t]) => {
    const o = h("option", { value: String(v) }, t); if (v === barNow) o.selected = true; return o;
  }));
  barSel.addEventListener("change", () => { ex.bar = Number(barSel.value); });
  const barRow = h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Bar"), barSel, icon("chevron", 14, "select-chev"));
  const kindHelp = footer("");
  const showKind = () => {
    stepRow.style.display = ex.kind === "time" ? "none" : "";
    barRow.style.display = ex.kind === "weight" ? "" : "none";
    kindHelp.textContent = ex.kind === "weight" ? "Log kilos and reps for each set."
      : ex.kind === "reps" ? "Log reps for each set, and extra kilos if you add a weight (a belt or a vest)."
        : "Log how long each set lasts: seconds (a plank), or minutes for cardio.";
  };
  const notes = h("textarea", { class: "note-input", placeholder: "Notes: seat height, grip, cues…", rows: 2, maxlength: 500 });
  notes.value = ex.notes || "";
  notes.addEventListener("input", () => { ex.notes = notes.value; });
  showKind();
  body.append(
    caption("Exercise"), group(h("label", { class: "form-row" }, nameIn),
      h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Muscle group"), muscleSel, icon("chevron", 14, "select-chev"))),
    caption("Logged as"), h("div", { class: "group", style: { padding: "10px" } },
      segmented(KIND_ORDER.map((k) => KIND_LABELS[k].replace(" (body weight)", "")), KIND_ORDER.indexOf(ex.kind), (i) => { ex.kind = KIND_ORDER[i]; showKind(); }, "full")),
    kindHelp,
    caption("Weights"), group(stepRow, barRow), footer("How much the + and − buttons change the weight during a workout. With a bar, the workout shows the plates to put on each side."),
    TIPS[ex.id] ? caption("How to do it") : null, TIPS[ex.id] ? h("div", { class: "group" }, h("div", { class: "info-text", style: { padding: "12px 16px" } }, TIPS[ex.id])) : null,
    caption("Notes"), h("div", { class: "group" }, notes), footer("They're on this exercise in every workout, where you can change them too."),
    !isNew ? h("button", { type: "button", class: "btn destructive-row", onclick: async () => {
      const ok = await alertBox({ title: `Hide ${ex.name}?`, message: "It disappears from the lists. Workouts you've logged keep it, and you can show it again from the exercise list.",
        buttons: [NO, { text: "Hide", value: true, style: "destructive" }] });
      if (ok) { store.archiveExercise(ex.id, true); api.close(); toast(`${ex.name} hidden`); }
    } }, "Hide this exercise") : null);
  const api = sheet({
    title: isNew ? "New exercise" : "Exercise", className: dark ? "dark-scope" : "",
    left: { text: "Cancel" },
    right: { text: isNew ? "Add" : "Save", bold: true, disabled: !ex.name.trim(), onClick: (a) => {
      const clean = { ...ex, name: ex.name.trim() };
      if (!clean.name) return;
      if (isNew && store.data.exercises.some((e) => !e.archived && e.name.toLowerCase() === clean.name.toLowerCase())) {
        toast("There's already an exercise with that name"); return;
      }
      store.saveExercise(clean);
      a.close();
      onSaved?.(clean);
    } },
    body,
  });
  if (isNew) setTimeout(() => nameIn.focus(), 350);
  return api;
}

/** Every exercise: tap one to change it; hidden ones at the end */
export function openLibrary() {
  const body = h("div", { class: "form" });
  const search = selectOnFocus(h("input", { class: "search-input", type: "search", placeholder: "Search", autocomplete: "off", "aria-label": "Search exercises" }));
  let showHidden = false;
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const match = (e) => !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q);
    const parts = [h("div", { class: "search-wrap", style: { marginTop: "4px" } }, icon("search", 16, "search-icon"), search),
      h("div", { class: "group", style: { marginTop: "12px" } }, h("button", { type: "button", class: "action-row", onclick: () => openExerciseEditor(null, { name: search.value.trim() }) },
        icon("plus", 20, "row-icon"), h("span", { class: "action-text" }, "New exercise"), icon("chevron", 15, "chev")))];
    for (const m of MUSCLES) {
      const rows = store.data.exercises.filter((e) => !e.archived && e.muscle === m && match(e));
      if (!rows.length) continue;
      parts.push(caption(m), h("div", { class: "group" }, rows.map((e) => h("button", { type: "button", class: "pick-row", onclick: () => openExerciseEditor(e) },
        h("span", { class: "pick-name" }, e.name, h("div", { class: "pick-kind" }, KIND_LABELS[e.kind])), icon("chevron", 15, "chev")))));
    }
    const hidden = store.data.exercises.filter((e) => e.archived && match(e));
    if (hidden.length) {
      parts.push(caption("Hidden", h("button", { type: "button", class: "link-btn", onclick: () => { showHidden = !showHidden; draw(); } }, showHidden ? "Close" : `Show ${hidden.length}`)));
      if (showHidden) parts.push(h("div", { class: "group" }, hidden.map((e) => h("div", { class: "pick-row" },
        h("span", { class: "pick-name" }, e.name, h("div", { class: "pick-kind" }, e.muscle)),
        h("button", { type: "button", class: "link-btn", onclick: () => { store.archiveExercise(e.id, false); toast(`${e.name} is back`); } }, "Show again")))));
    }
    body.replaceChildren(...parts);
  };
  search.addEventListener("input", draw);
  draw();
  const off = store.on((k) => { if (k === "data") draw(); });
  sheet({ title: "Exercises", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body, onClose: off });
}

// ---------------------------------------------------------------------------
// One exercise in a workout
// ---------------------------------------------------------------------------
/** Another exercise instead of one: the same movement first, then the same muscle group, then any (with
 *  search). Used in a workout (only for today) and in the plan (from now on). */
export function openSwapPicker({ exId, exclude = [], dark = false, intro = "", onPick }) {
  const data = store.data, ex = exerciseMap(data).get(exId), name = ex?.name || "this exercise";
  const { similar, same } = alternatives(data, exId, exclude);
  let api = null;
  const row = (o) => {
    const last = lastFor(data, o.id);
    return h("button", { type: "button", class: "pick-row", onclick: () => { api.close(); onPick(o.id); } },
      h("span", { class: "pick-name" }, o.name, h("div", { class: "pick-kind" }, last ? `Last: ${setsLine(data, last.entry)} · ${relDay(last.session.date)}` : "Not done yet")),
      icon("chevron", 15, "chev"));
  };
  const body = h("div", { class: "form" },
    intro ? h("div", { class: "info-text", style: { padding: "8px 4px 0" } }, h("p", null, intro)) : null,
    similar.length ? [caption("Similar"), h("div", { class: "group" }, similar.map(row))] : null,
    same.length ? [caption(ex?.muscle ? `Other ${ex.muscle.toLowerCase()} exercises` : "Other exercises"), h("div", { class: "group" }, same.map(row))] : null,
    group(actionRow("search", "Another exercise", () => {
      api.close();
      openExercisePicker({ title: `Instead of ${name}`, multi: false, dark, exclude, onDone: ([id]) => { if (id) onPick(id); } });
    })));
  api = sheet({ title: `Swap ${name}`, left: { text: "Cancel" }, body, className: dark ? "dark-scope" : "" });
}

function openItemEditor(item, workoutRest, { onSave, onRemove, onMove, onSwap = null, canUp, canDown, nextName = null, linked = false, onLink = null }) {
  const ex = exerciseMap(store.data).get(item.ex);
  const kind = ex?.kind || "weight", unit = timeUnit(ex);
  const it = { ...item };
  if (kind === "time") it.secs = it.secs || (unit === "min" ? 1200 : 60); else it.reps = it.reps || 10;
  const body = h("div", { class: "form" });
  const setsStep = stepper(it.sets, { min: 1, max: 12, label: "sets", onChange: (v) => { it.sets = v; } });
  const rows = [h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, "Sets"), setsStep)];
  if (kind === "time") {
    const isMin = unit === "min";
    rows.push(h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, isMin ? "Minutes" : "Time"),
      stepper(it.secs || (isMin ? 1200 : 60), { step: isMin ? 60 : 15, min: isMin ? 60 : 5, max: 7200, label: "time",
        format: (v) => fmtSecs(v, unit), onChange: (v) => { it.secs = v; } })));
  } else {
    // a range (8–12): when every set reaches the top, the workout suggests adding weight
    const hiStep = stepper(it.hi || it.reps, { min: 1, max: 100, label: "top of the range", format: (v) => (v > it.reps ? String(v) : "–"),
      onChange: (v) => { it.hi = v > it.reps ? v : null; } });
    rows.push(h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, "Reps"),
      stepper(it.reps || 10, { min: 1, max: 100, label: "reps", onChange: (v) => { it.reps = v; if (it.hi && it.hi <= v) it.hi = null; hiStep.set(it.hi || v); } })));
    rows.push(h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, "Up to"), hiStep));
    const wIn = selectOnFocus(h("input", { class: "form-input", type: "text", inputmode: "decimal", value: it.w ? fmtKg(it.w) : "",
      placeholder: "Last time's", "aria-label": kind === "reps" ? "Added weight" : "Weight" }));
    wIn.addEventListener("input", () => { it.w = parseNum(wIn.value); });
    rows.push(h("label", { class: "form-row" }, h("span", { class: "form-label" }, kind === "reps" ? "Added weight" : "Weight"), wIn, h("span", { class: "form-unit" }, "kg")));
  }
  const restValue = h("span", { class: "action-value" });
  const showRest = () => { restValue.textContent = it.rest === null || it.rest === undefined ? `Same as the workout (${fmtRest(workoutRest)})` : fmtRest(it.rest); };
  showRest();
  const restRow = h("button", { type: "button", class: "action-row", style: { color: "var(--label)" }, onclick: async () => {
    const v = await chooseRest(it.rest ?? workoutRest, { title: `Rest after each set of ${ex?.name || "this exercise"}`,
      extra: { text: `Same as the workout (${fmtRest(workoutRest)})`, value: "same", checked: it.rest === null || it.rest === undefined } });
    if (v === null) return;
    it.rest = v === "same" ? null : v;
    showRest();
  } }, h("span", { class: "action-text" }, "Rest"), restValue, icon("chevron", 15, "chev"));
  body.append(
    ...(onSwap ? [group(h("button", { type: "button", class: "action-row", onclick: () => { api.close(); onSwap(it); } },
      icon("sync", 20, "row-icon"), h("span", { class: "action-text" }, "Swap for another exercise"), icon("chevron", 15, "chev")))] : []),
    caption("Target"), group(rows),
    footer(kind === "time" ? "" : "Up to: the top of a rep range (8–12). When every set reaches it, the workout tells you to add weight. The weight is only a starting point: each set starts from what you lifted last time."),
    caption("Rest"), group(restRow),
    ...(nextName ? [caption("Superset"), group(switchRow(`With ${nextName}`, linked, (on) => onLink?.(on), "link")),
      footer("One set of this, then one of the next exercise, then rest. It saves time; pairs that work different muscles (a press and a row) keep your strength best.")] : []),
    group(canUp ? h("button", { type: "button", class: "action-row", onclick: () => { api.close(); onMove(-1, it); } }, icon("arrowUp", 20, "row-icon"), h("span", { class: "action-text" }, "Move up"), icon("chevron", 15, "chev")) : null,
      canDown ? h("button", { type: "button", class: "action-row", onclick: () => { api.close(); onMove(1, it); } }, icon("arrowDown", 20, "row-icon"), h("span", { class: "action-text" }, "Move down"), icon("chevron", 15, "chev")) : null),
    h("button", { type: "button", class: "btn destructive-row", onclick: () => { api.close(); onRemove(); } }, "Remove from this workout"));
  if (!canUp && !canDown) body.children[body.children.length - 2].remove();
  const api = sheet({ title: ex?.name || "Exercise", left: { text: "Cancel" }, right: { text: "Done", bold: true, onClick: (a) => { a.close(); onSave(it); } }, body });
}

// ---------------------------------------------------------------------------
// A workout
// ---------------------------------------------------------------------------
export function openWorkoutEditor(workout = null) {
  const data = store.data;
  const isNew = !workout;
  const used = new Set(data.workouts.map((w) => w.color));
  const w = workout ? structuredClone(workout)
    : { id: uid("w"), name: "", color: COLORS.find((c) => !used.has(c)) || "blue", rest: data.settings.rest, items: [] };
  const days = new Set(WEEK_ORDER.filter((d) => data.schedule[String(d)] === w.id));
  const before = JSON.stringify([w, [...days]]);
  const body = h("div", { class: "form" });
  let api = null;

  const nameIn = h("input", { class: "form-input left", type: "text", value: w.name, placeholder: "Name, for example Back", autocapitalize: "words", "aria-label": "Name" });
  nameIn.addEventListener("input", () => { w.name = nameIn.value; api?.setRight({ disabled: !w.name.trim() }); drawHead(); });
  const head = h("div", { style: { display: "flex", justifyContent: "center", padding: "10px 0 0" } });
  const drawHead = () => head.replaceChildren(tile(w.color, initials(w.name || "?"), 64));

  const swatches = h("div", { class: "swatches" });
  const drawSwatches = () => swatches.replaceChildren(...COLORS.map((c) => h("button", { type: "button", class: `swatch c-${c} ${c === w.color ? "on" : ""}`, "aria-label": c,
    onclick: () => { w.color = c; drawSwatches(); drawHead(); } }, c === w.color ? icon("check", 16) : null)));

  const dayChips = h("div", { class: "day-chips" });
  const dayFoot = footer("");
  const drawDays = () => {
    dayChips.replaceChildren(...WEEK_ORDER.map((d) => {
      const other = data.schedule[String(d)] && data.schedule[String(d)] !== w.id ? data.workouts.find((x) => x.id === data.schedule[String(d)]) : null;
      return h("button", { type: "button", class: `day-chip ${days.has(d) ? "on" : ""} ${other ? "taken" : ""}`, "aria-pressed": String(days.has(d)),
        "aria-label": WEEKDAYS[d], onclick: () => { if (days.has(d)) days.delete(d); else days.add(d); drawDays(); } }, WEEKDAYS[d].slice(0, 3));
    }));
    const taken = [...days].map((d) => [d, data.schedule[String(d)]]).filter(([, id]) => id && id !== w.id)
      .map(([d, id]) => `${WEEKDAYS[d]} (now ${data.workouts.find((x) => x.id === id)?.name})`);
    dayFoot.textContent = taken.length ? `This workout takes over ${taken.join(", ")}.` : days.size ? "" : "Not on any day yet: you can still start it from Today.";
  };

  const presets = h("div", { class: "rest-presets" });
  const restStep = stepper(w.rest, { step: 15, min: 0, max: 600, label: "rest", format: fmtRest, onChange: (v) => { w.rest = v; drawRest(); drawItems(); } });
  const drawRest = () => {
    restStep.set(w.rest);
    presets.replaceChildren(...[45, 60, 90, 120, 180].map((v) => h("button", { type: "button", class: `preset ${w.rest === v ? "on" : ""}`, onclick: () => { w.rest = v; drawRest(); drawItems(); } }, fmtRest(v))));
  };
  const restRow = h("div", null,
    h("div", { class: "form-row stepper-row" }, h("span", { class: "form-label" }, "Between sets"), restStep),
    presets);

  const items = h("div", { class: "group" });
  const drawItems = () => {
    const exMap = exerciseMap(store.data);
    const ss = supersets(w.items);
    // the editor works on a copy of the exercise: its superset is the list's, so it's kept from there
    const keepGroup = (i, n) => { const g = w.items[i].group; if (g) n.group = g; else delete n.group; return n; };
    items.replaceChildren(...w.items.map((it, i) => {
      const ex = exMap.get(it.ex);
      const next = w.items[i + 1] ? exMap.get(w.items[i + 1].ex) : null;
      return h("button", { type: "button", class: `item-row ${ss[i] ? "ss" : ""}`, onclick: () => openItemEditor(it, w.rest, {
        canUp: i > 0, canDown: i < w.items.length - 1,
        nextName: next ? next.name : null, linked: Boolean(ss[i] && i < ss[i].end),
        onLink: (on) => { linkNext(w.items, i, on); drawItems(); },
        onSave: (n) => { w.items[i] = keepGroup(i, n); drawItems(); },
        // another exercise in its place: the same sets, reps, rest and superset (its own weights from last time)
        onSwap: (n) => {
          w.items[i] = keepGroup(i, n);
          drawItems();
          openSwapPicker({ exId: n.ex, exclude: w.items.map((x) => x.ex),
            intro: "It takes this one's place in the workout, with the same sets, reps and rest. Each set starts from what you lifted on it last time.",
            onPick: (id) => {
              const all = exerciseMap(store.data), was = all.get(n.ex), nx = all.get(id);
              const item = keepGroup(i, { ...w.items[i], ex: id, w: null });
              const toTime = nx?.kind === "time", fromTime = was?.kind === "time";
              if (toTime && !fromTime) { item.secs = timeUnit(nx) === "min" ? 1200 : 60; item.reps = null; item.hi = null; }
              else if (fromTime && !toTime) { item.reps = 10; item.hi = null; item.secs = null; }
              w.items[i] = item;
              drawItems();
              toast(`${nx?.name || "Swapped"} instead of ${was?.name || "the old one"}`);
            } });
        },
        onRemove: () => { w.items.splice(i, 1); drawItems(); },
        onMove: (by, n) => { w.items[i] = keepGroup(i, n); const [x] = w.items.splice(i, 1); w.items.splice(i + by, 0, x); drawItems(); },
      }) },
      h("span", { class: "item-num" }, String(i + 1)),
      h("span", { class: "item-text" }, h("span", { class: "item-name" }, ex?.name || "Exercise"),
        h("span", { class: "item-sub" }, ss[i] ? h("span", { class: "ss-tag" }, `Superset ${ss[i].label} · `) : null, itemLine(it, ex, w.rest))),
      icon("chevron", 15, "chev"));
    }), h("button", { type: "button", class: "action-row", onclick: () => openExercisePicker({ title: `Add to ${w.name || "the workout"}`, exclude: w.items.map((x) => x.ex), onDone: (ids) => {
      const exMap2 = exerciseMap(store.data);
      for (const id of ids) { const ex = exMap2.get(id); if (ex) w.items.push(newItem(ex)); }
      drawItems();
    } }) }, icon("plus", 20, "row-icon"), h("span", { class: "action-text" }, "Add exercises"), icon("chevron", 15, "chev")));
  };

  drawHead(); drawSwatches(); drawDays(); drawRest(); drawItems();
  const fromRec = isNew ? h("div", { class: "group", style: { marginTop: "14px" } },
    h("button", { type: "button", class: "action-row", onclick: () => openRecommended({ onPick: (rw) => {
      Object.assign(w, { name: rw.name, color: rw.color, rest: rw.rest, items: rw.items.map((it) => ({ ...it, id: uid("i") })) });
      nameIn.value = w.name;
      api.setRight({ disabled: !w.name.trim() });
      drawHead(); drawSwatches(); drawRest(); drawItems();
      toast(`Started from ${rw.name}: change anything you like`);
    } }) }, icon("sparkle", 20, "row-icon"),
    h("span", { class: "action-text" }, "Start from a recommended workout", h("span", { class: "action-detail" }, "Exercises picked from the research, for each muscle group")), icon("chevron", 15, "chev"))) : null;
  body.append(head, fromRec, caption("Name"), group(h("label", { class: "form-row" }, nameIn)),
    caption("Colour"), h("div", { class: "group" }, swatches),
    caption("Days"), h("div", { class: "group" }, dayChips), dayFoot,
    caption("Rest"), h("div", { class: "group" }, restRow),
    footer("The rest timer starts each time you tap Set done. You can give an exercise its own rest (tap it below)."),
    caption("Exercises"), items,
    !isNew ? h("button", { type: "button", class: "btn destructive-row", onclick: async () => {
      const ok = await alertBox({ title: `Delete ${w.name}?`, message: "It leaves your week. The workouts you've logged stay in History.",
        buttons: [NO, { text: "Delete", value: true, style: "destructive" }] });
      if (!ok) return;
      store.deleteWorkout(w.id);
      api.close();
      toast(`${w.name} deleted`);
    } }, "Delete workout") : null);

  api = sheet({
    title: isNew ? "New workout" : w.name || "Workout",
    left: { text: "Cancel", onClick: async (a) => {
      if (JSON.stringify([w, [...days]]) !== before) {
        const ok = await alertBox({ title: "Discard the changes?", buttons: [{ text: "Keep editing", value: false, style: "cancel" }, { text: "Discard", value: true, style: "destructive" }] });
        if (!ok) return;
      }
      a.close();
    } },
    right: { text: "Save", bold: true, disabled: !w.name.trim(), onClick: (a) => {
      w.name = w.name.trim();
      if (!w.name) return;
      store.saveWorkout(w);
      for (const d of WEEK_ORDER) {
        const has = store.data.schedule[String(d)] === w.id;
        if (days.has(d) && !has) store.setDay(d, w.id);
        else if (!days.has(d) && has) store.setDay(d, null);
      }
      a.close();
      toast(isNew ? `${w.name} added${days.size ? ` on ${[...days].map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")}` : ""}` : "Saved");
    } },
    body,
  });
  if (isNew) setTimeout(() => nameIn.focus(), 350);
}

