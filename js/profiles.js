// Profiles: GymBro for more than one person on a phone. Each profile has its own plan, workouts, body weight
// and settings, and its own place in OneDrive or Google Drive (with its own sign-in, so it can be another
// person's account). The first profile keeps the app's original storage and file (gymbro.json), so nothing
// moves when profiles arrive; the others get their own (gymbro-anna.json). Switching reloads the app.

import { CONFIG } from "./config.js";

const KEY_LIST = "gym.profiles";
const KEY_CURRENT = "gym.profile";
export const MAIN = "main";
const COLORS = ["blue", "pink", "green", "orange", "purple", "teal", "red", "indigo"];
/** What a profile keeps on the phone (the first profile's names are the original ones, without an id) */
const PROFILE_KEYS = ["data", "meta", "prefs", "cloudCopy", "active", "onedrive", "googleToken"];

const get = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } };
const has = (k) => { try { return localStorage.getItem(k) !== null; } catch { return false; } };

function load() {
  const list = get(KEY_LIST, null);
  if (Array.isArray(list) && list.length) return list;
  // the first start with profiles: what's here already is the owner's
  const first = [{ id: MAIN, name: has("gym.data") || has("gym.meta") ? CONFIG.ownerName || "Me" : "", color: "blue", file: "gymbro" }];
  put(KEY_LIST, first);
  return first;
}

let list = load();
let currentId = get(KEY_CURRENT, null);
if (!list.some((p) => p.id === currentId)) currentId = list[0].id;

export const profiles = () => list.map((p) => ({ ...p }));
export const current = () => ({ ...list.find((p) => p.id === currentId) });

/** The name something is kept under for a profile: "gym.data" for the first, "gym.p1a2b.data" for the others */
export const key = (name, id = currentId) => (id === MAIN ? `gym.${name}` : `gym.${id}.${name}`);

/** The profile's file in the cloud without ".json": "gymbro", "gymbro-anna" */
export const fileBase = () => current().file || "gymbro";

/** Google Drive tells the files apart by a tag: "data" and "backup", or "data:anna" and "backup:anna" */
export const tagKind = (kind) => (fileBase() === "gymbro" ? kind : `${kind}:${fileBase().slice("gymbro-".length)}`);

/** Where a profile's workouts are kept, for the list of profiles */
export const metaOf = (id) => get(key("meta", id), null);
export const hasActive = (id) => Boolean(get(key("active", id), null));

const cleanName = (name) => String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 30);

// a file name from the name: letters and digits only (never one that looks like the first profile's backups)
const slugOf = (name) => {
  const s = cleanName(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 20) || "profile";
  return s.startsWith("backup") ? `p${s}` : s;
};

/** A new profile; the same name on another phone gets the same file, so its workouts are shared there */
export function addProfile(name) {
  const base = `gymbro-${slugOf(name)}`;
  let file = base;
  for (let n = 2; list.some((p) => p.file === file); n++) file = `${base}${n}`;
  const p = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: cleanName(name) || "Profile",
    color: COLORS.find((c) => !list.some((x) => x.color === c)) || COLORS[list.length % COLORS.length], file };
  list = [...list, p];
  put(KEY_LIST, list);
  return { ...p };
}

export function renameProfile(id, name) {
  const n = cleanName(name);
  if (!n) return;
  list = list.map((p) => (p.id === id ? { ...p, name: n } : p));
  put(KEY_LIST, list);
}

/** Take a profile off this phone: its workouts here and its sign-in. Its file in the cloud stays. */
export function deleteProfile(id) {
  if (id === currentId || !list.some((p) => p.id === id)) return false;
  for (const k of PROFILE_KEYS) drop(key(k, id));
  if (id !== MAIN) {
    try {
      const all = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
      for (const k of all) if (k?.startsWith(`gym.${id}.`)) drop(k);
    } catch { /* blocked */ }
  }
  list = list.filter((p) => p.id !== id);
  put(KEY_LIST, list);
  return true;
}

/** Open the app as another profile */
export function switchTo(id) {
  put(KEY_CURRENT, id);
  location.reload();
}
