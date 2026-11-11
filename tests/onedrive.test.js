// The OneDrive connection (js/cloud/onedrive.js) against a pretend Microsoft: tokens, refreshing, the files.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = { href: "https://konstantinospolyzos.github.io/gymbro/index.html#today", origin: "https://konstantinospolyzos.github.io" };
const { OneDrive, redirectUri, makePkce, idClaims, explain } = await import("../js/cloud/onedrive.js");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ID_TOKEN = `${b64({ alg: "none" })}.${b64({ name: "Konstantinos Polyzos", preferred_username: "k@outlook.com" })}.sig`;

/** A pretend Microsoft login + Graph */
function microsoft() {
  const calls = [];
  const files = new Map();     // name -> {id, eTag, text}
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url);
    const auth = opts.headers?.Authorization || "";
    calls.push({ url, method: opts.method || "GET", auth, body: opts.body });
    if (url.endsWith("/oauth2/v2.0/token")) {
      const p = new URLSearchParams(String(opts.body));
      if (p.get("grant_type") === "authorization_code" && p.get("code") === "good" && p.get("code_verifier"))
        return json(200, { access_token: "A1", expires_in: 3600, refresh_token: "R1", id_token: ID_TOKEN });
      if (p.get("grant_type") === "refresh_token" && p.get("refresh_token") === "R1")
        return json(200, { access_token: "A2", expires_in: 3600, refresh_token: "R2" });
      return json(400, { error: "invalid_grant", error_description: "AADSTS70008: The provided authorization code or refresh token has expired." });
    }
    if (url.startsWith("https://download.example/")) {
      const f = [...files.values()].find((x) => url.endsWith(x.id));
      return new Response(f.text, { status: 200 });
    }
    if (!auth.startsWith("Bearer A")) return json(401, { error: { message: "no" } });
    if (auth === "Bearer A1" && calls.filter((c) => c.auth === "Bearer A1").length > 3) return json(401, { error: { message: "expired" } });
    const path = url.replace("https://graph.microsoft.com/v1.0", "");
    if (path.startsWith("/me/drive/special/approot?")) return json(200, { id: "root", name: "GymBro", webUrl: "https://onedrive.live.com/x" });
    let m = path.match(/^\/me\/drive\/special\/approot:\/([^:?]+):\/content$/);
    if (m && opts.method === "PUT") {
      const name = decodeURIComponent(m[1]);
      const f = files.get(name) || { id: `id${++n}`, name };
      f.text = opts.body; f.eTag = `e${++n}`;
      files.set(name, f);
      return json(201, { id: f.id, name, eTag: f.eTag, webUrl: `https://onedrive.live.com/${f.id}` });
    }
    m = path.match(/^\/me\/drive\/special\/approot:\/([^:?]+)(\?.*)?$/);
    if (m) {
      const f = files.get(decodeURIComponent(m[1]));
      if (!f) return json(404, { error: { message: "not found" } });
      if (opts.method === "DELETE") { files.delete(f.name); return new Response(null, { status: 204 }); }
      if (m[2]?.includes("downloadUrl")) return json(200, { id: f.id, "@microsoft.graph.downloadUrl": `https://download.example/${f.id}` });
      return json(200, { id: f.id, name: f.name, eTag: f.eTag });
    }
    if (path.startsWith("/me/drive/special/approot/children"))
      return json(200, { value: [...files.values()].map((f) => ({ id: f.id, name: f.name, createdDateTime: `2026-11-0${f.id.slice(2)}T10:00:00Z` })) });
    return json(400, { error: { message: `unexpected ${path}` } });
  };
  return { calls, files };
}

test("the sign-in address is auth.html next to the app", () => {
  assert.equal(redirectUri(), "https://konstantinospolyzos.github.io/gymbro/auth.html");
  assert.equal(redirectUri("https://konstantinospolyzos.github.io/gymbro/?code=1"), "https://konstantinospolyzos.github.io/gymbro/auth.html");
});

test("PKCE codes and the Microsoft address", async () => {
  const p = await makePkce();
  assert.match(p.verifier, /^[A-Za-z0-9_-]{64}$/);
  assert.match(p.challenge, /^[A-Za-z0-9_-]{43}$/);
  const od = new OneDrive("client-123");
  const url = new URL(od.authorizeUrl(p, { select: true }));
  assert.equal(url.origin + url.pathname, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), "https://konstantinospolyzos.github.io/gymbro/auth.html");
  assert.match(url.searchParams.get("scope"), /Files\.ReadWrite\.AppFolder/);
  assert.match(url.searchParams.get("scope"), /offline_access/);
  assert.equal(url.searchParams.get("prompt"), "select_account");
});

test("a code becomes tokens; an hour later they refresh without a tap; 24 hours later a tap is needed", async () => {
  const ms = microsoft();
  const od = new OneDrive("client-123");
  assert.equal(od.needsTap(), true);
  await od._redeem("good", "verifier");
  assert.equal(od.tokenValid(), true);
  assert.deepEqual(await od.about(), { email: "k@outlook.com", name: "Konstantinos Polyzos" });
  const body = new URLSearchParams(ms.calls[0].body);
  assert.equal(body.get("code_verifier"), "verifier");
  assert.equal(body.get("client_id"), "client-123");
  od.expiry = Date.now() - 1;           // the hour is up
  assert.equal(od.needsTap(), false);
  await od.ensureToken();
  assert.equal(od.access, "A2");
  od.expiry = Date.now() - 1;
  od.refreshExpiry = Date.now() - 1;    // the 24 hours are up
  assert.equal(od.needsTap(), true);
  await assert.rejects(od.ensureToken(), /Sign in again/);
  await assert.rejects(od._redeem("bad", "v"), /expired/);
});

test("the data file: create, find, download, upload, backups", async () => {
  const ms = microsoft();
  const od = new OneDrive("client-123");
  await od._redeem("good", "v");
  assert.equal(await od.find(), null);
  const made = await od.create({ sessions: [1] });
  assert.ok(made.id && made.version);
  const found = await od.find();
  assert.equal(found.id, made.id);
  assert.deepEqual(await od.download(found.id), { sessions: [1] });
  const up = await od.upload(found.id, { sessions: [1, 2] });
  assert.notEqual(up.version, made.version);
  assert.deepEqual(await od.download(found.id), { sessions: [1, 2] });
  assert.deepEqual(await od.getMeta(found.id), { id: "gymbro.json", version: up.version, link: null });
  await od.create({ b: 1 }, { name: "gymbro-backup-2026-11-11.json" });
  const backups = await od.backups();
  assert.equal(backups.length, 1);
  await od.remove(backups[0].id);
  assert.equal((await od.backups()).length, 0);
  // every Graph call carried the token; none went to /content with a redirect
  assert.ok(ms.calls.filter((c) => c.url.startsWith("https://graph.microsoft.com")).every((c) => c.auth.startsWith("Bearer ")));
});

test("an expired token mid-way is refreshed and the call repeated", async () => {
  microsoft();
  const od = new OneDrive("client-123");
  await od._redeem("good", "v");
  for (let i = 0; i < 3; i++) await od.find().catch(() => {});
  const res = await od.find();      // A1 is refused now: refresh to A2, then it works
  assert.equal(res, null);
  assert.equal(od.access, "A2");
});

test("Microsoft's errors in words", () => {
  assert.match(explain("access_denied"), /cancelled/);
  assert.match(explain("invalid_request", "AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type."), /Single-page application/);
  assert.match(explain("unauthorized_client", "AADSTS700016: Application with identifier 'x' was not found"), /Application \(client\) ID/);
  assert.deepEqual(idClaims(ID_TOKEN), { name: "Konstantinos Polyzos", email: "k@outlook.com" });
});
