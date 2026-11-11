// Where the workouts live: one JSON file in your own OneDrive or Google Drive (or on the phone only),
// with a copy on the phone so the app works at the gym without a connection. Every change is an
// "operation": applied here at once and queued; when the app syncs it downloads the newest cloud file
// (if another device changed it), replays the queued changes on top and uploads the result, so the
// phone and the computer never overwrite each other's workouts. (The same way as the Savings Tracker.)
//
// The workout in progress stays on the phone until you finish it; then it becomes one change.

import { CONFIG } from "./config.js";
import { emptyData, normalize, applyOp, describeData, hasContent } from "./data.js";
import { OneDrive } from "./cloud/onedrive.js";
import { GoogleDrive } from "./cloud/google.js";
import { AuthError, lsGet, lsSet, lsDel, backupName } from "./cloud/common.js";

const KEY_DATA = "gym.data";
const KEY_META = "gym.meta";
const KEY_PREFS = "gym.prefs";
const KEY_BASE = "gym.cloudCopy";        // the file as it was last seen in the cloud
const KEY_ACTIVE = "gym.active";         // the workout in progress
const BACKUP_EVERY = 7 * 86400000;       // a copy of the data file in the cloud once a week...
const BACKUPS_KEPT = 8;                  // ...keeping the last 8 (about two months)
export const CLOUDS = ["onedrive", "gdrive"];

class Store {
  constructor() {
    this.prefs = lsGet(KEY_PREFS, {}) || {};
    this.clouds = {
      onedrive: new OneDrive(CONFIG.oneDriveClientId || this.prefs.odClientId || ""),
      gdrive: new GoogleDrive(CONFIG.googleClientId),
    };
    this.data = null;
    this.base = null;             // last version seen in the cloud; queued changes are replayed on it
    this.meta = { mode: null, fileId: null, version: null, link: null, pending: [], lastSync: null, email: null, name: null };
    this.status = { state: "idle", text: "" };
    this.listeners = new Set();
    this.active = null;
    this._syncing = false;
    this._again = false;
    this._timer = null;
    this.chooser = null;          // the app sets this: asks which data to keep when both have workouts
  }

  load() {
    const m = lsGet(KEY_META);
    if (m) Object.assign(this.meta, m);
    const d = lsGet(KEY_DATA);
    try { this.data = d ? normalize(d) : null; } catch { this.data = null; }
    try { const b = lsGet(KEY_BASE); this.base = b ? normalize(b) : null; } catch { this.base = null; }
    if (CLOUDS.includes(this.meta.mode) && !this.cloud.configured) this.meta.mode = this.data ? "local" : null;
    this.active = lsGet(KEY_ACTIVE) || null;
    for (const c of Object.values(this.clouds)) if (c.configured && (c === this.cloud || !this.meta.mode)) c.warmUp();
    this._status();
    window.addEventListener("online", () => this.syncSoon(0));
    const back = () => { this.resumePending(); this.syncSoon(0); };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) back(); });
    window.addEventListener("focus", () => this.resumePending());
    this.resumePending();
  }

  get ready() { return Boolean(this.meta.mode && this.data); }
  get mode() { return this.meta.mode; }
  get cloud() { return this.clouds[this.meta.mode] || null; }
  /** True when only a tap can sign in again (the app then asks for one) */
  get needsTap() { return Boolean(this.cloud && this.cloud.needsTap()); }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  /** kind: "data" (redraw the page) or "status" (only the sync indicator changed) */
  emit(kind = "data") { for (const fn of this.listeners) fn(kind); }
  persist() {
    if (this.data) lsSet(KEY_DATA, this.data);
    lsSet(KEY_META, this.meta);
    if (this.base) lsSet(KEY_BASE, this.base); else lsDel(KEY_BASE);
  }

  pref(key, fallback) { return this.prefs[key] ?? fallback; }
  setPref(key, value) { this.prefs[key] = value; lsSet(KEY_PREFS, this.prefs); }

  /** The OneDrive app ID pasted in Settings (config.js wins when it has one) */
  setOneDriveId(id) {
    this.setPref("odClientId", id || "");
    this.clouds.onedrive = new OneDrive(CONFIG.oneDriveClientId || id || "");
    this.clouds.onedrive.warmUp();
  }
  get oneDriveInConfig() { return Boolean(CONFIG.oneDriveClientId); }

  // -- the workout in progress -------------------------------------------------
  saveActive(a) {
    this.active = a || null;
    if (a) lsSet(KEY_ACTIVE, a); else lsDel(KEY_ACTIVE);
  }

  // -- choosing where the data lives -------------------------------------------
  startLocal() {
    this.meta.mode = "local";
    this.data = this.data || emptyData();
    this.persist();
    this._status();
    this.emit();
  }

  /** Call straight from a tap. Signs in, then finds or creates the cloud file. */
  connect(kind) {
    const cloud = this.clouds[kind];
    if (!cloud?.configured) return Promise.reject(new Error(`${cloud?.label || "The cloud"} isn't set up yet.`));
    this.meta.connecting = kind;
    lsSet(KEY_META, this.meta);
    return cloud.requestToken({ select: true }).then(() => this._connected(kind));
  }

  async _connected(kind) {
    if (this.meta.mode !== kind) {
      if (CLOUDS.includes(this.meta.mode) && this.meta.mode !== kind) this.cloud?.signOut();
      this.meta = { ...this.meta, mode: kind, fileId: null, version: null, link: null, email: null, name: null,
        pending: [], adopting: true, lastBackup: null };
      this.base = null;
    }
    this.meta.connecting = null;
    this.persist();
    await this.sync();
    if (this.status.state === "error") throw new Error(this.status.text);
  }

  /** A OneDrive sign-in that came back while nobody was waiting (a full-page sign-in, or a window that finished late) */
  async resumePending() {
    const od = this.clouds.onedrive;
    if (this._resuming || od.waiting || !od.configured || !od.hasPendingResult()) return;
    if (this.meta.connecting !== "onedrive" && this.meta.mode !== "onedrive") return;
    this._resuming = true;
    try {
      await od.finishPending();
      await this._connected("onedrive");
    } catch (err) {
      this._status("error", err.message);
    } finally {
      this._resuming = false;
      this.emit();
    }
  }

  disconnect() {
    this.cloud?.signOut();
    this.meta = { ...this.meta, mode: "local", fileId: null, version: null, link: null, pending: [], email: null, name: null,
      adopting: false, lastBackup: null, connecting: null };
    this.base = null;
    this.data = this.data || emptyData();
    this.persist();
    this._status();
    this.emit();
  }

  // -- changes -----------------------------------------------------------------
  commit(op) {
    this.data = applyOp(this.data, op);
    if (this.cloud) this.meta.pending.push(op);
    this.persist();
    this._status();
    this.emit();
    this.syncSoon();
  }

  saveExercise(exercise) { this.commit({ type: "putExercise", exercise }); }
  archiveExercise(id, archived = true) { this.commit({ type: "archiveExercise", id, archived }); }
  setExerciseNotes(id, notes) { this.commit({ type: "setExerciseNotes", id, notes }); }
  /** A weigh-in for a day; kg null deletes it */
  putBody(date, kg) { this.commit({ type: "putBody", date, kg }); }
  saveWorkout(workout) { this.commit({ type: "putWorkout", workout }); }
  deleteWorkout(id) { this.commit({ type: "deleteWorkout", id }); }
  moveWorkout(id, by) { this.commit({ type: "moveWorkout", id, by }); }
  setDay(day, workout) { this.commit({ type: "setDay", day, workout: workout || null }); }
  addPlan(op) { this.commit(op); }
  saveSession(session) { this.commit({ type: "putSession", session }); }
  deleteSession(id) { this.commit({ type: "deleteSession", id }); }
  setSetting(key, value) { this.commit({ type: "setSetting", key, value }); }
  replaceAll(data) { this.commit({ type: "replaceAll", data: normalize(data) }); }

  // -- syncing -----------------------------------------------------------------
  syncSoon(ms = 1200) {
    if (!this.cloud) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.sync(), ms);
  }

  /** A tap on the cloud button: sign in again if needed, then sync. */
  syncFromTap() {
    const cloud = this.cloud;
    if (!cloud) return Promise.resolve();
    if (!cloud.needsTap()) return this.sync();
    return cloud.requestToken().then(() => this.sync()).catch((err) => {
      this._status("error", err.message);
      this.emit("status");
    });
  }

  async sync() {
    const cloud = this.cloud;
    if (!cloud) return;
    if (this._syncing) { this._again = true; return; }
    if (!navigator.onLine) { this._status(); this.emit("status"); return; }
    try { await cloud.ensureToken(); } catch (err) {
      if (err instanceof AuthError) this._status(); else this._status("error", err.message);
      this.emit("status");
      return;
    }
    this._syncing = true;
    this._status("syncing");
    this.emit("status");
    const sending = this.meta.pending.length;
    const before = JSON.stringify(this.data);
    try {
      if (!this.meta.email) {
        const me = await cloud.about();
        this.meta.email = me?.email || null;
        this.meta.name = me?.name || null;
        if (this.meta.email) cloud.setHint(this.meta.email);
      }
      let remote = this.meta.fileId ? await cloud.getMeta(this.meta.fileId) : null;
      if (!remote) remote = await cloud.find();
      let result;
      if (!remote) {
        // No file in the cloud yet: this device's data becomes the cloud file
        const start = this.data || emptyData();
        const stamped = { ...start, updated: new Date().toISOString() };
        result = { data: stamped, meta: await cloud.create(stamped) };
        this.meta.pending = this.meta.pending.slice(sending);
      } else if (this.meta.adopting) {
        const theirs = normalize(await cloud.download(remote.id));
        const mine = this.data;
        let keep = "cloud";
        if (hasContent(mine) && hasContent(theirs) && this.chooser) keep = await this.chooser(mine, theirs, cloud.label);
        else if (hasContent(mine) && !hasContent(theirs)) keep = "device";
        if (keep === "device") {
          const stamped = { ...mine, updated: new Date().toISOString() };
          result = { data: stamped, meta: await cloud.upload(remote.id, stamped) };
        } else {
          result = { data: theirs, meta: remote };
        }
        this.meta.pending = [];
      } else {
        const changedElsewhere = remote.id !== this.meta.fileId || String(remote.version) !== String(this.meta.version);
        const base = !changedElsewhere && this.base ? this.base : normalize(await cloud.download(remote.id));
        const ops = this.meta.pending.slice(0, sending);
        let merged = ops.reduce(applyOp, base);
        if (ops.length) {
          merged = { ...merged, updated: new Date().toISOString() };
          result = { data: merged, meta: await cloud.upload(remote.id, merged) };
        } else {
          result = { data: merged, meta: remote };
        }
        this.meta.pending = this.meta.pending.slice(sending);
      }
      // changes made while we were talking to the cloud stay queued and are applied on top
      const later = this.meta.pending;
      this.meta.adopting = false;
      this.base = result.data;
      this.data = later.reduce(applyOp, result.data);
      this.meta.fileId = result.meta.id;
      this.meta.version = result.meta.version;
      this.meta.link = result.meta.link || this.meta.link;
      this.meta.lastSync = Date.now();
      this.persist();
      this._status();
      if (later.length) this._again = true;
      this._backupIfDue(result.data);
    } catch (err) {
      if (err instanceof AuthError) this._status();
      else this._status("error", err.message || `Couldn't reach ${cloud.label}.`);
    } finally {
      this._syncing = false;
      this.emit(JSON.stringify(this.data) === before ? "status" : "data");
      if (this._again) { this._again = false; this.syncSoon(300); }
    }
  }

  /** Once a week, keep a copy of the cloud file next to it. Best effort: never blocks or breaks a sync. */
  async _backupIfDue(data) {
    const cloud = this.cloud;
    if (!cloud || this._backingUp || !data?.sessions?.length || Date.now() - (this.meta.lastBackup || 0) < BACKUP_EVERY) return;
    this._backingUp = true;
    try {
      // the computer may already have made this week's copy: one copy a week in total
      const existing = await cloud.backups();
      const newest = existing.length ? Date.parse(existing[0].createdTime) : 0;
      if (Date.now() - newest < BACKUP_EVERY) {
        this.meta.lastBackup = newest;
        lsSet(KEY_META, this.meta);
        return;
      }
      await cloud.create({ ...data, exported: new Date().toISOString() }, { name: backupName(), kind: "backup" });
      this.meta.lastBackup = Date.now();
      lsSet(KEY_META, this.meta);
      for (const f of existing.slice(BACKUPS_KEPT - 1)) await cloud.remove(f.id);   // the new one + 7 newest
    } catch { /* try again on the next sync */ }
    finally { this._backingUp = false; }
  }

  noteManualBackup() {
    this.meta.lastManualBackup = Date.now();
    lsSet(KEY_META, this.meta);
  }

  _status(state = null, text = "") {
    const m = this.meta, cloud = this.cloud;
    if (state) { this.status = { state, text }; return; }
    if (m.mode === "local") this.status = { state: "local", text: "Saved on this phone only" };
    else if (!cloud) this.status = { state: "idle", text: "" };
    else if (!navigator.onLine) this.status = { state: "offline", text: m.pending.length ? `Offline · saved to ${cloud.label} later` : "Offline" };
    else if (cloud.needsTap()) this.status = { state: "signin", text: m.pending.length
      ? `${m.pending.length} change${m.pending.length !== 1 ? "s" : ""} not in ${cloud.label} yet · tap to save`
      : `Tap to sync with ${cloud.label}` };
    else if (m.pending.length) this.status = { state: "pending", text: `Saving to ${cloud.label}…` };
    else this.status = { state: "synced", text: m.lastSync ? `Saved to ${cloud.label} · ${new Date(m.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : cloud.label };
  }
}

export const store = new Store();
export { describeData };

export async function readBackupFile(file) {
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error("This file isn't a GymBro backup."); }
  return normalize(raw);
}
