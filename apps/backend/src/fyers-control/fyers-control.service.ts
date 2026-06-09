import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Normalised credentials loaded from config.ini */
interface FyersCreds {
  id: string;
  displayName: string;
  clientId: string;
  secretKey: string;
  redirectUri: string;
}

/** One parsed section from config.ini */
interface IniSection {
  [key: string]: string;
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

const LOCAL_API          = 'http://100.93.172.21:6977';
const CONFIG_INI_DOCKER  = '/app/data/config.ini';
const CONFIG_INI_LOCAL   = path.join(process.cwd(), 'data', 'config.ini');

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FyersControlService {
  private readonly logger = new Logger(FyersControlService.name);

  private cachedCreds: FyersCreds[] | null = null;
  private credsCachedAt = 0;
  private readonly CREDS_TTL_MS = 5 * 60 * 1000;

  private readonly authStates  = new Map<string, UserAuthState>();
  private readonly pinFailures = new Map<string, { count: number; lockedUntil: number }>();
  private logs: LogEntry[] = [];
  private readonly logListeners = new Set<(e: LogEntry) => void>();

  constructor(private readonly http: HttpService) {}

  // ── INI parser ────────────────────────────────────────────────────────────

  private parseIni(): Record<string, IniSection> {
    const p = fs.existsSync(CONFIG_INI_DOCKER) ? CONFIG_INI_DOCKER : CONFIG_INI_LOCAL;
    let content: string;
    try {
      content = fs.readFileSync(p, 'utf-8');
    } catch (err) {
      this.logger.error(`Cannot read config.ini: ${err.message}`);
      return {};
    }

    const sections: Record<string, IniSection> = {};
    let cur = '';
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) continue;
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        cur = sectionMatch[1].trim();
        sections[cur] = {};
      } else if (cur) {
        const eq = line.indexOf('=');
        if (eq > 0) {
          sections[cur][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }
    }
    return sections;
  }

  /** Load all Fyers credentials directly from config.ini */
  private loadCredsFromIni(): FyersCreds[] {
    const sections = this.parseIni();
    const result: FyersCreds[] = [];
    for (const [sectionName, s] of Object.entries(sections)) {
      if (!s.client_id || !s.secret_key || !s.redirect_uri) continue;
      const id = s.user ?? sectionName;
      result.push({
        id,
        displayName: id.charAt(0).toUpperCase() + id.slice(1),
        clientId:    s.client_id,
        secretKey:   s.secret_key,
        redirectUri: s.redirect_uri,
      });
    }
    this.logger.log(`Loaded ${result.length} users from config.ini`);
    return result;
  }

  // ── Credential helpers ────────────────────────────────────────────────────

  private async getCreds(): Promise<FyersCreds[]> {
    const now = Date.now();
    if (this.cachedCreds && now - this.credsCachedAt < this.CREDS_TTL_MS) {
      return this.cachedCreds;
    }
    const creds = this.loadCredsFromIni();
    this.cachedCreds  = creds;
    this.credsCachedAt = now;
    return creds;
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

  async refreshUsers(): Promise<{ count: number; source: 'ini' }> {
    this.cachedCreds  = null;
    this.credsCachedAt = 0;
    const creds = this.loadCredsFromIni();
    this.cachedCreds  = creds;
    this.credsCachedAt = Date.now();
    this.addLog({ level: 'success', action: 'REFRESH_USERS', message: `Loaded ${creds.length} users from config.ini` });
    return { count: creds.length, source: 'ini' };
  }

  validatePin(userId: string, pin: string): { ok: boolean; locked?: boolean; attemptsLeft?: number } {
    const failure = this.pinFailures.get(userId);
    if (failure && failure.lockedUntil > Date.now()) return { ok: false, locked: true };

    const sections = this.parseIni();
    const s = sections[userId];
    if (!s?.pin_hash || !s?.pin_salt) {
      this.addLog({ level: 'warning', action: 'PIN_VALIDATE', message: `No PIN configured for user: ${userId}` });
      return { ok: false };
    }

    const hash = crypto.pbkdf2Sync(pin, s.pin_salt, 100000, 64, 'sha512').toString('hex');
    if (hash === s.pin_hash) {
      this.pinFailures.delete(userId);
      this.addLog({ level: 'info', action: 'PIN_VALIDATE', message: `PIN validated — user: ${userId}` });
      return { ok: true };
    }

    const prev     = failure ?? { count: 0, lockedUntil: 0 };
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
    if (!creds) throw new Error(`User "${userId}" not found in config.ini`);

    this.addLog({
      level: 'info',
      action: 'GET_AUTH_URL',
      message: `Requesting auth URL — user: ${userId}, client_id: ${creds.clientId.slice(0, 6)}…`,
    });

    try {
      const res = await firstValueFrom(
        this.http.post<{ auth_url: string }>(`${LOCAL_API}/auth-url`, {
          user:         userId,
          client_id:    creds.clientId,
          secret_key:   creds.secretKey,
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
