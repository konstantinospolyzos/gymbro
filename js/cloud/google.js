// Google Drive: the same sign-in as the Savings Tracker and Glosor (the client ID in config.js), and only
// the files this app makes (the drive.file permission). Google's permission lasts about an hour; after
// that the next tap signs in again (a Google window may flash for a second).

import { AuthError, lsGet, lsSet, lsDel, FILE_NAME, netFetch } from "./common.js";
import { key, tagKind } from "../profiles.js";

const KEY_TOKEN = key("googleToken");      // each profile signs in on its own
export const FOLDER_NAME = "GymBro";
const TAG = "gymBro";                 // marks this app's files in Drive (appProperties)
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

const meta = (f) => (f ? { id: f.id, version: String(f.version), link: f.webViewLink || null } : null);

export class GoogleDrive {
  constructor(clientId) {
    this.kind = "gdrive";
    this.label = "Google Drive";
    this.where = `My Drive › ${FOLDER_NAME} › ${FILE_NAME}`;
    this.clientId = clientId;
    this.client = null;
    const t = lsGet(KEY_TOKEN);
    this.token = t && t.expiry > Date.now() ? t.token : null;
    this.expiry = t ? t.expiry : 0;
    this.hint = t ? t.hint : null;
    this._gis = null;
  }

  get configured() { return Boolean(this.clientId); }
  tokenValid() { return Boolean(this.token) && Date.now() < this.expiry; }
  /** True when only a tap can get a new permission */
  needsTap() { return !this.tokenValid(); }
  async ensureToken() { if (!this.tokenValid()) throw new AuthError("Sign in again"); }
  warmUp() { this.loadGis().then(() => this._ensureClient()).catch(() => {}); }
  /** Google's sign-in script must be loaded before a tap can open its window */
  get tapReady() { return Boolean(window.google?.accounts?.oauth2); }

  loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (!this._gis) {
      this._gis = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { this._gis = null; reject(new Error("Couldn't load Google sign-in. Check your connection.")); };
        document.head.appendChild(s);
      });
    }
    return this._gis;
  }

  _ensureClient() {
    if (this.client) return true;
    if (!window.google?.accounts?.oauth2) return false;
    this.client = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId, scope: SCOPE,
      callback: (resp) => this._done(resp),
      error_callback: (err) => this._fail(err),
    });
    return true;
  }

  /** Must be called straight from a tap (browsers only allow sign-in windows then). */
  requestToken() {
    return new Promise((resolve, reject) => {
      if (!this._ensureClient()) {
        this.loadGis().then(() => reject(new Error("Google sign-in is ready now. Tap again."))).catch(reject);
        return;
      }
      this._resolve = resolve;
      this._reject = reject;
      // the first sign-in of a profile: choose the account (on a shared phone it may be someone else's)
      this.client.requestAccessToken({ prompt: this.hint ? "" : "select_account", login_hint: this.hint || undefined });
    });
  }

  _done(resp) {
    if (resp.error) return this._reject?.(new Error(resp.error_description || resp.error));
    if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE))
      return this._reject?.(new Error("Google Drive access wasn't allowed. Tick the Drive box when you sign in."));
    this.token = resp.access_token;
    this.expiry = Date.now() + (Number(resp.expires_in || 3600) - 120) * 1000;
    lsSet(KEY_TOKEN, { token: this.token, expiry: this.expiry, hint: this.hint });
    this._resolve?.(this.token);
  }

  _fail(err) {
    const why = err?.type === "popup_closed" ? "Sign-in was closed before it finished."
      : err?.type === "popup_failed_to_open" ? "The sign-in window was blocked. Allow pop-ups for this site and tap again."
        : "Google sign-in didn't work. Try again.";
    this._reject?.(new Error(why));
  }

  setHint(email) {
    this.hint = email;
    lsSet(KEY_TOKEN, { token: this.token, expiry: this.expiry, hint: email });
  }

  signOut() {
    if (this.token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(this.token, () => {});
    this.token = null; this.expiry = 0; this.hint = null;
    lsDel(KEY_TOKEN);
  }

  async call(method, url, { body, headers = {}, raw = false } = {}) {
    if (!this.tokenValid()) throw new AuthError("Sign in again");
    const resp = await netFetch(url, { method, body, headers: { Authorization: `Bearer ${this.token}`, ...headers } });
    if (resp.status === 401) { this.token = null; lsDel(KEY_TOKEN); throw new AuthError("Sign in again"); }
    if (resp.status === 404 || resp.status === 204) return null;
    if (!resp.ok) {
      let msg = `Google Drive answered ${resp.status}`;
      try { const j = await resp.json(); msg = j.error?.message || msg; } catch { /* keep msg */ }
      throw new Error(msg);
    }
    return raw ? resp.text() : resp.json();
  }

  async about() {
    const me = await this.call("GET", `${API}/about?fields=user(emailAddress,displayName)`);
    return { email: me?.user?.emailAddress || null, name: me?.user?.displayName || null };
  }

  async _find(kind) {
    const q = encodeURIComponent(`appProperties has { key='${TAG}' and value='${kind}' } and trashed=false`);
    const res = await this.call("GET", `${API}/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,name,version,modifiedTime,webViewLink)`);
    return res?.files?.[0] || null;
  }

  async find() { return meta(await this._find(tagKind("data"))); }

  async getMeta(id) {
    const f = await this.call("GET", `${API}/files/${id}?fields=id,name,version,modifiedTime,webViewLink,trashed`);
    return f && !f.trashed ? meta(f) : null;
  }

  async download(id) {
    const text = await this.call("GET", `${API}/files/${id}?alt=media`, { raw: true });
    return text === null ? null : JSON.parse(text);
  }

  async folder() {
    const found = await this._find("folder");
    if (found) return found.id;
    const made = await this.call("POST", `${API}/files?fields=id`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", appProperties: { [TAG]: "folder" } }),
    });
    return made.id;
  }

  async create(data, { name = FILE_NAME, kind = "data" } = {}) {
    const parent = await this.folder();
    const boundary = `gym${Math.random().toString(36).slice(2)}`;
    const m = { name, mimeType: "application/json", parents: [parent], appProperties: { [TAG]: tagKind(kind) } };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(m)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(data, null, 1)}\r\n--${boundary}--`;
    return meta(await this.call("POST", `${UPLOAD}/files?uploadType=multipart&fields=id,name,version,modifiedTime,webViewLink`, {
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
    }));
  }

  async upload(id, data) {
    return meta(await this.call("PATCH", `${UPLOAD}/files/${id}?uploadType=media&fields=id,name,version,modifiedTime,webViewLink`, {
      headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(data, null, 1),
    }));
  }

  /** Weekly copies, newest first */
  async backups() {
    const q = encodeURIComponent(`appProperties has { key='${TAG}' and value='${tagKind("backup")}' } and trashed=false`);
    const res = await this.call("GET", `${API}/files?q=${q}&spaces=drive&orderBy=createdTime desc&pageSize=100&fields=files(id,name,createdTime)`);
    return (res?.files || []).map((f) => ({ id: f.id, createdTime: f.createdTime }));
  }

  remove(id) { return this.call("DELETE", `${API}/files/${id}`); }
}
