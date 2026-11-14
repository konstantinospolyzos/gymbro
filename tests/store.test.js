// Syncing (js/store.js) with a stand-in for OneDrive / Google Drive.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { store } from "../js/store.js";
import { applyOp, emptyData, sampleOp } from "../js/data.js";

Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });

const base = applyOp(emptyData(), sampleOp(emptyData()));
const T = (iso) => new Date(`${iso}T18:00:00`).getTime();
const session = (id, iso) => ({ id, date: iso, start: T(iso), dur: 3600, workout: "w-back", name: "Back", color: "blue",
  exercises: [{ ex: "ex-barbell-row", name: "Barbell row", kind: "weight", muscle: "Back", sets: [{ w: 60, r: 8 }] }] });

/** A pretend cloud holding one data file */
function fakeCloud(file) {
  const c = {
    kind: "onedrive", label: "OneDrive", configured: true, file, uploads: [], created: [], removed: [], backupsList: [],
    needsTap: () => false, tokenValid: () => true, async ensureToken() {}, setHint() {}, signOut() {}, warmUp() {},
    async about() { return { email: "k@example.com", name: "Konstantinos" }; },
    async getMeta(id) { return c.file && id === c.file.id ? { id, version: c.file.version } : null; },
    async find() { return c.file ? { id: c.file.id, version: c.file.version } : null; },
    async download() { return structuredClone(c.file.data); },
    async upload(id, data) {
      c.uploads.push(data);
      c.file = { id, version: String(Number(c.file.version) + 1), data: structuredClone(data) };
      return { id, version: c.file.version };
    },
    async create(data, opts = {}) {
      c.created.push({ data, ...opts });
      if (opts.kind === "backup") { c.backupsList.unshift({ id: `b${c.created.length}`, createdTime: new Date().toISOString() }); return {}; }
      c.file = { id: "f-new", version: "1", data: structuredClone(data) };
      return { id: "f-new", version: "1" };
    },
    async backups() { return [...c.backupsList]; },
    async remove(id) { c.removed.push(id); },
  };
  return c;
}

beforeEach(() => {
  store.meta = { mode: "onedrive", fileId: "f1", version: "1", link: null, pending: [], lastSync: null, email: "k@example.com", lastBackup: Date.now() };
  store._syncing = false;
  store._again = false;
  store.persist = () => {};
  store.syncSoon = () => {};
});

test("the computer changed the file: both changes end up in the cloud", async () => {
  // the computer logged last Monday's workout
  const theirs = applyOp(base, { type: "putSession", session: session("s-computer", "2026-11-02") });
  const cloud = fakeCloud({ id: "f1", version: "2", data: theirs });
  store.clouds.onedrive = cloud;
  // this phone, still on version 1, logged today's workout and changed the rest time
  const mine = [{ type: "putSession", session: session("s-phone", "2026-11-09") },
    { type: "putWorkout", workout: { ...base.workouts[0], rest: 120 } }];
  store.base = base;
  store.data = mine.reduce(applyOp, base);
  store.meta.pending = [...mine];
  await store.sync();
  assert.equal(cloud.uploads.length, 1);
  const saved = cloud.uploads[0];
  assert.deepEqual(saved.sessions.map((s) => s.id), ["s-computer", "s-phone"]);
  assert.equal(saved.workouts[0].rest, 120);
  assert.deepEqual(store.meta.pending, []);
  assert.equal(store.meta.version, "3");
  assert.deepEqual(store.data, saved);
});

test("nothing new here: the cloud's copy is taken, nothing uploaded", async () => {
  const theirs = applyOp(base, { type: "putSession", session: session("s1", "2026-11-02") });
  const cloud = fakeCloud({ id: "f1", version: "2", data: theirs });
  store.clouds.onedrive = cloud;
  store.base = base;
  store.data = base;
  await store.sync();
  assert.equal(cloud.uploads.length, 0);
  assert.equal(store.data.sessions.length, 1);
});

test("no file yet: this phone's workouts become the file", async () => {
  const cloud = fakeCloud(null);
  store.clouds.onedrive = cloud;
  store.meta.fileId = null;
  store.data = applyOp(base, { type: "putSession", session: session("s1", "2026-11-02") });
  await store.sync();
  assert.equal(cloud.created.length, 1);
  assert.equal(cloud.created[0].data.sessions.length, 1);
  assert.equal(store.meta.fileId, "f-new");
});

test("first sync of a phone with workouts and a cloud file with workouts: you choose", async () => {
  const theirs = applyOp(base, { type: "putSession", session: session("s-cloud", "2026-11-02") });
  const cloud = fakeCloud({ id: "f1", version: "5", data: theirs });
  store.clouds.onedrive = cloud;
  store.meta = { ...store.meta, fileId: null, version: null, adopting: true };
  store.data = applyOp(base, { type: "putSession", session: session("s-phone", "2026-11-09") });
  let asked = 0;
  store.chooser = async () => { asked += 1; return "cloud"; };
  await store.sync();
  assert.equal(asked, 1);
  assert.deepEqual(store.data.sessions.map((s) => s.id), ["s-cloud"]);
  assert.equal(cloud.uploads.length, 0);
  assert.equal(store.meta.adopting, false);
});

test("once a week a backup copy, keeping eight", async () => {
  const cloud = fakeCloud({ id: "f1", version: "1", data: applyOp(base, { type: "putSession", session: session("s1", "2026-11-02") }) });
  cloud.backupsList = Array.from({ length: 9 }, (_, i) => ({ id: `old${i}`, createdTime: new Date(Date.now() - (8 + i) * 86400000).toISOString() }));
  store.clouds.onedrive = cloud;
  store.meta.lastBackup = 0;
  store.base = cloud.file.data;
  store.data = cloud.file.data;
  await store.sync();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(cloud.created.filter((c) => c.kind === "backup").length, 1);
  assert.deepEqual(cloud.removed, ["old7", "old8"]);
});

// ---------------------------------------------------------------------------
// Version 1.10: a dropped connection ("Load failed" on the iPhone) waits and tries again by itself
// ---------------------------------------------------------------------------
import { NetworkError, netFetch } from "../js/cloud/common.js";

test("a dropped connection: the change waits on the phone, it says which step, and tries again later", async () => {
  const cloud = fakeCloud({ id: "f1", version: "1", data: base });
  store.clouds.onedrive = cloud;
  store.data = structuredClone(base);
  store.base = structuredClone(base);
  let retryIn = null;
  store.syncSoon = (ms) => { retryIn = ms; };
  const realUpload = cloud.upload;
  cloud.upload = async () => { throw new NetworkError("Load failed"); };
  store.meta.pending.push({ type: "putSession", session: session("s-new", "2026-11-13") });
  await store.sync();
  assert.equal(store.status.state, "retry");
  assert.match(store.status.text, /Couldn't reach OneDrive · trying again/);
  assert.equal(store.meta.problem.step, "saving the file");
  assert.equal(store.meta.problem.text, "Load failed");
  assert.equal(store.meta.pending.length, 1, "the change is kept");
  assert.ok(retryIn >= 15000 && retryIn <= 300000, `tries again in ${retryIn} ms`);
  // the second failure waits longer
  await store.sync();
  assert.ok(store._retryIn > 15000);
  // the connection is back
  cloud.upload = realUpload;
  await store.sync();
  assert.equal(store.status.state, "synced");
  assert.equal(store.meta.pending.length, 0);
  assert.equal(store.meta.problem, null);
  assert.equal(store._retryIn, 0);
  assert.ok(cloud.file.data.sessions.some((s) => s.id === "s-new"));
});

test("back in the app: it syncs when a change waits, after trouble, or after a minute", async () => {
  const cloud = fakeCloud({ id: "f1", version: "1", data: base });
  store.clouds.onedrive = cloud;
  let synced = 0;
  const real = store.sync;
  store.sync = async () => { synced += 1; };
  store.meta.lastSync = Date.now();
  store.status = { state: "synced", text: "" };
  store.syncIfStale();
  assert.equal(synced, 0, "just synced, nothing waiting");
  store.meta.pending.push({ type: "setSetting", key: "goal", value: 4 });
  store.syncIfStale();
  assert.equal(synced, 1, "a change waits");
  store.meta.pending = [];
  store.status = { state: "retry", text: "" };
  store.syncIfStale();
  assert.equal(synced, 2, "after trouble");
  store.status = { state: "synced", text: "" };
  store.meta.lastSync = Date.now() - 120000;
  store.syncIfStale();
  assert.equal(synced, 3, "after a while");
  store.sync = real;
});

test("the cloud's requests: never from the browser's cache, a dropped GET tried again, a POST not", async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  let fails = 2;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (fails-- > 0) throw new TypeError("Load failed");
    return new Response("{}", { status: 200 });
  };
  try {
    const r = await netFetch("https://www.googleapis.com/drive/v3/files/x", { headers: { Authorization: "Bearer t" } }, { pause: 1 });
    assert.equal(r.status, 200);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c.init.cache === "no-store" && c.init.headers.Authorization === "Bearer t"));
    calls.length = 0; fails = 1;
    await assert.rejects(netFetch("https://x/token", { method: "POST" }, { pause: 1 }), (e) => e instanceof NetworkError && e.message === "Load failed");
    assert.equal(calls.length, 1, "a POST isn't repeated (it may have arrived)");
    calls.length = 0; fails = 5;
    await assert.rejects(netFetch("https://x/f", { method: "PATCH" }, { pause: 1 }), NetworkError);
    assert.equal(calls.length, 3, "three tries, then it gives up for now");
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    globalThis.fetch = async () => { throw abort; };
    await assert.rejects(netFetch("https://x/f", {}, { pause: 1 }), (e) => e === abort);
  } finally { globalThis.fetch = realFetch; }
});
