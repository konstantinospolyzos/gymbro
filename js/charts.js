// Touch-friendly SVG charts: weekly bars, an exercise's line over time, sparklines and the muscle split.
// Drag a finger (or move the mouse) across a chart to read each value. One series per chart, so the
// card's title names it; thin marks, hairline grid, the value in the tooltip and in the list below.

import { h, s } from "./ui.js";

function niceStep(range, count) {
  const raw = range / Math.max(count, 1);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function ticks(lo, hi, count = 3) {
  if (hi <= lo) hi = lo + 1;
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** The frame both charts share: measures its width, redraws when it changes, shows one tooltip */
function frame(height, draw) {
  const wrap = h("div", { class: "chart", style: { height: `${height}px` } });
  const tip = h("div", { class: "chart-tip", "aria-hidden": "true" });
  wrap.appendChild(tip);
  let width = 0, api = null, hideTimer = null;
  const render = () => {
    const w = Math.round(wrap.clientWidth);
    if (!w || w === width) return;
    width = w;
    wrap.querySelector("svg")?.remove();
    api = draw(w, height);
    wrap.insertBefore(api.svg, tip);
  };
  const ro = new ResizeObserver(render);
  ro.observe(wrap);
  const pick = (ev) => {
    if (!api) return;
    const r = wrap.getBoundingClientRect();
    const i = api.nearest(ev.clientX - r.left);
    if (i < 0) return;
    const t = api.tip(i);
    tip.replaceChildren(h("div", { class: "tip-value" }, t.value), t.title ? h("div", { class: "tip-title" }, t.title) : null,
      t.sub ? h("div", { class: "tip-sub" }, t.sub) : null);
    const x = api.xOf(i);
    tip.classList.add("show");
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(x - tw / 2, 0), width - tw)}px`;
    api.highlight(i);
    clearTimeout(hideTimer);
  };
  const hide = (delay) => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { tip.classList.remove("show"); api?.highlight(-1); }, delay); };
  wrap.addEventListener("pointerdown", (ev) => pick(ev));
  wrap.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse" || ev.buttons) pick(ev); });
  wrap.addEventListener("pointerup", (ev) => hide(ev.pointerType === "mouse" ? 1200 : 2200));
  wrap.addEventListener("pointerleave", () => hide(300));
  wrap.addEventListener("pointercancel", () => hide(300));
  return wrap;
}

/**
 * Columns, one per item: [{label, value, current, tip: {value, title, sub}}]
 * opts: {height, goal (a dashed line), format: axis label}
 */
export function barChart(items, { height = 170, goal = null, format = String, ariaLabel = "" } = {}) {
  const el = frame(height, (W, H) => {
    const pad = { l: 2, r: 34, t: 10, b: 22 };
    const max = Math.max(...items.map((d) => d.value), goal || 0, 1);
    const tk = ticks(0, max, 3);
    const top = tk.at(-1);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const slot = iw / items.length;
    const bw = Math.min(24, slot * 0.56);
    const y = (v) => pad.t + ih - (v / top) * ih;
    const xOf = (i) => pad.l + slot * i + slot / 2;
    const svg = s("svg", { class: "chart-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ariaLabel });
    for (const t of tk) {
      svg.appendChild(s("line", { class: t === 0 ? "axis" : "grid", x1: pad.l, x2: W - pad.r + 4, y1: y(t), y2: y(t) }));
      svg.appendChild(s("text", { class: "axis-label", x: W - pad.r + 8, y: y(t) + 3.5 }, format(t)));
    }
    const bars = items.map((d, i) => {
      const x = xOf(i) - bw / 2, yt = y(d.value), hgt = Math.max(0, pad.t + ih - yt);
      const r = Math.min(4, hgt, bw / 2);
      const path = hgt > 0
        ? `M${x},${pad.t + ih}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${pad.t + ih}Z`
        : "";
      const b = s("path", { class: `bar ${d.current ? "current" : ""} ${d.muted ? "muted" : ""}`, d: path });
      svg.appendChild(b);
      return b;
    });
    if (goal) {
      svg.appendChild(s("line", { class: "goal-line", x1: pad.l, x2: W - pad.r + 4, y1: y(goal), y2: y(goal) }));
    }
    // a label every few columns, always the last
    const every = Math.ceil(items.length / Math.max(1, Math.floor(iw / 52)));
    items.forEach((d, i) => {
      if ((items.length - 1 - i) % every) return;
      svg.appendChild(s("text", { class: "axis-label mid", x: xOf(i), y: H - 5 }, d.label));
    });
    return {
      svg, xOf,
      nearest: (px) => Math.min(items.length - 1, Math.max(0, Math.floor((px - pad.l) / slot))),
      tip: (i) => items[i].tip,
      highlight: (i) => bars.forEach((b, k) => b.classList.toggle("dim", i >= 0 && k !== i)),
    };
  });
  return el;
}

/**
 * A line over time: points [{x (ms), y, tip: {value, title, sub}, record}] in date order.
 * opts: {height, format}
 */
export function lineChart(points, { height = 190, format = String, ariaLabel = "" } = {}) {
  return frame(height, (W, H) => {
    const pad = { l: 8, r: 40, t: 14, b: 22 };
    const ys = points.map((p) => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const span = hi - lo || Math.max(hi * 0.1, 1);
    lo = Math.max(0, lo - span * 0.25); hi += span * 0.2;
    const tk = ticks(lo, hi, 3);
    const yLo = tk[0], yHi = tk.at(-1);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const x0 = points[0].x, x1 = points.at(-1).x;
    const xOf = (i) => (points.length === 1 ? pad.l + iw / 2 : pad.l + ((points[i].x - x0) / (x1 - x0 || 1)) * iw);
    const y = (v) => pad.t + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;
    const svg = s("svg", { class: "chart-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ariaLabel });
    for (const t of tk) {
      svg.appendChild(s("line", { class: "grid", x1: pad.l, x2: W - pad.r + 4, y1: y(t), y2: y(t) }));
      svg.appendChild(s("text", { class: "axis-label", x: W - pad.r + 8, y: y(t) + 3.5 }, format(t)));
    }
    const pts = points.map((p, i) => [xOf(i), y(p.y)]);
    if (pts.length > 1) {
      const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
      svg.appendChild(s("path", { class: "area", d: `${d}L${pts.at(-1)[0].toFixed(1)},${pad.t + ih}L${pts[0][0].toFixed(1)},${pad.t + ih}Z` }));
      svg.appendChild(s("path", { class: "line", d }));
    }
    const guide = s("line", { class: "guide", y1: pad.t, y2: pad.t + ih, x1: -10, x2: -10 });
    svg.appendChild(guide);
    const dots = pts.map(([px, py], i) => {
      const show = points[i].record || i === pts.length - 1 || pts.length <= 16;
      const c = s("circle", { class: `point ${points[i].record ? "record" : ""} ${show ? "" : "quiet"}`, cx: px, cy: py, r: 4 });
      svg.appendChild(c);
      return c;
    });
    // first and last dates under the line
    const dl = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short" });
    svg.appendChild(s("text", { class: "axis-label", x: pad.l, y: H - 5 }, dl(x0)));
    if (points.length > 1) svg.appendChild(s("text", { class: "axis-label end", x: W - pad.r, y: H - 5 }, dl(x1)));
    return {
      svg, xOf,
      nearest: (px) => {
        let best = -1, bd = Infinity;
        pts.forEach(([x], i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } });
        return best;
      },
      tip: (i) => points[i].tip,
      highlight: (i) => {
        dots.forEach((c, k) => c.classList.toggle("on", k === i));
        guide.setAttribute("x1", i >= 0 ? pts[i][0] : -10);
        guide.setAttribute("x2", i >= 0 ? pts[i][0] : -10);
      },
    };
  });
}

/** A tiny trend line: the last value gets a dot */
export function sparkline(values, { width = 64, height = 24 } = {}) {
  const svg = s("svg", { class: "spark", width, height, viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true" });
  if (values.length < 2) return svg;
  const lo = Math.min(...values), hi = Math.max(...values);
  const x = (i) => 3 + (i / (values.length - 1)) * (width - 6);
  const y = (v) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6);
  svg.appendChild(s("path", { class: "spark-line", d: values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") }));
  svg.appendChild(s("circle", { class: "spark-dot", cx: x(values.length - 1), cy: y(values.at(-1)), r: 2.6 }));
  return svg;
}

/** Horizontal bars with the label and value as text: [{label, value, text}] */
export function hbars(items) {
  const max = Math.max(...items.map((d) => d.value), 1);
  return h("div", { class: "hbars" }, items.map((d) => h("div", { class: "hbar-row" },
    h("span", { class: "hbar-label" }, d.label),
    h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: `${Math.max(3, (d.value / max) * 100)}%` } })),
    h("span", { class: "hbar-value" }, d.text ?? String(d.value)))));
}
