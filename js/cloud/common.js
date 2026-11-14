// Shared by the two cloud connections: small storage helpers and the "sign in again" error.

import { fileBase } from "../profiles.js";

export class AuthError extends Error {}

/** The request didn't reach the server or its answer didn't come back (no signal, the app went to the
 *  background, a dropped connection: Safari says "Load failed"). Nothing is lost: it's tried again later. */
export class NetworkError extends Error {}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch for the cloud: never from the browser's cache (Safari can answer a repeat request from a stored copy
 * that then fails), and a dropped connection is tried again twice when the request is safe to repeat.
 */
export async function netFetch(url, init = {}, { tries = 3, pause = 800 } = {}) {
  const repeatable = ["GET", "HEAD", "PUT", "PATCH", "DELETE"].includes(String(init.method || "GET").toUpperCase());
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, { cache: "no-store", ...init });
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      if (!repeatable || i >= tries) throw new NetworkError(err?.message || "Load failed");
      await wait(pause * i * i);        // 0.8 s, then 3.2 s
    }
  }
}

export const lsGet = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
export const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

// each profile has its own file: gymbro.json for the first, gymbro-anna.json for Anna (and her backups)
export const FILE_NAME = `${fileBase()}.json`;
export const BACKUP_PREFIX = `${fileBase()}-backup-`;
export const backupName = () => `${BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}.json`;
