// Profiles: the workouts already on a phone become the owner's profile (nothing moves); every other
// profile keeps its things under its own names and has its own file in the cloud.
import { test } from "node:test";
import assert from "node:assert/strict";

class Memory {
  constructor(entries = {}) { this.m = new Map(Object.entries(entries)); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
let n = 0;
const fresh = (entries) => { globalThis.localStorage = new Memory(entries); return import(`../js/profiles.js?case=${n++}`); };
globalThis.location = { reload() { globalThis.reloaded = true; } };

test("a phone with workouts on it: they become the owner's profile, under the same names and file", async () => {
  const P = await fresh({ "gym.data": "{}", "gym.meta": "{}" });
  assert.deepEqual(P.profiles(), [{ id: "main", name: "Konstantinos", color: "blue", file: "gymbro" }]);
  assert.equal(P.key("data"), "gym.data");
  assert.equal(P.fileBase(), "gymbro");
  assert.equal(P.tagKind("data"), "data");
  assert.ok(localStorage.getItem("gym.profiles"));
});

test("a new phone: the first profile has no name yet (the welcome screen asks)", async () => {
  const P = await fresh({});
  assert.equal(P.current().name, "");
  P.renameProfile("main", "  Anna  ");
  assert.equal(P.current().name, "Anna");
});

test("more profiles: their own names, files that can't clash, switching, taking one off the phone", async () => {
  const P = await fresh({ "gym.data": "{}" });
  const anna = P.addProfile("Anna Maria");
  assert.equal(anna.file, "gymbro-annamaria");
  assert.equal(anna.color, "pink");
  assert.equal(P.addProfile("anna maria").file, "gymbro-annamaria2");
  assert.equal(P.addProfile("Backup").file, "gymbro-pbackup");          // never looks like the owner's backups
  assert.equal(P.addProfile("Ångström").file, "gymbro-angstrom");
  assert.equal(P.addProfile("!!").file, "gymbro-profile");
  assert.equal(P.key("data", anna.id), `gym.${anna.id}.data`);
  P.switchTo(anna.id);
  assert.equal(globalThis.reloaded, true);
  // the app starts again as Anna
  const Q = await import(`../js/profiles.js?case=${n++}`);
  assert.equal(Q.current().name, "Anna Maria");
  assert.equal(Q.key("active"), `gym.${anna.id}.active`);
  assert.equal(Q.fileBase(), "gymbro-annamaria");
  assert.equal(Q.tagKind("backup"), "backup:annamaria");
  assert.equal(Q.deleteProfile(anna.id), false);                         // not the one in use
  // back to the owner, then Anna off the phone: only her things go
  localStorage.setItem(`gym.${anna.id}.data`, "{}");
  localStorage.setItem(`gym.${anna.id}.googleToken`, "{}");
  Q.switchTo("main");
  const R = await import(`../js/profiles.js?case=${n++}`);
  assert.equal(R.deleteProfile(anna.id), true);
  assert.equal(localStorage.getItem(`gym.${anna.id}.data`), null);
  assert.equal(localStorage.getItem(`gym.${anna.id}.googleToken`), null);
  assert.equal(localStorage.getItem("gym.data"), "{}");
  assert.equal(R.profiles().some((p) => p.id === anna.id), false);
});
