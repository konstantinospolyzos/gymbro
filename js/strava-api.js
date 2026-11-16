// Strava, connected. You make your own Strava API app once (strava.com/settings/api: Strava asks for a
// subscription for that), and its Client ID and Secret stay on this phone, like the Claude key. Connecting
// opens Strava in a window: you sign in and allow uploads, Strava sends you back to strava.html with a
// one-time code, and the app swaps it for its keys (kept on this phone; each profile connects its own).
//
// Workouts go up one at a time from a queue that's kept when the app closes: without a signal at the gym,
// a workout goes up once you're back online. A workout that's on Strava is marked in your data, so
// another phone doesn't upload it again.

import { store } from "./store.js";
import { lsGet, lsSet, lsDel, NetworkError } from "./cloud/common.js";
import { key } from "./profiles.js";
import { stravaFile, stravaDescription, duplicateOf, plainText } from "./strava.js";

const WWW = "https://www.strava.com";
const API = `${WWW}/api/v3`;
const TOKEN_URLS = [`${API}/oauth/token`, `${WWW}/oauth/token`];     // Strava documents both
const KEY_APP = "gym.stravaApp";              // {id, secret}: this phone's Strava API app, for every profile
const KEY_AUTH = "gym.stravaAuth";            // a connection on its way: {state, mode, at}
export const KEY_RESULT = "gym.stravaResult"; // what strava.html hands back
const KEY_TOKEN_URL = "gym.stravaTokenUrl";   // the token address that answered last time
const KEY_ACK = "gym.stravaAck";              // the app got strava.html's answer: the window can close
const kToken = () => key("strava");           // {access, refresh, expiresAt, athlete, auto}
const kQueue = () => key("stravaQueue");      // workouts waiting to go up
const kFailed = () => key("stravaFailed");    // {session: why} for the ones Strava turned down
const kLinks = () => key("stravaLinks");      // {session: {id, at}}: the activity, kept a week (Strava's rule)
const WEEK = 7 * 86400000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strava wants you to connect (again) */
export class StravaAuthError extends Error {}
class RateLimited extends Error {}

const listeners = new Set();
/** Called whenever something about Strava changed (connected, a workout queued, uploading, done) */
export function onStrava(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed() { for (const fn of [...listeners]) { try { fn(); } catch { /* a view that's gone */ } } }

// ---------------------------------------------------------------------------
// The app's codes and the connection
// ---------------------------------------------------------------------------
export const stravaApp = () => { const a = lsGet(KEY_APP); return a?.id && a?.secret ? a : null; };
export function setStravaApp(id, secret) { lsSet(KEY_APP, { id: String(id).trim(), secret: String(secret).trim() }); }
const token = () => lsGet(kToken());
export const connected = () => Boolean(stravaApp() && token()?.refresh);
export const athleteName = () => token()?.athlete || "";
export const autoUpload = () => token()?.auto !== false;
export function setAutoUpload(on) { const t = token(); if (t) lsSet(kToken(), { ...t, auto: Boolean(on) }); changed(); }

/** Where Strava sends you back: strava.html next to the app */
export const stravaRedirect = (href = location.href) => `${href.split(/[?#]/)[0].replace(/[^/]*$/, "")}strava.html`;

export function authorizeUrl(state, app = stravaApp()) {
  const p = new URLSearchParams({ client_id: app.id, redirect_uri: stravaRedirect(), response_type: "code",
    approval_prompt: "auto", scope: "read,activity:write", state });
  return `${WWW}/oauth/authorize?${p}`;
}

let waiting = false;     // a Strava window is open and the app is waiting for its answer

/**
 * Must be called straight from a tap: opens Strava's window (the way the Google sign-in works), waits for its
 * answer, gets the keys. If the window can't open, the whole app goes to Strava and comes back instead
 * (finishPendingStrava picks it up). Resolves with your name on Strava.
 */
export function connectStrava({ redirect = false } = {}) {
  if (!stravaApp()) return Promise.reject(new Error("Add the Client ID and Client Secret first."));
  const state = `s${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  const url = authorizeUrl(state);
  lsDel(KEY_RESULT);
  let popup = null;
  if (!redirect) { try { popup = window.open(url, "gym-strava", "popup=yes,width=520,height=760"); } catch { popup = null; } }
  if (!popup) {
    lsSet(KEY_AUTH, { state, mode: "redirect", at: Date.now() });
    location.assign(url);
    return new Promise(() => {});              // the page is leaving
  }
  lsSet(KEY_AUTH, { state, mode: "popup", at: Date.now() });
  return waitForAnswer(state, popup).then((res) => { lsDel(KEY_AUTH); return redeem(res); });
}

/** A connection that came back while nobody was waiting for it (the whole app went to Strava, or the window
 *  finished after the app stopped waiting). Resolves with the name, or null when there's nothing to finish. */
export async function finishPendingStrava() {
  const auth = lsGet(KEY_AUTH), res = lsGet(KEY_RESULT);
  if (waiting || !auth || !res || res.state !== auth.state) return null;
  lsDel(KEY_AUTH); lsDel(KEY_RESULT);
  if (Date.now() - auth.at > 15 * 60000) return null;
  return redeem(res);
}

function waitForAnswer(state, popup) {
  waiting = true;
  return new Promise((resolve, reject) => {
    let done = false, closedAt = 0, bc = null;
    const finish = (fn, v) => { if (done) return; done = true; cleanup(); fn(v); };
    const check = (res) => {
      if (done || !res || res.state !== state) return;
      lsDel(KEY_RESULT);
      // tell the window its answer arrived (else it shows the code to paste here), then close it
      try { bc?.postMessage({ type: "gym-strava-ack", state }); } catch { /* closed */ }
      lsSet(KEY_ACK, state);
      try { popup.close(); } catch { /* it closes itself */ }
      finish(resolve, res);
    };
    const onMessage = (ev) => { if (ev.origin === location.origin && ev.data?.type === "gym-strava") check(ev.data); };
    const onStorage = (ev) => { if (ev.key === KEY_RESULT && ev.newValue) { try { check(JSON.parse(ev.newValue)); } catch { /* not ours */ } } };
    try { bc = new BroadcastChannel("gym-strava"); bc.onmessage = (ev) => check(ev.data); } catch { bc = null; }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    const poll = setInterval(() => {
      check(lsGet(KEY_RESULT));
      if (done) return;
      let closed = false;
      try { closed = popup.closed; } catch { closed = false; }
      if (!closed) { closedAt = 0; return; }
      closedAt = closedAt || Date.now();
      if (Date.now() - closedAt > 4000) finish(reject, Object.assign(new Error("The Strava window closed without handing its answer to GymBro."), { closed: true }));
    }, 400);
    const timeout = setTimeout(() => finish(reject, new Error("Connecting took too long. Try again.")), 10 * 60000);
    function cleanup() {
      waiting = false;
      clearInterval(poll); clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      try { bc?.close(); } catch { /* ignore */ }
    }
  });
}

/** The code Strava's window showed, pasted here (when the window couldn't hand it over by itself) */
export function connectWithCode(text) {
  const code = String(text || "").trim().replace(/^.*[?&]code=([^&\s]+).*$/s, "$1");
  if (!/^[0-9a-zA-Z]{10,}$/.test(code)) return Promise.reject(new Error("That isn't the code from the Strava window. It's a long row of letters and digits."));
  lsDel(KEY_AUTH);
  return redeem({ code, scope: "activity:write" });
}

async function redeem(res) {
  if (res.error) throw new Error(res.error === "access_denied" ? "Strava wasn't allowed to connect." : `Strava said: ${plainText(res.error)}`);
  if (!res.code) throw new Error("Strava didn't send its answer back. Try again.");
  if (!/activity:write/.test(res.scope || "")) {
    throw new Error("Keep “Upload your activities” ticked when Strava asks: that's what lets GymBro add your workouts. Connect again.");
  }
  const j = await tokenRequest({ grant_type: "authorization_code", code: res.code });
  const a = j.athlete || {};
  lsSet(kToken(), { access: j.access_token, refresh: j.refresh_token, expiresAt: j.expires_at,
    athlete: [a.firstname, a.lastname].filter(Boolean).join(" "), auto: token()?.auto ?? true, at: Date.now() });
  problem = null;
  changed();
  flushStrava();
  return athleteName();
}

/** What Strava's "errors" say, in words */
function explain(j, status) {
  const errs = Array.isArray(j?.errors) ? j.errors : [];
  const has = (resource, field) => errs.some((e) => (!resource || e.resource === resource) && (!field || e.field === field));
  if (has("Application", "client_id")) return "Strava doesn't know that Client ID. Check it in Settings › Strava.";
  if (has("Application", "client_secret") || has("Application")) return "The Client Secret isn't right. Copy it again from strava.com/settings/api (Settings › Strava).";
  if (has("AuthorizationCode")) return "Connecting didn't finish. Tap Connect again.";
  if (has("RefreshToken") || has("AccessToken")) return "Strava signed GymBro out. Connect again in Settings › Strava.";
  if (errs.some((e) => /activity:write/.test(`${e.field} ${e.code}`))) return "Strava didn't allow uploads: connect again and keep “Upload your activities” ticked.";
  const words = plainText(j?.error || j?.message || "");
  return words && words !== "Bad Request" ? `Strava said: ${words}` : `Strava said no (${status}).`;
}

/** The token address: the documented one, else the other; the one that answers is remembered */
async function tokenRequest(params) {
  const app = stravaApp();
  if (!app) throw new StravaAuthError("Add the Client ID and Client Secret in Settings › Strava.");
  const first = lsGet(KEY_TOKEN_URL) || TOKEN_URLS[0];
  let lastErr = null;
  for (const url of [first, ...TOKEN_URLS.filter((u) => u !== first)]) {
    let r;
    // a plain form post: no extra questions from the browser before it
    try { r = await fetch(url, { method: "POST", body: new URLSearchParams({ client_id: app.id, client_secret: app.secret, ...params }), cache: "no-store" }); }
    catch (err) { lastErr = err; continue; }
    lsSet(KEY_TOKEN_URL, url);
    let j = {};
    try { j = await r.json(); } catch { /* not JSON */ }
    if (r.ok && j.access_token) return j;
    if (r.status === 400 || r.status === 401) throw new StravaAuthError(explain(j, r.status));
    if (r.status === 429) throw new RateLimited("Strava's limit for now");
    throw new Error(explain(j, r.status));
  }
  throw new NetworkError(lastErr?.message || "Load failed");
}

function signedOut(why) {
  const t = token();
  if (t) lsSet(kToken(), { ...t, access: null, refresh: null });
  problem = why;
  changed();
}

/** A working key for Strava, refreshed when it's about to run out (they last 6 hours) */
async function accessToken(force = false) {
  const t = token();
  if (!t?.refresh) throw new StravaAuthError("Connect Strava in Settings › Strava.");
  if (!force && t.access && t.expiresAt * 1000 - Date.now() > 5 * 60000) return t.access;
  let j;
  try { j = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh }); } catch (err) {
    if (err instanceof StravaAuthError) signedOut(err.message);
    throw err;
  }
  lsSet(kToken(), { ...token(), access: j.access_token, refresh: j.refresh_token || t.refresh, expiresAt: j.expires_at });
  return j.access_token;
}

async function api(path, init = {}, again = true) {
  const t = await accessToken();
  let r;
  try { r = await fetch(`${API}${path}`, { cache: "no-store", ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` } }); }
  catch (err) { throw new NetworkError(err?.message || "Load failed"); }
  let j = {};
  try { j = await r.clone().json(); } catch { /* not JSON */ }
  if (r.status === 401 && again && !(j.errors || []).some((e) => /activity:write/.test(`${e.field} ${e.code}`))) {
    await accessToken(true);
    return api(path, init, false);
  }
  if (r.status === 401) { const why = explain(j, 401); signedOut(why); throw new StravaAuthError(why); }
  if (r.status === 429) throw new RateLimited("Strava's limit for now");
  return { r, j };
}

/** Upload one workout and wait while Strava reads it. Resolves with the activity (null if it's still being
 *  read: it shows up on Strava soon). */
async function upload(session) {
  const data = store.data;
  // a new name each time: Strava ties a name to its first upload and answers a second one with that one's
  // result, so a workout that failed once could never go up again (the mark in your data stops doubles)
  const name = `gymbro-${session.id}-${Date.now().toString(36)}`;
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify(stravaFile(session, data))], { type: "application/json" }), `${name}.json`);
  form.append("data_type", "json");
  form.append("sport_type", "WeightTraining");
  form.append("name", session.name);
  form.append("description", stravaDescription(session, data));
  form.append("external_id", name);
  const { r, j } = await api("/uploads", { method: "POST", body: form });
  if (!r.ok || j.error) {
    const dup = duplicateOf(j.error) || duplicateOf(j.message) || duplicateOf(JSON.stringify(j.errors || ""));
    if (dup) return dup;
    throw new Error(explain(j, r.status));
  }
  let up = j;
  for (let i = 0; !up.activity_id && i < 25; i++) {
    await wait(i < 4 ? 1500 : 3000);           // Strava: usually ready in 2 seconds; no more than once a second
    const res = await api(`/uploads/${up.id_str || up.id}`);
    if (res.j.error) {
      const dup = duplicateOf(res.j.error);
      if (dup) return dup;
      throw new Error(`Strava couldn't read it: ${plainText(res.j.error)}`);
    }
    if (!res.r.ok) throw new Error(explain(res.j, res.r.status));
    up = res.j;
  }
  return up.activity_id ? String(up.activity_id) : null;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------
const queue = () => lsGet(kQueue(), []) || [];
const failed = () => lsGet(kFailed(), {}) || {};
let running = null, current = null, pausedUntil = 0, problem = null;

/** Why the queue is waiting, if it is: no signal, Strava's limit, connect again */
export const stravaProblem = () => problem;

function links() {
  const all = lsGet(kLinks(), {}) || {};
  const keep = Object.fromEntries(Object.entries(all).filter(([, v]) => Date.now() - v.at < WEEK));
  if (Object.keys(keep).length !== Object.keys(all).length) lsSet(kLinks(), keep);
  return keep;
}

/** Workouts to go up to Strava, in this order (they're tried again later when there's no signal) */
export function queueUploads(ids) {
  const q = queue(), f = failed();
  for (const id of ids) { if (!q.includes(id)) q.push(id); delete f[id]; }
  lsSet(kQueue(), q); lsSet(kFailed(), f);
  changed();
  return flushStrava();
}

/** Upload what's waiting, one at a time. Safe to call any time: it does nothing when there's nothing to do. */
export function flushStrava() {
  if (running) return running;
  if (!store.ready || !connected() || !queue().length || Date.now() < pausedUntil) return Promise.resolve();
  running = (async () => {
    problem = null;
    try {
      for (;;) {
        const q = queue();
        if (!q.length || !connected()) break;
        const id = q[0];
        const s = store.data.sessions.find((x) => x.id === id);
        if (!s || s.strava) { lsSet(kQueue(), queue().filter((x) => x !== id)); continue; }    // deleted, or up already
        current = id;
        changed();
        try {
          const activity = await upload(s);
          lsSet(kQueue(), queue().filter((x) => x !== id));
          if (activity) lsSet(kLinks(), { ...links(), [id]: { id: activity, at: Date.now() } });
          store.commit({ type: "markStrava", id, at: Date.now() });
        } catch (err) {
          if (err instanceof NetworkError) { problem = "No connection to Strava: it goes up when you're back online."; break; }
          if (err instanceof RateLimited) { pausedUntil = Date.now() + 15 * 60000; problem = "Strava's limit for now: GymBro goes on in 15 minutes."; break; }
          if (err instanceof StravaAuthError) { problem = err.message; break; }
          // Strava turned this one down: the others go on
          lsSet(kQueue(), queue().filter((x) => x !== id));
          lsSet(kFailed(), { ...failed(), [id]: err.message || "Strava didn't take it." });
        } finally {
          current = null;
          changed();
        }
      }
    } finally {
      running = null;
      changed();
    }
  })();
  return running;
}

/**
 * Where a workout stands with Strava: {state: "done" | "uploading" | "queued" | "failed" | "none", ...}
 * done: {at, link (for a week)}; queued: {problem}; failed: {why}
 */
export function stravaStatus(sessionId) {
  const s = store.data?.sessions.find((x) => x.id === sessionId);
  if (s?.strava) { const l = links()[sessionId]; return { state: "done", at: s.strava.at, link: l ? `${WWW}/activities/${l.id}` : null }; }
  if (current === sessionId) return { state: "uploading" };
  if (queue().includes(sessionId)) return { state: "queued", problem };
  const why = failed()[sessionId];
  return why ? { state: "failed", why } : { state: "none" };
}

/** How many are waiting, and the one going up */
export const stravaProgress = () => ({ waiting: queue().length, current });

/** Disconnect: Strava forgets GymBro's keys (the workouts on Strava stay there) */
export async function disconnectStrava() {
  let access = null;
  try { access = await accessToken(); } catch { access = token()?.access || null; }
  lsDel(kToken()); lsDel(kQueue()); lsDel(kFailed()); lsDel(kLinks());
  problem = null;
  changed();
  if (access) {
    // only the asking matters, not the answer
    try { await fetch(`${WWW}/oauth/deauthorize?access_token=${encodeURIComponent(access)}`, { method: "POST", mode: "no-cors" }); } catch { /* offline */ }
  }
}
