// The offline helper (sw.js): it must save every file of the app, and a new app version must be a new set of files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../js/core.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const sw = readFileSync(join(root, "sw.js"), "utf8");
const files = JSON.parse(`[${sw.match(/const FILES = \[([\s\S]*?)\];/)[1].trim().replace(/,\s*$/, "")}]`);

test("the offline copy has every file of the app, and only files that exist", () => {
  const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
  for (const f of [...walk("js"), ...walk("css"), "index.html", "auth.html", "manifest.webmanifest"]) assert.ok(files.includes(f), `${f} is missing from FILES in sw.js`);
  for (const f of files) if (f !== "./") assert.ok(existsSync(join(root, f)), `${f} is in sw.js but doesn't exist`);
});

test("the offline helper's version is the app's version", () => {
  assert.equal(sw.match(/const VERSION = "([^"]+)"/)[1], APP_VERSION);
});
