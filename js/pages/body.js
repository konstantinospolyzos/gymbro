// Body weight: log it now and then (at the same time of day, like in the morning) and see it over time.

import { h, icon, sheet, group, caption, footer, toast, alertBox, selectOnFocus, chip } from "../ui.js";
import { store } from "../store.js";
import { fmtKg, kg, parseNum, isoDay, today, parseDay, shortDate, relDay, bodyTrend, MINUS, NBSP } from "../core.js";
import { lineChart, sparkline } from "../charts.js";
import { NO } from "./common.js";

const changeText = (c) => `${c > 0 ? "+" : c < 0 ? MINUS : "±"}${kg(Math.abs(c))}`;

/** The card in Progress: the latest weight, the change in a month, a small trend */
export function bodyCard(data) {
  const t = bodyTrend(data);
  return h("button", { type: "button", class: "card body-card", onclick: () => openBodyWeight() },
    h("div", { class: "card-head" }, h("div", { class: "card-title" }, "Body weight"), icon("chevron", 15, "chev")),
    t ? h("div", { class: "body-row" },
      h("div", null, h("div", { class: "chart-big" }, fmtKg(t.last.kg), h("small", null, `${NBSP}kg`)),
        h("div", { class: "body-sub" }, `${relDay(t.last.date)}${t.change !== null ? ` · ${changeText(t.change)} in 30 days` : ""}`)),
      t.count > 1 ? sparkline(data.body.slice(-12).map((b) => b.kg), { width: 96, height: 32 }) : null)
      : h("div", { class: "body-sub" }, "Log your weight now and then to see how it changes."));
}

/** Log a weigh-in, or change or delete one */
export function openBodyEntry(entry = null) {
  const now = isoDay(today());
  const last = (store.data.body || []).at(-1);
  const day = h("input", { class: "form-input", type: "date", value: entry?.date || now, max: now, "aria-label": "Day" });
  const kgIn = selectOnFocus(h("input", { class: "form-input", type: "text", inputmode: "decimal", autocomplete: "off",
    value: entry ? fmtKg(entry.kg).replace(/ /g, "") : "", placeholder: last ? fmtKg(last.kg).replace(/ /g, "") : "kg", "aria-label": "Weight in kg" }));
  let api = null;
  const remove = async () => {
    const ok = await alertBox({ title: "Delete this weigh-in?", message: `${shortDate(parseDay(entry.date))}: ${kg(entry.kg)}`,
      buttons: [NO, { text: "Delete", value: true, style: "destructive" }] });
    if (!ok) return;
    api.close();
    store.putBody(entry.date, null);
  };
  const body = h("div", { class: "form" },
    group(h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Day"), day),
      h("label", { class: "form-row" }, h("span", { class: "form-label" }, "Weight"), kgIn, h("span", { class: "form-unit" }, "kg"))),
    footer("Weigh yourself at the same time of day, like in the morning before breakfast, so the numbers compare."),
    entry ? h("button", { type: "button", class: "btn destructive-row", onclick: remove }, "Delete") : null);
  api = sheet({ title: entry ? "Change weigh-in" : "Log weight", left: { text: "Cancel" }, body,
    right: { text: "Save", bold: true, onClick: (a) => {
      const v = parseNum(kgIn.value), d = day.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > now) { toast("Choose a day up to today"); return; }
      if (v === null || v < 20 || v > 400) { toast("Type your weight in kg"); return; }
      a.close();
      if (entry && entry.date !== d) store.putBody(entry.date, null);
      store.putBody(d, v);
      toast(`✓  ${kg(v)}`);
    } } });
}

/** Every weigh-in: the chart and the list */
export function openBodyWeight() {
  const body = h("div", { class: "sheet-stack" });
  const build = () => {
    const list = store.data.body || [];
    const t = bodyTrend(store.data);
    const parts = [h("button", { type: "button", class: "btn primary wide", onclick: () => openBodyEntry() }, icon("plus", 18), "Log weight")];
    if (t) {
      parts.push(h("div", { class: "card chart-card" },
        h("div", { class: "chart-top" },
          h("div", null, h("div", { class: "caption" }, `Latest · ${relDay(t.last.date)}`), h("div", { class: "chart-big" }, fmtKg(t.last.kg), h("small", null, `${NBSP}kg`))),
          t.change !== null ? chip(`${changeText(t.change)} in 30 days`, "flat") : null),
        list.length > 1 ? lineChart(list.map((b) => ({ x: parseDay(b.date).getTime(), y: b.kg, tip: { value: kg(b.kg), title: shortDate(parseDay(b.date)) } })),
          { height: 180, format: (v) => fmtKg(v), ariaLabel: "Body weight over time" }) : null));
      parts.push(caption("Every weigh-in"), h("div", { class: "group" }, [...list].reverse().map((b, i, arr) => {
        const prev = arr[i + 1], d = prev ? Math.round((b.kg - prev.kg) * 10) / 10 : null;
        return h("button", { type: "button", class: "action-row", style: { color: "var(--label)" }, onclick: () => openBodyEntry(b) },
          h("span", { class: "action-text" }, shortDate(parseDay(b.date))),
          h("span", { class: "action-value num" }, kg(b.kg), d ? h("span", { class: "body-delta" }, ` ${changeText(d)}`) : null),
          icon("chevron", 15, "chev"));
      })));
    } else {
      parts.push(h("div", { class: "card empty-state" }, icon("progress", 40, "empty-icon"), h("div", { class: "empty-title" }, "No weigh-ins yet"),
        h("div", { class: "empty-text" }, "Log your weight now and then, at the same time of day, to see it change over the weeks.")));
    }
    body.replaceChildren(...parts);
  };
  build();
  const off = store.on(build);
  sheet({ title: "Body weight", right: { text: "Done", bold: true, onClick: (a) => a.close() }, body, onClose: off });
}
