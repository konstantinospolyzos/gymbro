// Small iOS-style building blocks (the same as the Savings Tracker's and Glosor's): elements, icons,
// sheets, action sheets, alerts, toasts, steppers.

export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv;
    }
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVGNS = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) if (c) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// ---------------------------------------------------------------------------
// Icons (simple strokes, tinted with currentColor)
// ---------------------------------------------------------------------------
const F = 'fill="currentColor" stroke="none"';
const ICONS = {
  dumbbell: '<rect x="4.4" y="7" width="3.2" height="10" rx="1.3"/><rect x="16.4" y="7" width="3.2" height="10" rx="1.3"/><path d="M2.4 10.2v3.6M21.6 10.2v3.6M7.6 12h8.8"/>',
  calendar: '<rect x="3.8" y="5" width="16.4" height="15.2" rx="3"/><path d="M3.8 9.9h16.4M8.2 3.2v3.4M15.8 3.2v3.4"/>',
  history: '<path d="M4.3 12a7.7 7.7 0 1 0 2.3-5.5"/><path d="M4.5 4.4v3.8h3.8"/><path d="M12 8.2V12l2.8 1.9"/>',
  progress: '<path d="M4 17.5l5.2-5.6 3.6 3.4L20 7.5"/><path d="M15.5 7.5H20V12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5.5 12h13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  cloud: '<path d="M7.2 18.5h10a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 6.9 9.3 4.6 4.6 0 0 0 7.2 18.5z"/>',
  cloudCheck: '<path d="M7.2 18.5h10a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 6.9 9.3 4.6 4.6 0 0 0 7.2 18.5z"/><path d="M9.6 13.6l1.9 1.9 3.4-3.6"/>',
  cloudUp: '<path d="M7.2 18.5h10a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 6.9 9.3 4.6 4.6 0 0 0 7.2 18.5z"/><path d="M12 16.2v-5M9.9 13.2l2.1-2.1 2.1 2.1"/>',
  cloudOff: '<path d="M7.2 18.5h10a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 6.9 9.3 4.6 4.6 0 0 0 7.2 18.5z"/><path d="M4 4l16 16"/>',
  phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M10.5 18h3"/>',
  sync: '<path d="M19 8.5A7.5 7.5 0 0 0 5.6 7.4M5 15.5a7.5 7.5 0 0 0 13.4 1.1"/><path d="M19.2 4.2v4.4h-4.4M4.8 19.8v-4.4h4.4"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  chevronUp: '<path d="M6 14.5l6-6 6 6"/>',
  close: '<path d="M7 7l10 10M17 7L7 17"/>',
  check: '<path d="M5 12.6l4.3 4.3L19 7.2"/>',
  checkBold: '<path d="M5 12.8l4.4 4.4L19.2 7.4" stroke-width="2.8"/>',
  trash: '<path d="M4.6 7h14.8M9.6 7V4.6h4.8V7M6.6 7l1 12.4h8.8l1-12.4"/>',
  edit: '<path d="M15.1 5.3l3.6 3.6L8.6 19H5v-3.6z"/>',
  play: `<path d="M8 5.7v12.6c0 .7.8 1.1 1.3.7l9.6-6.3c.5-.3.5-1.1 0-1.4L9.3 5c-.5-.4-1.3 0-1.3.7z" ${F}/>`,
  timer: '<circle cx="12" cy="13.4" r="7.4"/><path d="M12 13.4V9.6M9.8 2.8h4.4M18 7.2l1.4-1.4"/>',
  flame: '<path d="M12 20.6c-3.6 0-6.4-2.6-6.4-6.1 0-3.3 2.5-5.2 3.5-8.2.8 1.6 1.9 2.5 3.1 2.9.1-2.5 1-4.7 3-6.2-.4 2.7.6 4.6 2 6.3 1.1 1.4 1.4 3 1.4 4.6 0 4-2.9 6.7-6.6 6.7z"/>',
  trophy: '<path d="M8 4.2h8v4.6a4 4 0 0 1-8 0z"/><path d="M8 5.8H5.4a2.7 2.7 0 0 0 2.9 3.7M16 5.8h2.6a2.7 2.7 0 0 1-2.9 3.7"/><path d="M12 12.8v3.4M9 19.8h6M10.2 16.2h3.6l.5 3.6H9.7z"/>',
  more: `<circle cx="6" cy="12" r="1.6" ${F}/><circle cx="12" cy="12" r="1.6" ${F}/><circle cx="18" cy="12" r="1.6" ${F}/>`,
  moon: '<path d="M19.5 14.8A7.9 7.9 0 0 1 9.2 4.5a7.9 7.9 0 1 0 10.3 10.3z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.4"/><path d="M15.5 8.5V6.4a1.9 1.9 0 0 0-1.9-1.9H6.4a1.9 1.9 0 0 0-1.9 1.9v7.2a1.9 1.9 0 0 0 1.9 1.9h2.1"/>',
  arrowUp: '<path d="M12 19V5.5M6.5 11L12 5.5 17.5 11"/>',
  arrowDown: '<path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/>',
  bolt: '<path d="M13.2 3.5L5.8 13.2h5.4l-1 7.3 7.4-9.7h-5.4z"/>',
  speaker: '<path d="M4.5 9.4h3.2L12 5.6v12.8l-4.3-3.8H4.5z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M17.9 6.7a7.6 7.6 0 0 1 0 10.6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  search: '<circle cx="10.6" cy="10.6" r="6"/><path d="M15.2 15.2l4.6 4.6"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.6" cy="7" r="1.1" fill="currentColor"/><circle cx="4.6" cy="12" r="1.1" fill="currentColor"/><circle cx="4.6" cy="17" r="1.1" fill="currentColor"/>',
  sparkle: '<path d="M12 3.6l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.6 15.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  skip: '<path d="M5.5 6.6v10.8L13.6 12z"/><path d="M13.6 6.6v10.8L21.7 12z"/>',
  stopwatch: '<circle cx="12" cy="13.6" r="7.2"/><path d="M12 13.6l3-3M10 2.8h4M12 2.8v3.6"/>',
};

export function icon(name, size = 22, extra = "") {
  const span = document.createElement("span");
  span.className = `icon ${extra}`;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  return span;
}

// ---------------------------------------------------------------------------
// Little pieces
// ---------------------------------------------------------------------------
export const chip = (text, tone = "flat", extra = "") => h("span", { class: `chip tone-${tone} ${extra}` }, text);
export const dot = (color, size = 8) => h("span", { class: `dot c-${color}`, style: { width: `${size}px`, height: `${size}px` } });
export const caption = (text, extra = null) => h("div", { class: "section-caption" }, h("span", null, text), extra);
export const footer = (text) => h("div", { class: "section-footer" }, text);
export const group = (...rows) => h("div", { class: "group" }, rows.flat().filter(Boolean));

/** A workout's coloured tile with its first letter (or an icon) */
export function tile(color, text, size = 44) {
  const el = h("span", { class: `tile tile-${color}`, style: { width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.27)}px`, fontSize: `${Math.round(size * 0.42)}px` } });
  if (text) el.textContent = text; else el.appendChild(icon("dumbbell", Math.round(size * 0.55)));
  return el;
}
export const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function segmented(options, index, onChange, extra = "") {
  const el = h("div", { class: `segmented ${extra}`, role: "tablist" });
  options.forEach((text, i) => {
    const b = h("button", { class: i === index ? "on" : "", type: "button", role: "tab", "aria-selected": String(i === index) }, text);
    b.addEventListener("click", () => {
      if (i === index) return;
      index = i;
      [...el.children].forEach((c, k) => { c.classList.toggle("on", k === i); c.setAttribute("aria-selected", String(k === i)); });
      onChange(i);
    });
    el.appendChild(b);
  });
  return el;
}

export function toggle(checked, onChange, label = "") {
  const input = h("input", { type: "checkbox", role: "switch", "aria-label": label });
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: "switch" }, input, h("span", { class: "track" }, h("span", { class: "knob" })));
}

export function actionRow(iconName, text, onClick, { tone = "", detail = "", value = "" } = {}) {
  return h("button", { type: "button", class: `action-row ${tone}`, onclick: onClick },
    iconName ? icon(iconName, 20, "row-icon") : null,
    h("span", { class: "action-text" }, h("span", null, text), detail ? h("span", { class: "action-detail" }, detail) : null),
    value ? h("span", { class: "action-value" }, value) : null,
    icon("chevron", 15, "chev"));
}

export const infoRow = (label, value) => h("div", { class: "info-row" }, h("span", { class: "info-label" }, label), h("span", { class: "info-value" }, value));

export function switchRow(label, checked, onChange, iconName = null) {
  return h("label", { class: "form-row switch-row" },
    h("span", { class: "form-label" }, iconName ? icon(iconName, 18, "inline-icon") : null, label),
    toggle(checked, onChange, label));
}

/** − value + : the iOS stepper, with the value in between */
export function stepper(value, { step = 1, min = 0, max = 9999, format = String, onChange, label = "", className = "" } = {}) {
  let v = value;
  const out = h("span", { class: "stepper-value", "aria-live": "polite" }, format(v));
  const minusBtn = h("button", { type: "button", class: "step-btn", "aria-label": `Less ${label}` }, icon("minus", 18));
  const plusBtn = h("button", { type: "button", class: "step-btn", "aria-label": `More ${label}` }, icon("plus", 18));
  const el = h("div", { class: `stepper ${className}` }, minusBtn, out, plusBtn);
  const set = (nv, fire = true) => {
    v = Math.min(max, Math.max(min, Math.round(nv * 1000) / 1000));
    out.textContent = format(v);
    minusBtn.disabled = v <= min; plusBtn.disabled = v >= max;
    if (fire) onChange?.(v);
  };
  minusBtn.addEventListener("click", () => set(v - (typeof step === "function" ? step(v, -1) : step)));
  plusBtn.addEventListener("click", () => set(v + (typeof step === "function" ? step(v, 1) : step)));
  set(v, false);
  el.set = (nv) => set(nv, false);
  el.value = () => v;
  return el;
}

// ---------------------------------------------------------------------------
// Layers: sheets, action sheets, alerts, toasts
// ---------------------------------------------------------------------------
const layer = () => document.getElementById("layer");
/** Over the workout screen (always dark), sheets and alerts are dark too */
const overDark = () => (document.querySelector(".live:not(.hidden), .summary") ? "dark-scope" : "");
let openSheets = 0;
const lockScroll = (on) => document.documentElement.classList.toggle("locked", on);

/** A full-height iOS sheet that slides up. left/right: {text, onClick, bold, disabled} */
export function sheet({ title, left = null, right = null, body, onClose = null, className = "" }) {
  const backdrop = h("div", { class: "sheet-backdrop" });
  const leftBtn = left ? h("button", { class: "nav-link", type: "button" }, left.text) : h("span", { class: "nav-spacer" });
  const rightBtn = right ? h("button", { class: `nav-link ${right.bold ? "bold" : ""}`, type: "button" }, right.text) : h("span", { class: "nav-spacer" });
  const titleEl = h("div", { class: "sheet-title" }, title);
  const scroller = h("div", { class: "sheet-body" }, body);
  const panel = h("div", { class: `sheet ${className || overDark()}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sheet-grabber" }),
    h("div", { class: "sheet-nav" }, leftBtn, titleEl, rightBtn),
    scroller);
  const wrap = h("div", { class: "sheet-wrap" }, backdrop, panel);
  let closed = false;
  const api = {
    el: panel, body: scroller,
    close(result) {
      if (closed) return;
      closed = true;
      wrap.classList.remove("open");
      openSheets -= 1;
      if (!openSheets) lockScroll(false);
      setTimeout(() => wrap.remove(), 320);
      onClose?.(result);
    },
    setRight({ text, disabled } = {}) {
      if (!right) return;
      if (text !== undefined) rightBtn.textContent = text;
      if (disabled !== undefined) rightBtn.disabled = disabled;
    },
    setTitle(text) { titleEl.textContent = text; },
  };
  leftBtn.addEventListener?.("click", () => (left.onClick ? left.onClick(api) : api.close()));
  if (right) {
    rightBtn.disabled = Boolean(right.disabled);
    rightBtn.addEventListener("click", () => right.onClick(api));
  }
  backdrop.addEventListener("click", () => (left?.onClick ? left.onClick(api) : api.close()));
  layer().appendChild(wrap);
  openSheets += 1;
  lockScroll(true);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
  return api;
}

/**
 * iOS action sheet from the bottom. actions: [{text, value, style: "destructive" | "bold", detail, color, checked}]
 * -> Promise(value, or null when cancelled)
 */
export function actionSheet({ title = "", message = "", actions = [], cancel = "Cancel" }) {
  return new Promise((resolve) => {
    const list = h("div", { class: "as-group" });
    if (title || message) list.appendChild(h("div", { class: "as-head" }, title ? h("div", { class: "as-title" }, title) : null, message ? h("div", { class: "as-message" }, message) : null));
    const wrap = h("div", { class: `as-wrap ${overDark()}` });
    const finish = (v) => {
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 260);
      resolve(v);
    };
    for (const a of actions) {
      list.appendChild(h("button", { type: "button", class: `as-btn ${a.style || ""}`, onclick: () => finish(a.value) },
        a.color ? dot(a.color, 10) : null,
        h("span", { class: "as-text" }, a.text, a.detail ? h("span", { class: "as-detail" }, a.detail) : null),
        a.checked ? icon("check", 18, "as-check") : null));
    }
    const cancelBtn = h("button", { type: "button", class: "as-btn as-cancel", onclick: () => finish(null) }, cancel);
    wrap.append(h("div", { class: "as-backdrop", onclick: () => finish(null) }), h("div", { class: "as-panel", role: "dialog", "aria-label": title || "Choose" }, list, cancelBtn));
    layer().appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
  });
}

/** iOS alert. buttons: [{text, value, style: "cancel" | "destructive" | "bold"}] -> Promise(value).
 *  input: {value, placeholder, mode} adds a text field; the promise then gives [value, text]. */
export function alertBox({ title, message = "", buttons = [{ text: "OK", value: true, style: "bold" }], input = null }) {
  return new Promise((resolve) => {
    const row = h("div", { class: `alert-buttons ${buttons.length > 2 ? "stacked" : ""}` });
    const field = input ? h("input", { class: "alert-input", type: "text", value: input.value || "", placeholder: input.placeholder || "",
      inputmode: input.mode || null, autocomplete: "off", autocapitalize: input.mode ? "off" : "sentences", enterkeyhint: "done" }) : null;
    const wrap = h("div", { class: `alert-wrap ${overDark()}` },
      h("div", { class: "alert", role: "alertdialog", "aria-label": title },
        h("div", { class: "alert-text" }, h("div", { class: "alert-title" }, title),
          message ? h("div", { class: "alert-message" }, message) : null, field),
        row));
    const finish = (value) => {
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 200);
      resolve(input ? [value, field.value.trim()] : value);
    };
    for (const b of buttons) row.appendChild(h("button", { type: "button", class: `alert-btn ${b.style || ""}`, onclick: () => finish(b.value) }, b.text));
    field?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") finish(buttons.find((b) => b.style === "bold")?.value ?? true); });
    layer().appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add("open")));
    field?.focus();
  });
}

/** Ask for one line of text: resolves to the text, or null when cancelled */
export async function askText({ title, message = "", value = "", placeholder = "", ok = "Save", mode = null }) {
  const [go, text] = await alertBox({ title, message, input: { value, placeholder, mode },
    buttons: [{ text: "Cancel", value: false, style: "cancel" }, { text: ok, value: true, style: "bold" }] });
  return go && text ? text : null;
}

let toastTimer = null;
export function toast(text) {
  let el = document.getElementById("toast");
  if (!el) { el = h("div", { id: "toast", role: "status" }); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/** Save a file: the share sheet on phones (Files › OneDrive, Mail...), a download elsewhere. */
export async function saveFile(name, type, content) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Ask for a file (must be called from a tap). */
export function pickFile(accept = "") {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: accept || null, style: { display: "none" } });
    input.addEventListener("change", () => { resolve(input.files[0] || null); input.remove(); });
    document.body.appendChild(input);
    input.click();
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* below */ }
  try {
    const t = h("textarea", { style: { position: "fixed", opacity: "0" } });
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

/** The status bar above the always-dark workout screen and summary: black while they're open */
export function darkStatusBar(on) {
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (m.dataset.orig === undefined) m.dataset.orig = m.content;
    m.content = on ? "#000000" : m.dataset.orig;
  }
}

/** Select the whole number when a field gets the focus, so typing replaces it */
export function selectOnFocus(input) {
  input.addEventListener("focus", () => setTimeout(() => { try { input.setSelectionRange(0, input.value.length); } catch { /* ignore */ } }, 0));
  return input;
}
