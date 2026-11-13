// Shared by the two cloud connections: small storage helpers and the "sign in again" error.

import { fileBase } from "../profiles.js";

export class AuthError extends Error {}

export const lsGet = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
export const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

// each profile has its own file: gymbro.json for the first, gymbro-anna.json for Anna (and her backups)
export const FILE_NAME = `${fileBase()}.json`;
export const BACKUP_PREFIX = `${fileBase()}-backup-`;
export const backupName = () => `${BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}.json`;
