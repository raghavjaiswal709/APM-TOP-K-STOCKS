import * as fs from 'fs';
import * as path from 'path';
import { pbkdf2Sync, randomBytes } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  action: string;
  message: string;
}

export interface UserAuthState {
  authenticated: boolean;
  authLocked: boolean;
}

export interface FyersCreds {
  id: string;
  displayName: string;
  clientId: string;
  secretKey: string;
  redirectUri: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Read fresh every call so env changes (or host.docker.internal resolution) take effect
export function getPythonApi(): string {
  return process.env.PYTHON_API_URL || 'http://100.93.172.21:6977';
}
// Keep the const for backward-compat imports already written
export const PYTHON_API = getPythonApi();

const CREDS_TTL = 5 * 60 * 1000;

// ─── Python API helper ────────────────────────────────────────────────────────

/** fetch() wrapper for the local Python API with a 10 s timeout and clear errors */
export async function pyFetch(
  path: string,
  opts: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const base = getPythonApi();
  const url  = `${base}${path}`;
  const ac   = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);

  try {
    const res  = await fetch(url, { ...opts, signal: ac.signal });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    const e = err as Error;
    const msg = e.name === 'AbortError'
      ? `Timed out connecting to Python API at ${base}`
      : `Cannot reach Python API at ${base} — ${e.message}`;
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

// config.ini candidates — Docker mounts it at /fyers-config/, local dev finds it via cwd
const CONFIG_INI_CANDIDATES = [
  '/fyers-config/config.ini',                                         // Docker (mounted in docker-compose)
  path.join(process.cwd(), '..', 'backend', 'data', 'config.ini'),   // Local dev (apps/frontend/../backend/data)
  path.join(process.cwd(), 'data', 'config.ini'),                     // Fallback
];

// ─── INI parser ───────────────────────────────────────────────────────────────

function parseIni(): Record<string, Record<string, string>> {
  const p = CONFIG_INI_CANDIDATES.find(x => fs.existsSync(x));
  if (!p) return {};
  const sections: Record<string, Record<string, string>> = {};
  let cur = '';
  for (const raw of fs.readFileSync(p, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) { cur = m[1]; sections[cur] = {}; }
    else if (cur) {
      const eq = line.indexOf('=');
      if (eq > 0) sections[cur][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return sections;
}

export function loadCredsFromIni(): FyersCreds[] {
  const sections = parseIni();
  return Object.entries(sections)
    .filter(([, s]) => s.client_id && s.secret_key && s.redirect_uri)
    .map(([name, s]) => {
      const id = s.user ?? name;
      return {
        id,
        displayName: id.charAt(0).toUpperCase() + id.slice(1),
        clientId: s.client_id,
        secretKey: s.secret_key,
        redirectUri: s.redirect_uri,
      };
    });
}

/** Returns true=ok, false=wrong pin, null=no pin configured */
export function checkPin(userId: string, pin: string): boolean | null {
  const s = parseIni()[userId];
  if (!s?.pin_hash || !s?.pin_salt) return null;
  const hash = pbkdf2Sync(pin, s.pin_salt, 100000, 64, 'sha512').toString('hex');
  return hash === s.pin_hash;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

interface State {
  logs: LogEntry[];
  authStates: Map<string, UserAuthState>;
  pinFailures: Map<string, { count: number; lockedUntil: number }>;
  logListeners: Set<(e: LogEntry) => void>;
  cachedCreds: FyersCreds[] | null;
  credsCachedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __fyersState: State | undefined;
}

function st(): State {
  if (!global.__fyersState) {
    global.__fyersState = {
      logs: [],
      authStates: new Map(),
      pinFailures: new Map(),
      logListeners: new Set(),
      cachedCreds: null,
      credsCachedAt: 0,
    };
  }
  return global.__fyersState;
}

// ─── Creds ────────────────────────────────────────────────────────────────────

export function getCreds(): FyersCreds[] {
  const s = st();
  if (s.cachedCreds && Date.now() - s.credsCachedAt < CREDS_TTL) return s.cachedCreds;
  const fresh = loadCredsFromIni();
  s.cachedCreds = fresh;
  s.credsCachedAt = Date.now();
  return fresh;
}

export function refreshCreds(): { count: number; source: 'ini' } {
  const s = st();
  s.cachedCreds = null;
  s.credsCachedAt = 0;
  const creds = loadCredsFromIni();
  s.cachedCreds = creds;
  s.credsCachedAt = Date.now();
  addLog({ level: 'success', action: 'REFRESH_USERS', message: `Loaded ${creds.length} users from config.ini` });
  return { count: creds.length, source: 'ini' };
}

// ─── PIN ──────────────────────────────────────────────────────────────────────

export function validatePin(userId: string, pin: string): { ok: boolean; locked?: boolean; attemptsLeft?: number } {
  const s = st();
  const failure = s.pinFailures.get(userId);
  if (failure && failure.lockedUntil > Date.now()) return { ok: false, locked: true };

  const result = checkPin(userId, pin);
  if (result === null) {
    addLog({ level: 'warning', action: 'PIN_VALIDATE', message: `No PIN configured for user: ${userId}` });
    return { ok: false };
  }
  if (result) {
    s.pinFailures.delete(userId);
    addLog({ level: 'info', action: 'PIN_VALIDATE', message: `PIN validated — user: ${userId}` });
    return { ok: true };
  }

  const prev = failure ?? { count: 0, lockedUntil: 0 };
  const newCount = prev.count + 1;
  const lockedUntil = newCount >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
  s.pinFailures.set(userId, { count: newCount, lockedUntil });
  addLog({ level: 'warning', action: 'PIN_VALIDATE', message: `Invalid PIN (${newCount}/5) — user: ${userId}` });
  return { ok: false, attemptsLeft: Math.max(0, 5 - newCount) };
}

// ─── PIN update ───────────────────────────────────────────────────────────────

/** Rewrite pin_salt, pin_hash, and ; pin comment for userId in config.ini */
export function updateUserPin(userId: string, newPin: string): void {
  const p = CONFIG_INI_CANDIDATES.find(x => fs.existsSync(x));
  if (!p) throw new Error('config.ini not found at any candidate path');

  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(newPin, salt, 100000, 64, 'sha512').toString('hex');

  const lines  = fs.readFileSync(p, 'utf-8').split('\n');
  let inSection = false;

  const updated = lines.map(line => {
    const trimmed = line.trim();
    const secMatch = trimmed.match(/^\[(.+)\]$/);
    if (secMatch) { inSection = secMatch[1] === userId; return line; }
    if (!inSection) return line;
    if (/^;\s*pin\s*=/.test(trimmed))     return `; pin = ${newPin}`;
    if (/^pin_salt\s*=/.test(trimmed))    return `pin_salt = ${salt}`;
    if (/^pin_hash\s*=/.test(trimmed))    return `pin_hash = ${hash}`;
    return line;
  });

  fs.writeFileSync(p, updated.join('\n'), 'utf-8');
  // Bust the credential cache so next getCreds() re-reads the file
  const s = st();
  s.cachedCreds  = null;
  s.credsCachedAt = 0;
  addLog({ level: 'success', action: 'RESET_PIN', message: `PIN updated for user: ${userId}` });
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export function getAuthState(userId: string): UserAuthState {
  return st().authStates.get(userId) ?? { authenticated: false, authLocked: false };
}

export function setAuthState(userId: string, val: UserAuthState): void {
  st().authStates.set(userId, val);
}

export function resetAuth(userId: string): void {
  st().authStates.set(userId, { authenticated: false, authLocked: false });
  addLog({ level: 'info', action: 'RESET_AUTH', message: `Auth reset for user: ${userId}` });
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export function addLog(entry: Omit<LogEntry, 'timestamp'>): LogEntry {
  const s = st();
  const log: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  s.logs.push(log);
  if (s.logs.length > 1000) s.logs = s.logs.slice(-1000);
  s.logListeners.forEach(cb => cb(log));
  return log;
}

export function getLogs(): LogEntry[] { return [...st().logs]; }

export function clearLogs(): void {
  st().logs = [];
  addLog({ level: 'info', action: 'CLEAR_LOGS', message: 'Terminal cleared' });
}

export function subscribeToLogs(cb: (e: LogEntry) => void): () => void {
  const s = st();
  s.logListeners.add(cb);
  return () => s.logListeners.delete(cb);
}
