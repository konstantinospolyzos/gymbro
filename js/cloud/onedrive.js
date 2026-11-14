// OneDrive: one JSON file in the app's own folder (OneDrive › Apps › GymBro), through Microsoft Graph.
// The app can only see that folder (the Files.ReadWrite.AppFolder permission).
//
// Signing in is the standard way for web apps without a server ("authorization code with PKCE"):
// a Microsoft window opens from a tap, comes back to auth.html with a one-time code, and the app swaps
// that code for tokens. Microsoft keeps the app signed in for 24 hours (its limit for web apps); after
// that the next tap opens the Microsoft window again, which usually closes by itself straight away.

import { AuthError, lsGet, lsSet, lsDel, FILE_NAME, BACKUP_PREFIX, netFetch } from "./common.js";
import { key } from "../profiles.js";

const LOGIN = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPE = "openid profile offline_access Files.ReadWrite.AppFolder";
const KEY_TOKEN = key("onedrive");          // each profile signs in on its own
const KEY_PKCE = "gym.onedrivePkce";
export const KEY_RESULT = "gym.onedriveResult";
const DAY = 86400000;

/** Where Microsoft sends you back after signing in: auth.html next to the app */
export function redirectUri(href = location.href) {
  return `${href.split(/[?#]/)[0].replace(/[^/]*$/, "")}auth.html`;
}

const b64url = (buf) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function makePkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge, state: b64url(crypto.getRandomValues(new Uint8Array(16))) };
}

/** The name and email in Microsoft's id token (a JWT): no network needed */
export function idClaims(idToken) {
  try {
    const part = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(part + "===".slice((part.length + 3) % 4)).split("").map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    const c = JSON.parse(json);
    return { name: c.name || null, email: c.preferred_username || c.email || null };
  } catch { return { name: null, email: null }; }
}

/** Microsoft's error codes, in words */
export function explain(code, description = "") {
  const d = String(description || "");
  if (code === "access_denied" || /AADSTS65004|AADSTS50126/.test(d)) return "Sign-in was cancelled.";
  if (/AADSTS9002326|AADSTS9002327|Single-Page Application/i.test(d))
    return "In the Microsoft app registration, the sign-in address must be under “Single-page application”, not “Web”. See SETUP.md, step 2.";
  if (/AADSTS50011|redirect_uri/i.test(d)) return `The sign-in address in the Microsoft app registration must be exactly ${redirectUri()}`;
  if (/AADSTS700016|AADSTS90002/.test(d)) return "Microsoft doesn't know this Application (client) ID. Check it in Settings › OneDrive.";
  if (/userAudience|AADSTS50020|AADSTS500200/.test(d))
    return "The Microsoft app registration must allow personal Microsoft accounts. See SETUP.md, step 2.";
  if (code === "invalid_grant" || /AADSTS70008|AADSTS700082|AADSTS700084/.test(d)) return "Microsoft's sign-in has expired. Tap to sign in again.";
  const first = d.split(/\r?\n/)[0].replace(/^AADSTS\d+:\s*/, "");
  return first ? `Microsoft said: ${first}` : "OneDrive sign-in didn't work. Try again.";
}

const meta = (item) => (item && !item.deleted ? { id: item.id, version: String(item.eTag || item.cTag || item.lastModifiedDateTime || ""), link: item.webUrl || null } : null);

export class OneDrive {
  constructor(clientId) {
    this.kind = "onedrive";
    this.label = "OneDrive";
    this.where = `OneDrive › Apps › GymBro › ${FILE_NAME}`;
    this.clientId = clientId || "";
    const t = lsGet(KEY_TOKEN) || {};
    this.access = t.access || null;
    this.expiry = t.expiry || 0;
    this.refresh = t.refresh || null;
    this.refreshExpiry = t.refreshExpiry || 0;
    this.hint = t.hint || null;
    this.name = t.name || null;
    this._pkce = null;
    this._refreshing = null;
  }

  get configured() { return Boolean(this.clientId); }
  tokenValid() { return Boolean(this.access) && Date.now() < this.expiry; }
  canRefresh() { return Boolean(this.refresh) && Date.now() < this.refreshExpiry; }
  needsTap() { return !this.tokenValid() && !this.canRefresh(); }
  get tapReady() { return true; }
  /** Make the next sign-in's codes ahead of time, so a tap can open Microsoft's window at once */
  warmUp() { if (!this._pkce && this.configured) makePkce().then((p) => { this._pkce = p; }).catch(() => {}); }

  _store() {
    lsSet(KEY_TOKEN, { access: this.access, expiry: this.expiry, refresh: this.refresh, refreshExpiry: this.refreshExpiry, hint: this.hint, name: this.name });
  }

  authorizeUrl(pkce, { select = false } = {}) {
    const p = new URLSearchParams({
      client_id: this.clientId, response_type: "code", redirect_uri: redirectUri(), response_mode: "query",
      scope: SCOPE, state: pkce.state, code_challenge: pkce.challenge, code_challenge_method: "S256",
    });
    if (this.hint && !select) p.set("login_hint", this.hint);
    else p.set("prompt", "select_account");
    return `${LOGIN}/authorize?${p}`;
  }

  /**
   * Must be called straight from a tap: opens Microsoft's window, waits for it to come back, gets the tokens.
   * If the window can't open, the whole app goes to Microsoft and comes back (finishRedirect picks it up).
   */
  requestToken({ select = false } = {}) {
    if (!this.configured) return Promise.reject(new Error("OneDrive isn't set up yet. See Settings › OneDrive."));
    const ready = this._pkce;
    this._pkce = null;
    let popup = null;
    try {
      popup = window.open(ready ? this.authorizeUrl(ready, { select }) : "about:blank", "gym-onedrive", "popup=yes,width=500,height=720");
    } catch { popup = null; }
    if (!popup) {
      if (!ready) return Promise.reject(new Error("The Microsoft window was blocked. Tap again."));
      lsSet(KEY_PKCE, { ...ready, mode: "redirect", at: Date.now() });
      lsDel(KEY_RESULT);
      location.assign(this.authorizeUrl(ready, { select }));
      return new Promise(() => {});           // the page is leaving
    }
    return (async () => {
      const pkce = ready || await makePkce();
      lsSet(KEY_PKCE, { ...pkce, mode: "popup", at: Date.now() });
      lsDel(KEY_RESULT);
      if (!ready) popup.location.href = this.authorizeUrl(pkce, { select });
      try {
        const res = await this._waitForCode(pkce.state, popup);
        lsDel(KEY_PKCE);
        await this._redeem(res.code, pkce.verifier);
      } catch (err) {
        if (err.answered) lsDel(KEY_PKCE);     // Microsoft said no; a window closed early may still answer later
        throw err;
      } finally {
        this.warmUp();
      }
    })();
  }

  /**
   * A sign-in that came back while nobody was waiting for it: after a full-page sign-in, or when the
   * Microsoft window finished after the app had stopped waiting. Then finishPending() completes it.
   */
  hasPendingResult() {
    const pk = lsGet(KEY_PKCE), res = lsGet(KEY_RESULT);
    return Boolean(pk && res && res.state === pk.state && Date.now() - pk.at < 15 * 60000);
  }

  async finishPending() {
    const pk = lsGet(KEY_PKCE), res = lsGet(KEY_RESULT);
    lsDel(KEY_PKCE); lsDel(KEY_RESULT);
    if (!pk || !res || res.state !== pk.state) throw new Error("Sign-in didn't finish. Try again.");
    if (res.error) throw new Error(explain(res.error, res.error_description));
    await this._redeem(res.code, pk.verifier);
  }

  _waitForCode(state, popup) {
    const self = this;
    this.waiting = true;
    return new Promise((resolve, reject) => {
      let done = false, closedAt = 0, bc = null;
      const finish = (fn, v) => { if (done) return; done = true; cleanup(); fn(v); };
      const check = (res) => {
        if (done || !res || res.state !== state) return;
        lsDel(KEY_RESULT);
        try { popup.close(); } catch { /* it closes itself */ }
        if (res.error) finish(reject, Object.assign(new Error(explain(res.error, res.error_description)), { answered: true }));
        else if (res.code) finish(resolve, res);
      };
      const onMessage = (ev) => { if (ev.origin === location.origin && ev.data?.type === "gym-onedrive") check(ev.data); };
      const onStorage = (ev) => { if (ev.key === KEY_RESULT && ev.newValue) { try { check(JSON.parse(ev.newValue)); } catch { /* not ours */ } } };
      try { bc = new BroadcastChannel("gym-onedrive"); bc.onmessage = (ev) => check(ev.data); } catch { bc = null; }
      window.addEventListener("message", onMessage);
      window.addEventListener("storage", onStorage);
      const poll = setInterval(() => {
        check(lsGet(KEY_RESULT));
        if (done) return;
        let closed = false;
        try { closed = popup.closed; } catch { closed = false; }
        if (!closed) { closedAt = 0; return; }
        closedAt = closedAt || Date.now();
        if (Date.now() - closedAt > 4000) finish(reject, new Error("Sign-in was closed before it finished."));
      }, 400);
      const timeout = setTimeout(() => finish(reject, new Error("Sign-in took too long. Try again.")), 10 * 60000);
      function cleanup() {
        self.waiting = false;
        clearInterval(poll); clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
        try { bc?.close(); } catch { /* ignore */ }
      }
    });
  }

  async _token(params) {
    const resp = await netFetch(`${LOGIN}/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, scope: SCOPE, ...params }),
    });
    let j = {};
    try { j = await resp.json(); } catch { /* no body */ }
    return { ok: resp.ok, j };
  }

  async _redeem(code, verifier) {
    const { ok, j } = await this._token({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
    if (!ok || !j.access_token) throw new Error(explain(j.error, j.error_description));
    this._save(j, true);
  }

  _save(j, fresh) {
    const now = Date.now();
    this.access = j.access_token;
    this.expiry = now + (Number(j.expires_in || 3600) - 120) * 1000;
    if (j.refresh_token) this.refresh = j.refresh_token;
    // Microsoft lets web apps refresh for 24 hours from signing in; refreshing doesn't extend that
    if (fresh) this.refreshExpiry = now + DAY - 10 * 60000;
    if (j.id_token) {
      const c = idClaims(j.id_token);
      this.hint = c.email || this.hint;
      this.name = c.name || this.name;
    }
    this._store();
  }

  async _refresh() {
    const { ok, j } = await this._token({ grant_type: "refresh_token", refresh_token: this.refresh });
    if (!ok || !j.access_token) {
      if (j.error === "invalid_grant" || j.error === "interaction_required" || j.error === "invalid_client") {
        this.refresh = null; this.refreshExpiry = 0; this.access = null; this.expiry = 0;
        this._store();
        throw new AuthError(explain(j.error, j.error_description));
      }
      throw new Error(explain(j.error, j.error_description));
    }
    this._save(j, false);
  }

  /** A working token, refreshed without a tap when Microsoft allows it */
  async ensureToken() {
    if (this.tokenValid()) return;
    if (!this.canRefresh()) throw new AuthError("Sign in again");
    if (!this._refreshing) this._refreshing = this._refresh().finally(() => { this._refreshing = null; });
    await this._refreshing;
  }

  signOut() {
    this.access = null; this.expiry = 0; this.refresh = null; this.refreshExpiry = 0; this.hint = null; this.name = null;
    lsDel(KEY_TOKEN);
  }

  async call(method, path, { body, headers = {}, raw = false, again = true } = {}) {
    await this.ensureToken();
    const resp = await netFetch(path.startsWith("https:") ? path : `${GRAPH}${path}`, { method, body, headers: { Authorization: `Bearer ${this.access}`, ...headers } });
    if (resp.status === 401) {
      this.access = null; this.expiry = 0; this._store();
      if (again && this.canRefresh()) return this.call(method, path, { body, headers, raw, again: false });
      throw new AuthError("Sign in again");
    }
    if (resp.status === 404 || resp.status === 204) return null;
    if (!resp.ok) {
      let msg = `OneDrive answered ${resp.status}`;
      try { const j = await resp.json(); msg = j.error?.message || msg; } catch { /* keep msg */ }
      throw new Error(msg);
    }
    return raw ? resp.text() : resp.json();
  }

  async about() { return { email: this.hint, name: this.name }; }

  setHint() { /* the hint comes from Microsoft's id token */ }

  // The data file and its weekly copies are addressed by their names inside the app's folder
  // ("approot"), which is exactly what the app-folder permission allows. The name works as the file's id.
  _path(name) { return `/me/drive/special/approot:/${encodeURIComponent(name)}`; }

  async find() {
    // the first call makes the app's folder (OneDrive › Apps › <the app registration's name>)
    await this.call("GET", "/me/drive/special/approot?$select=id,name,webUrl");
    return this.getMeta(FILE_NAME);
  }

  async getMeta(id) {
    const item = await this.call("GET", `${this._path(id)}?$select=id,name,eTag,cTag,webUrl,lastModifiedDateTime`);
    const m = meta(item);
    return m ? { ...m, id } : null;
  }

  async download(id) {
    // a web app can't follow /content's redirect, so it asks for the file's ready-made download address
    const item = await this.call("GET", `${this._path(id)}?$select=id,@microsoft.graph.downloadUrl`);
    const url = item?.["@microsoft.graph.downloadUrl"];
    if (!url) return null;
    const resp = await netFetch(url);
    if (!resp.ok) throw new Error(`OneDrive answered ${resp.status}`);
    return JSON.parse(await resp.text());
  }

  async create(data, { name = FILE_NAME } = {}) { return this.upload(name, data); }

  async upload(id, data) {
    const item = await this.call("PUT", `${this._path(id)}:/content`, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data, null, 1) });
    return { ...meta(item), id };
  }

  /** Weekly copies, newest first */
  async backups() {
    const res = await this.call("GET", "/me/drive/special/approot/children?$select=id,name,createdDateTime&$top=200");
    return (res?.value || []).filter((f) => f.name?.startsWith(BACKUP_PREFIX))
      .map((f) => ({ id: f.name, createdTime: f.createdDateTime })).sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  }

  remove(id) { return this.call("DELETE", this._path(id)); }
}
