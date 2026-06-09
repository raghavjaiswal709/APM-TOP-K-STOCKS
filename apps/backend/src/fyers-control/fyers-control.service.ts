import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by GET http://100.93.172.21:6977/users (flexible — normalised below) */
interface ApiUser {
  user?: string;
  id?: string;
  name?: string;
  displayName?: string;
  client_id?: string;
  clientId?: string;
  secret_key?: string;
  secretKey?: string;
  redirect_uri?: string;
  redirectUri?: string;
}

/** Normalised credentials we use internally */
interface FyersCreds {
  id: string;
  displayName: string;
  clientId: string;
  secretKey: string;
  redirectUri: string;
}

interface PinEntry {
  displayName: string;
  pinSalt: string;
  pinHash: string;
}

interface PinConfig {
  pins: Record<string, PinEntry>;
}

export interface UserAuthState {
  authenticated: boolean;
  authLocked: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  action: string;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCAL_API = 'http://100.93.172.21:6977';
const CONFIG_PATH_DOCKER = '/app/data/fyers-users.json';
const CONFIG_PATH_LOCAL = path.join(process.cwd(), 'data', 'fyers-users.json');

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FyersControlService {
  private readonly logger = new Logger(FyersControlService.name);

  /** In-memory cache of credentials fetched from the local API */
  private cachedCreds: FyersCreds[] | null = null;
  private credsCachedAt = 0;
  private readonly CREDS_TTL_MS = 5 * 60 * 1000; // refresh every 5 min

  private readonly authStates = new Map<string, UserAuthState>();
  private readonly pinFailures = new Map<string, { count: number; lockedUntil: number }>();
  private logs: LogEntry[] = [];
  private readonly logListeners = new Set<(e: LogEntry) => void>();

  constructor(private readonly http: HttpService) {}

  // ── Config helpers ────────────────────────────────────────────────────────

  private loadPinConfig(): PinConfig {
    const p = fs.existsSync(CONFIG_PATH_DOCKER) ? CONFIG_PATH_DOCKER : CONFIG_PATH_LOCAL;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as PinConfig;
    } catch (err) {
      this.logger.error(`Failed to load fyers-users.json: ${err.message}`);
      return { pins: {} };
    }
  }

  /** Normalise a raw API user object to our FyersCreds shape */
  private normalise(raw: ApiUser): FyersCreds | null {
    const id = raw.user ?? raw.id ?? raw.name;
    const clientId = raw.client_id ?? raw.clientId;
    const secretKey = raw.secret_key ?? raw.secretKey;
    const redirectUri = raw.redirect_uri ?? raw.redirectUri;
    if (!id || !clientId || !secretKey || !redirectUri) return null;

    const cfg = this.loadPinConfig();
    const pinEntry = cfg.pins[id];
    const displayName = raw.displayName ?? pinEntry?.displayName ?? id;

    return { id, displayName, clientId, secretKey, redirectUri };
  }

  /** Fetch users from local API. Returns null on failure. */
  private async fetchCredsFromApi(): Promise<FyersCreds[] | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiUser[] | { users: ApiUser[] }>(`${LOCAL_API}/users`, { timeout: 5000 } as any),
      );
      const raw: ApiUser[] = Array.isArray(res.data) ? res.data : (res.data as any).users ?? [];
      const normalised = raw.map(u => this.normalise(u)).filter(Boolean) as FyersCreds[];
      if (normalised.length === 0) return null;
      this.logger.log(`Fetched ${normalised.length} users from local API`);
      return normalised;
    } catch {
      return null;
    }
  }

  /** Load fallback users from the FYERS_USERS environment variable (JSON array). */
  private loadFallbackUsers(): FyersCreds[] {
    const raw = process.env.FYERS_USERS;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Array<{
        id: string;
        displayName?: string;
        clientId: string;
        secretKey: string;
        redirectUri: string;
      }>;
      return parsed
        .filter(u => u.id && u.clientId && u.secretKey && u.redirectUri &&
                     u.clientId !== 'CONFIGURE_CLIENT_ID' && u.secretKey !== 'CONFIGURE_SECRET_KEY')
        .map(u => ({
          id: u.id,
          displayName: u.displayName ?? u.id,
          clientId: u.clientId,
          secretKey: u.secretKey,
          redirectUri: u.redirectUri,
        }));
    } catch (err) {
      this.logger.error(`Failed to parse FYERS_USERS env var: ${err.message}`);
      return [];
    }
  }

  /** Get credentials, preferring local API with env-var fallback */
  private async getCreds(): Promise<FyersCreds[]> {
    const now = Date.now();
    if (this.cachedCreds && now - this.credsCachedAt < this.CREDS_TTL_MS) {
      return this.cachedCreds;
    }

    const fromApi = await this.fetchCredsFromApi();
    if (fromApi) {
      this.cachedCreds = fromApi;
      this.credsCachedAt = now;
      return fromApi;
    }

    // Fallback: use FYERS_USERS env var
    const fallback = this.loadFallbackUsers();
    this.addLog({ level: 'warning', action: 'LOAD_USERS', message: 'Local API /users unreachable — using FYERS_USERS env fallback' });
    return fallback;
  }

  private async findCreds(userId: string): Promise<FyersCreds | null> {
    const all = await this.getCreds();
    return all.find(u => u.id === userId) ?? null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getUserList(): Promise<{ id: string; displayName: string }[]> {
    const all = await this.getCreds();
    return all.map(({ id, displayName }) => ({ id, displayName }));
  }

  validatePin(userId: string, pin: string): { ok: boolean; locked?: boolean; attemptsLeft?: number } {
    const failure = this.pinFailures.get(userId);
    if (failure && failure.lockedUntil > Date.now()) return { ok: false, locked: true };

    const cfg = this.loadPinConfig();
    const entry = cfg.pins[userId];
    if (!entry) {
      // User exists in API but has no PIN configured — deny
      this.addLog({ level: 'warning', action: 'PIN_VALIDATE', message: `No PIN configured for user: ${userId}` });
      return { ok: false };
    }

    const hash = crypto.pbkdf2Sync(pin, entry.pinSalt, 100000, 64, 'sha512').toString('hex');
    if (hash === entry.pinHash) {
      this.pinFailures.delete(userId);
      this.addLog({ level: 'info', action: 'PIN_VALIDATE', message: `PIN validated — user: ${userId}` });
      return { ok: true };
    }

    const prev = failure ?? { count: 0, lockedUntil: 0 };
    const newCount = prev.count + 1;
    const lockedUntil = newCount >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
    this.pinFailures.set(userId, { count: newCount, lockedUntil });
    this.addLog({ level: 'warning', action: 'PIN_VALIDATE', message: `Invalid PIN (${newCount}/5) — user: ${userId}` });
    return { ok: false, attemptsLeft: Math.max(0, 5 - newCount) };
  }

  getAuthState(userId: string): UserAuthState {
    return this.authStates.get(userId) ?? { authenticated: false, authLocked: false };
  }

  resetAuth(userId: string): void {
    this.authStates.set(userId, { authenticated: false, authLocked: false });
    this.addLog({ level: 'info', action: 'RESET_AUTH', message: `Auth reset for user: ${userId}` });
  }

  async getAuthUrl(userId: string): Promise<{ auth_url: string }> {
    const creds = await this.findCreds(userId);
    if (!creds) throw new Error(`User "${userId}" not found — check local API or config`);

    this.addLog({
      level: 'info',
      action: 'GET_AUTH_URL',
      message: `Requesting auth URL — user: ${userId}, client_id: ${creds.clientId.slice(0, 6)}…`,
    });

    try {
      const res = await firstValueFrom(
        this.http.post<{ auth_url: string }>(`${LOCAL_API}/auth-url`, {
          user: userId,
          client_id: creds.clientId,
          secret_key: creds.secretKey,
          redirect_uri: creds.redirectUri,
        }),
      );
      this.addLog({ level: 'success', action: 'GET_AUTH_URL', message: 'Auth URL generated' });
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message;
      this.addLog({ level: 'error', action: 'GET_AUTH_URL', message: `Failed: ${msg}` });
      throw new Error(msg);
    }
  }

  async exchangeToken(userId: string, authCode: string): Promise<Record<string, unknown>> {
    const state = this.getAuthState(userId);
    if (state.authLocked) throw new Error('Auth locked — stop services before re-authenticating');

    this.addLog({
      level: 'info',
      action: 'EXCHANGE_TOKEN',
      message: `Exchanging token — user: ${userId}, code: …${authCode.slice(-4)}`,
    });

    try {
      const res = await firstValueFrom(
        this.http.post<Record<string, unknown>>(`${LOCAL_API}/token`, { user: userId, auth_code: authCode }),
      );
      if (res.data.accepted) {
        this.authStates.set(userId, { authenticated: true, authLocked: true });
        this.addLog({ level: 'success', action: 'EXCHANGE_TOKEN', message: String(res.data.message ?? 'Token accepted') });
      } else {
        this.addLog({ level: 'error', action: 'EXCHANGE_TOKEN', message: 'Token rejected by server' });
      }
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message;
      this.addLog({ level: 'error', action: 'EXCHANGE_TOKEN', message: `Failed: ${msg}` });
      throw new Error(msg);
    }
  }

  async startService(service: 1 | 2, option?: string): Promise<Record<string, unknown>> {
    const name = service === 1 ? 'Data' : 'Min';
    const body: Record<string, unknown> = { service };
    if (option) body.option = option;

    this.addLog({
      level: 'info',
      action: 'START_SERVICE',
      message: `Starting ${name}${option ? ` (option: ${option})` : ''}`,
    });

    try {
      const res = await firstValueFrom(this.http.post<Record<string, unknown>>(`${LOCAL_API}/start`, body));
      this.addLog({ level: 'success', action: 'START_SERVICE', message: `${name} started` });
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message;
      this.addLog({ level: 'error', action: 'START_SERVICE', message: `Failed to start ${name}: ${msg}` });
      throw new Error(msg);
    }
  }

  async stopServices(service: 1 | 2 | 3): Promise<Record<string, unknown>> {
    const name = service === 1 ? 'Data' : service === 2 ? 'Min' : 'All';
    this.addLog({ level: 'info', action: 'STOP_SERVICE', message: `Stopping ${name}` });

    try {
      const res = await firstValueFrom(this.http.post<Record<string, unknown>>(`${LOCAL_API}/stop`, { service }));
      if (service === 3) {
        for (const [uid, st] of this.authStates) {
          this.authStates.set(uid, { ...st, authLocked: false });
        }
      }
      this.addLog({ level: 'success', action: 'STOP_SERVICE', message: `${name} stopped` });
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message;
      this.addLog({ level: 'error', action: 'STOP_SERVICE', message: `Failed: ${msg}` });
      throw new Error(msg);
    }
  }

  async getHealth(): Promise<{ Data: boolean; Min: boolean }> {
    this.addLog({ level: 'info', action: 'HEALTH_CHECK', message: 'Polling health…' });
    try {
      const res = await firstValueFrom(this.http.get<{ Data: boolean; Min: boolean }>(`${LOCAL_API}/health`));
      this.addLog({ level: 'info', action: 'HEALTH_CHECK', message: `Data=${res.data.Data}  Min=${res.data.Min}` });
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message;
      this.addLog({ level: 'error', action: 'HEALTH_CHECK', message: `Health check failed: ${msg}` });
      throw new Error(msg);
    }
  }

  /** Force-refresh the credential cache from the local API */
  async refreshUsers(): Promise<{ count: number; source: 'api' | 'fallback' }> {
    this.cachedCreds = null;
    this.credsCachedAt = 0;
    const fromApi = await this.fetchCredsFromApi();
    if (fromApi) {
      this.cachedCreds = fromApi;
      this.credsCachedAt = Date.now();
      this.addLog({ level: 'success', action: 'REFRESH_USERS', message: `Fetched ${fromApi.length} users from local API` });
      return { count: fromApi.length, source: 'api' };
    }
    const fallback = this.loadFallbackUsers();
    this.addLog({ level: 'warning', action: 'REFRESH_USERS', message: 'Local API unreachable — using FYERS_USERS env fallback' });
    return { count: fallback.length, source: 'fallback' };
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  getLogs(): LogEntry[] { return [...this.logs]; }

  clearLogs(): void {
    this.logs = [];
    this.addLog({ level: 'info', action: 'CLEAR_LOGS', message: 'Terminal cleared' });
  }

  subscribeToLogs(cb: (e: LogEntry) => void): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private addLog(entry: Omit<LogEntry, 'timestamp'>): LogEntry {
    const log: LogEntry = { ...entry, timestamp: new Date().toISOString() };
    this.logs.push(log);
    if (this.logs.length > 1000) this.logs = this.logs.slice(-1000);
    this.logListeners.forEach(cb => cb(log));
    return log;
  }
}
