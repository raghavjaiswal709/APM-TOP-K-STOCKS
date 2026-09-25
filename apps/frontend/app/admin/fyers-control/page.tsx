'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppSidebar } from '@/app/components/app-sidebar';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ModeToggle } from '@/app/components/toggleButton';
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink,
  KeyRound, Loader2, Lock, LogOut, Play, Power, RefreshCw,
  Shield, Square, Terminal, Trash2, XCircle, Zap, Activity,
  User, Database, Clock, ChevronRight, KeySquare, Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FyersUser   { id: string; displayName: string }
interface HealthState { Data: boolean; Min: boolean }

/** One service as reported by the controller, including who started it. */
interface ServiceState {
  running: boolean;
  startedBy: string | null;
  startedAt: string | null;
  lastStoppedBy: string | null;
  lastStoppedAt: string | null;
  option?: string | null;
  stopsAt?: string | null;
}

interface PipelineStatus {
  reachable: boolean;
  data: ServiceState;
  min: ServiceState;
  currentSessionUser: string | null;
  usersLoggedInToday: string[];
  validate?: { ran?: boolean; success?: boolean | null; by?: string | null; at?: string | null } | null;
  error?: string;
}

/** A refused start — someone else already owns the service. */
interface StartConflict {
  conflict: true;
  service?: string;
  startedBy: string | null;
  startedAt: string | null;
  message?: string;
}
interface LogEntry    { timestamp: string; level: 'info'|'success'|'error'|'warning'; action: string; message: string }
interface ApiError    extends Error { data?: Record<string, unknown> }

type Step = 'user-select' | 'auth' | 'service';
type DataOption = 'A' | 'B' | 'C';
type ServiceMode = 'both' | 'data' | 'min';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}
function isPreMarket(): boolean {
  const d = nowIST();
  return d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() < 15);
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res  = await fetch(url, opts);
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err: ApiError = new Error(
      (body?.error as string) ?? (body?.message as string) ?? `HTTP ${res.status}`,
    );
    err.data = body;
    throw err;
  }
  return body as T;
}

function logColor(l: LogEntry['level']) {
  return ({ info: 'text-blue-400', success: 'text-emerald-400', error: 'text-red-400', warning: 'text-amber-400' })[l];
}
function logBg(l: LogEntry['level']) {
  return ({ info: 'bg-blue-500/10', success: 'bg-emerald-500/10', error: 'bg-red-500/10', warning: 'bg-amber-500/10' })[l];
}
function logPrefix(l: LogEntry['level']) {
  return ({ info: 'ℹ', success: '✓', error: '✗', warning: '⚠' })[l];
}

function parseAuthCode(raw: string): string {
  try { return new URL(raw.trim()).searchParams.get('auth_code') ?? raw.trim(); }
  catch { return raw.trim(); }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
}

/**
 * The controller emits local wall-clock strings; Date parses it safely for India Time.
 */
function fmtStamp(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0
      ${ok ? `bg-emerald-400 shadow-[0_0_8px_#34d399] ${pulse ? 'animate-pulse' : ''}` : 'bg-zinc-600'}`}
    />
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}>
      {done ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </Button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">{children}</p>;
}

// ─── PinInput ─────────────────────────────────────────────────────────────────

function PinInput({
  value, onChange, onEnter, disabled, error, label, autoFocus: af = false,
}: {
  value: string; onChange: (v: string) => void; onEnter?: () => void;
  disabled?: boolean; error?: string; label: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full border-2 transition-all
              ${i < value.length ? 'bg-primary border-primary scale-110' : 'bg-transparent border-muted-foreground/30'}`}
            />
          ))}
        </div>
        <input
          type="password" inputMode="numeric" maxLength={4}
          autoFocus={af}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          disabled={disabled}
          placeholder="••••"
          className={`w-24 text-center text-xl tracking-[0.5em] bg-background border rounded-lg px-2 py-1.5
            outline-none focus:ring-2 focus:ring-primary/40 transition-all
            ${error ? 'border-red-500' : 'border-border'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><XCircle size={11} />{error}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FyersControlPage() {

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users,         setUsers]         = useState<FyersUser[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(true);
  const [usersSource,   setUsersSource]   = useState<'api'|'fallback'|'ini'|null>(null);
  const [refreshing,    setRefreshing]    = useState(false);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [step,         setStep]         = useState<Step>('user-select');
  const [activeUser,   setActiveUser]   = useState<FyersUser | null>(null);

  // ── PIN unlock ────────────────────────────────────────────────────────────
  const [pin,          setPin]          = useState('');
  const [pinLoading,   setPinLoading]   = useState(false);
  const [pinError,     setPinError]     = useState('');
  const [pinLocked,    setPinLocked]    = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // ── Fyers auth ────────────────────────────────────────────────────────────
  const [authUrl,       setAuthUrl]      = useState('');
  const [urlLoading,    setUrlLoading]   = useState(false);
  const [authCode,      setAuthCode]     = useState('');
  const [codeSource,    setCodeSource]   = useState<'auto'|'manual'|null>(null);
  const [tokenLoading,  setTokenLoading] = useState(false);
  const [tokenMsg,      setTokenMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [authLocked,    setAuthLocked]   = useState(false);
  const [lockedAt,      setLockedAt]     = useState<string | null>(null);
  const [resetTokConfirm, setResetTokConfirm] = useState(false);
  const [resetTokLoading, setResetTokLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // ── Services ──────────────────────────────────────────────────────────────
  const [health,        setHealth]       = useState<HealthState | null>(null);
  const [status,        setStatus]       = useState<PipelineStatus | null>(null);
  const [conflict,      setConflict]     = useState<StartConflict | null>(null);
  const [healthLoading, setHealthLoading]= useState(false);
  const [startLoading,  setStartLoading] = useState(false);
  const [stopLoading,   setStopLoading]  = useState(false);
  const [stopOneLoading,setStopOneLoading] = useState<1 | 2 | null>(null);
  const [stopConfirm,   setStopConfirm]  = useState(false);
  const [lastStarted,   setLastStarted]  = useState<string | null>(null);
  
  // Service selection states:
  const [startOption,   setStartOption]  = useState<DataOption>('C');
  const [startingState, setStartingState]= useState<string | null>(null);

  // ── Logs ──────────────────────────────────────────────────────────────────
  const [logs,          setLogs]         = useState<LogEntry[]>([]);
  const [clearingLogs,  setClearingLogs] = useState(false);
  const [sseStatus,     setSseStatus]    = useState<'connecting'|'live'|'error'>('connecting');
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const esRef        = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset PIN dialog ──────────────────────────────────────────────────────
  const [resetOpen,       setResetOpen]       = useState(false);
  const [resetUser,       setResetUser]       = useState<FyersUser | null>(null);
  const [resetCurPin,     setResetCurPin]     = useState('');
  const [resetNewPin,     setResetNewPin]     = useState('');
  const [resetConfPin,    setResetConfPin]    = useState('');
  const [resetLoading,    setResetLoading]    = useState(false);
  const [resetError,      setResetError]      = useState('');
  const [resetSuccess,    setResetSuccess]    = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // Computed Status Flags (derived from status and health)
  // ═══════════════════════════════════════════════════════════════════════════

  const dataOk = status?.data.running ?? health?.Data ?? false;
  const minOk  = status?.min.running  ?? health?.Min  ?? false;
  const anyUp  = dataOk || minOk;
  const bothUp = dataOk && minOk;
  const pre    = isPreMarket();

  // ═══════════════════════════════════════════════════════════════════════════
  // Effects & Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const addLocalLog = useCallback((entry: Omit<LogEntry, 'timestamp'>) => {
    setLogs(p => [...p, { ...entry, timestamp: new Date().toISOString() }].slice(-600));
  }, []);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true); else setUsersLoading(true);
    try {
      if (forceRefresh) {
        const r = await apiFetch<{ count: number; source: 'api'|'fallback'|'ini' }>(
          '/api/fyers-control/users/refresh', { method: 'POST' },
        );
        setUsersSource(r.source);
      }
      const d = await apiFetch<{ users: FyersUser[] }>('/api/fyers-control/users');
      setUsers(d.users ?? []);
    } catch { /* backend not running */ }
    finally { setUsersLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // SSE log stream
  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource('/api/fyers-control/logs/stream');
    esRef.current = es;
    es.onopen    = () => setSseStatus('live');
    es.onmessage = (e) => {
      try { const entry: LogEntry = JSON.parse(e.data); setLogs(prev => [...prev, entry].slice(-600)); }
      catch { /* ignore */ }
    };
    es.onerror = () => {
      setSseStatus('error'); es.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connectSSE, 4000);
    };
  }, []);

  useEffect(() => {
    connectSSE();
    return () => { esRef.current?.close(); if (reconnectRef.current) clearTimeout(reconnectRef.current); };
  }, [connectSSE]);

  // Auto-scroll ONLY the terminal box without shifting outer page window
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Capture auth_code from current page URL (if redirect lands here directly)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('auth_code');
    if (code) {
      setAuthCode(code); setCodeSource('auto');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listen for auth_code postMessage from the Fyers login popup
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const trusted = ['https://raghavjaiswal709.github.io', 'https://daksphere.com'];
      if (!trusted.some(o => e.origin === o || e.origin.startsWith(o + '/'))) return;

      const data = e.data as Record<string, unknown> | null;
      if (!data) return;
      const code = data.auth_code as string | undefined;
      if (code && code.length > 10) {
        setAuthCode(code);
        setCodeSource('auto');
        try { popupRef.current?.close(); } catch { /* ignore */ }
        addLocalLog({ level: 'success', action: 'AUTH_CODE', message: `Auth code auto-captured from redirect (…${code.slice(-6)})` });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [addLocalLog]);

  // Health polling — quiet background polling prevents UI flicker / scroll jumps
  const pollHealth = useCallback(async (isManual = false) => {
    if (isManual) setHealthLoading(true);
    try {
      const st = await apiFetch<PipelineStatus>('/api/fyers-control/status');
      setStatus(st);
      setHealth({ Data: st.data.running, Min: st.min.running });
    } catch {
      setStatus(null);
      setHealth(null);
    } finally {
      if (isManual) setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    pollHealth(false);
    const id = setInterval(() => pollHealth(false), 8000);
    return () => clearInterval(id);
  }, [pollHealth]);

  function pickUser(u: FyersUser) {
    setActiveUser(u);
    setPin(''); setPinError(''); setPinLocked(false); setAttemptsLeft(5);
  }

  async function handleValidatePin() {
    if (!activeUser || pin.length !== 4) return;
    setPinLoading(true); setPinError('');
    try {
      await apiFetch('/api/fyers-control/validate-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id, pin }),
      });
      const state = await apiFetch<{ authenticated: boolean; authLocked: boolean; lockedAt?: string | null }>(
        `/api/fyers-control/auth-state/${activeUser.id}`,
      );
      setAuthLocked(state.authLocked);
      setLockedAt(state.lockedAt ?? null);
      setStep(state.authLocked ? 'service' : 'auth');
    } catch (err: unknown) {
      const e = err as ApiError;
      const body = e.data ?? {};
      if (body.locked) { setPinLocked(true); setPinError('Too many attempts — locked for 5 minutes.'); }
      else if (typeof body.attemptsLeft === 'number') {
        setAttemptsLeft(body.attemptsLeft as number);
        setPinError(`Incorrect PIN — ${body.attemptsLeft} attempt${body.attemptsLeft !== 1 ? 's' : ''} remaining.`);
      } else { setPinError(e.message ?? 'Invalid PIN.'); }
    } finally { setPinLoading(false); }
  }

  async function handleGenerateUrl() {
    if (!activeUser) return;
    setUrlLoading(true); setAuthUrl('');
    try {
      const d = await apiFetch<{ auth_url: string }>('/api/fyers-control/auth-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id }),
      });
      setAuthUrl(d.auth_url);
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'GET_AUTH_URL', message: (e as ApiError).message ?? 'Failed' });
    } finally { setUrlLoading(false); }
  }

  function openAuthPopup() {
    if (!authUrl) return;
    try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { /* ignore */ }
    const w = 560, h = 680;
    const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    popupRef.current = window.open(
      authUrl, 'fyers_auth',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
  }

  async function handleAuthenticate() {
    if (!activeUser || !authCode.trim()) return;
    setTokenLoading(true); setTokenMsg(null);
    try {
      const d = await apiFetch<{ accepted: boolean; message: string }>(
        '/api/fyers-control/token',
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUser.id, authCode: parseAuthCode(authCode) }) },
      );
      setTokenMsg({ ok: d.accepted, text: d.message ?? (d.accepted ? 'Token accepted' : 'Token rejected') });
      if (d.accepted) { setAuthLocked(true); setLockedAt(new Date().toISOString()); setStep('service'); }
    } catch (e: unknown) {
      setTokenMsg({ ok: false, text: (e as ApiError).message ?? 'Token exchange failed' });
    } finally { setTokenLoading(false); }
  }

  /**
   * Start Services according to mode:
   * 'both' -> Data (1) then Min (2)
   * 'data' -> Data (1) only
   * 'min'  -> Min (2) only
   */
  async function handleStartServices(modeToStart: ServiceMode) {
    setStartLoading(true);
    setConflict(null);
    const preMode = isPreMarket() ? 'pre-9:15' : 'post-9:15';

    try {
      if (modeToStart === 'both' || modeToStart === 'data') {
        setStartingState('Starting Data Service...');
        const dataRes = await apiFetch<Record<string, unknown>>('/api/fyers-control/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 1, option: startOption }),
        });
        if (dataRes.conflict) {
          setConflict(dataRes as unknown as StartConflict);
          addLocalLog({
            level: 'warning', action: 'START',
            message: `Data already running — started by ${(dataRes.startedBy as string) ?? 'unknown'}`,
          });
        } else {
          addLocalLog({ level: 'success', action: 'START', message: `Data service started (${preMode}, option ${startOption})` });
        }
      }

      if (modeToStart === 'both' || modeToStart === 'min') {
        setStartingState('Starting Min Service...');
        const minRes = await apiFetch<Record<string, unknown>>('/api/fyers-control/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 2 }),
        });
        if (minRes.conflict) {
          setConflict(minRes as unknown as StartConflict);
          addLocalLog({
            level: 'warning', action: 'START',
            message: `Min already running — started by ${(minRes.startedBy as string) ?? 'unknown'}`,
          });
        } else {
          addLocalLog({ level: 'success', action: 'START', message: `Min service started (${preMode})` });
        }
      }

      setLastStarted(new Date().toISOString());
      await pollHealth(false);
      // The controller can take a moment to mark a freshly-started process as
      // running — one follow-up poll a few seconds later stops the status
      // boxes getting stuck on "Offline" for a service that did start.
      setTimeout(() => pollHealth(false), 3000);
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'START', message: (e as ApiError).message ?? 'Start failed' });
    } finally {
      setStartLoading(false);
      setStartingState(null);
    }
  }

  async function handleStopServices() {
    setStopLoading(true); setStopConfirm(false); setConflict(null);
    try {
      await apiFetch('/api/fyers-control/stop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 3 }),
      });
      setAuthLocked(false); setLastStarted(null);
      addLocalLog({ level: 'success', action: 'STOP', message: 'Both services stopped (service: 3)' });
      await pollHealth(false);
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'STOP', message: (e as ApiError).message ?? 'Stop failed' });
    } finally { setStopLoading(false); }
  }

  async function handleStopOne(service: 1 | 2) {
    const name = service === 1 ? 'Data' : 'Min';
    setStopOneLoading(service); setConflict(null);
    try {
      await apiFetch('/api/fyers-control/stop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      });
      addLocalLog({ level: 'success', action: 'STOP', message: `${name} stopped (service: ${service})` });
      await pollHealth(false);
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'STOP', message: (e as ApiError).message ?? `Failed to stop ${name}` });
    } finally { setStopOneLoading(null); }
  }

  async function handleResetToken() {
    if (!activeUser) return;
    setResetTokLoading(true);
    try {
      const r = await apiFetch<{ deleted: string[]; dir: string | null }>(
        `/api/fyers-control/auth-state/${activeUser.id}`, { method: 'DELETE' },
      );
      setAuthLocked(false); setLockedAt(null);
      setAuthUrl(''); setAuthCode(''); setCodeSource(null); setTokenMsg(null);
      setStep('auth');
      addLocalLog({
        level: 'success', action: 'RESET_TOKEN',
        message: r.deleted.length
          ? `Token reset — deleted ${r.deleted.join(', ')}. Generate a new login URL to continue.`
          : 'Auth lock cleared — no token files found. Generate a new login URL to continue.',
      });
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'RESET_TOKEN', message: (e as ApiError).message ?? 'Token reset failed' });
    } finally { setResetTokLoading(false); setResetTokConfirm(false); }
  }

  async function handleClearLogs() {
    setClearingLogs(true);
    try { await apiFetch('/api/fyers-control/logs', { method: 'DELETE' }); setLogs([]); }
    catch { /* ignore */ }
    finally { setClearingLogs(false); }
  }

  async function handleSignOut() {
    const user = activeUser;
    const servicesLive = (health?.Data ?? false) || (health?.Min ?? false);
    if (user) {
      if (!servicesLive) {
        try {
          await apiFetch(`/api/fyers-control/auth-state/${user.id}`, { method: 'POST' });
          addLocalLog({ level: 'info', action: 'SIGN_OUT', message: `Signed out ${user.displayName} — auth lock released` });
        } catch (e: unknown) {
          addLocalLog({ level: 'warning', action: 'SIGN_OUT', message: `Signed out locally — could not clear server auth state: ${(e as ApiError).message ?? 'unknown error'}` });
        }
      } else {
        addLocalLog({ level: 'info', action: 'SIGN_OUT', message: `Signed out ${user.displayName} locally — token stays active while services are running` });
      }
    }
    setStep('user-select'); setActiveUser(null);
    setPin(''); setPinError(''); setPinLocked(false); setAttemptsLeft(5);
    setAuthUrl(''); setAuthCode(''); setCodeSource(null);
    setTokenMsg(null); setAuthLocked(false); setLockedAt(null); setResetTokConfirm(false);
    setStopConfirm(false); setLastStarted(null); setConflict(null);
  }

  function openResetPin(u: FyersUser) {
    setResetUser(u);
    setResetCurPin(''); setResetNewPin(''); setResetConfPin('');
    setResetError(''); setResetSuccess(false);
    setResetOpen(true);
  }

  async function handleResetPin() {
    if (!resetUser) return;
    if (resetNewPin !== resetConfPin) { setResetError('New PINs do not match.'); return; }
    if (resetNewPin.length !== 4)     { setResetError('New PIN must be 4 digits.'); return; }
    setResetLoading(true); setResetError('');
    try {
      await apiFetch('/api/fyers-control/reset-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUser.id, currentPin: resetCurPin, newPin: resetNewPin }),
      });
      setResetSuccess(true);
      setTimeout(() => setResetOpen(false), 1500);
    } catch (e: unknown) {
      setResetError((e as ApiError).message ?? 'Reset failed');
    } finally { setResetLoading(false); }
  }

  const isUserDone = step === 'auth' || step === 'service';
  const isAuthActive = step === 'auth' || step === 'service';
  // If services are running on the server, we allow direct access to Card 3 controls
  const isServiceActive = step === 'service' || anyUp;
  
  const parsedCode = authCode.trim() ? parseAuthCode(authCode) : '';
  const codeValid  = parsedCode.length >= 10;
  const lastLog    = logs[logs.length - 1];

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 shrink-0">{label}</span>
      <span className="text-[11px] font-mono text-foreground/80 truncate text-right">{value}</span>
    </div>
  );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="/admin">Admin</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Fyers Control</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs bg-muted/40 border rounded-lg px-3 py-1.5 mr-2">
              <span className="flex items-center gap-1.5">
                <StatusDot ok={dataOk} pulse={dataOk} />
                <span className={dataOk ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                  Data {dataOk ? (status?.data.option ? `(Opt ${status.data.option})` : 'ON') : 'OFF'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <StatusDot ok={minOk} pulse={minOk} />
                <span className={minOk ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                  Min {minOk ? 'ON' : 'OFF'}
                </span>
              </span>
            </div>
            {activeUser && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={handleSignOut}>
                <LogOut size={12} /> Sign out
              </Button>
            )}
            <ModeToggle />
          </div>
        </header>

        {/* Main Scrollable Body */}
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-y-auto">
          <div className="w-full space-y-4">

            {/* Title Header */}
            <div>
              <h1 className="text-base font-semibold flex items-center gap-2">
                <Shield size={16} className="text-primary" /> Fyers Control Panel
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Manage automated live data ingestion, minute aggregators, user credentials, and operational controls.
              </p>
            </div>

            {/* ── 1. Live Pipeline Status (Shared desk view with 1-click Stop Controls) ─ */}
            <Card>
              <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">Live Pipeline Status</CardTitle>
                    {status?.reachable && (
                      <Badge variant="outline" className={`text-[10px] font-semibold ${
                        bothUp ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
                        dataOk ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                        minOk  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                        'bg-zinc-500/15 text-muted-foreground border-border'
                      }`}>
                        {bothUp ? '🟢 Both Services Active (Data + Min)' :
                         dataOk ? `🟢 Data Service Active (${status.data.option ? `Option ${status.data.option}` : 'Running'})` :
                         minOk  ? '🟢 Min Service Active (Running)' :
                         '⚪ All Services Stopped'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-[11px]">
                    Real-time status, visible to everyone. Start and stop from the Services Control panel below.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pollHealth(true)} disabled={healthLoading}>
                    {healthLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {status && !status.reachable && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-red-400">Controller Unreachable</p>
                      <p className="text-[10px] text-muted-foreground break-words">{status.error}</p>
                    </div>
                  </div>
                )}

                {conflict && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-amber-400">Already running — not started again</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {conflict.service ?? 'The service'} was started by{' '}
                        <strong className="font-mono text-foreground/80">{conflict.startedBy ?? 'someone else'}</strong>
                        {conflict.startedAt ? ` at ${fmtStamp(conflict.startedAt)}` : ''}. Stop it before starting a new run.
                      </p>
                    </div>
                    <button onClick={() => setConflict(null)} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                      Dismiss
                    </button>
                  </div>
                )}

                {!status ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Loading pipeline status…</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Data Service Info Box */}
                      <div className={`flex flex-col gap-2 rounded-lg border px-4 py-3 transition-all ${
                        status.data.running
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'border-border bg-muted/20'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusDot ok={status.data.running} pulse={status.data.running} />
                            <span className={`text-sm font-semibold ${status.data.running ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                              Data Service
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${
                            status.data.running
                              ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
                              : 'bg-zinc-500/10 text-muted-foreground border-border'
                          }`}>
                            {status.data.running ? (status.data.option ? `RUNNING (Opt ${status.data.option})` : 'RUNNING') : 'STOPPED'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">NSE tick ingestion &amp; WebSocket broadcaster</p>
                        <div className="flex flex-col gap-1 border-t pt-2">
                          {status.data.running ? (
                            <>
                              <Row label="Started by" value={status.data.startedBy ?? 'unknown'} />
                              <Row label="Started at" value={fmtStamp(status.data.startedAt)} />
                              {status.data.option && <Row label="Data Option" value={`Option ${status.data.option}`} />}
                              {status.data.stopsAt && <Row label="Stops at" value={`${status.data.stopsAt} IST`} />}
                            </>
                          ) : (
                            <>
                              <Row label="Last stopped by" value={status.data.lastStoppedBy ?? '—'} />
                              <Row label="Last stopped at" value={fmtStamp(status.data.lastStoppedAt)} />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Min Service Info Box */}
                      <div className={`flex flex-col gap-2 rounded-lg border px-4 py-3 transition-all ${
                        status.min.running
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'border-border bg-muted/20'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusDot ok={status.min.running} pulse={status.min.running} />
                            <span className={`text-sm font-semibold ${status.min.running ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                              Min Service
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${
                            status.min.running
                              ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
                              : 'bg-zinc-500/10 text-muted-foreground border-border'
                          }`}>
                            {status.min.running ? 'RUNNING' : 'STOPPED'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">Minute-bar candle aggregator &amp; disk flusher</p>
                        <div className="flex flex-col gap-1 border-t pt-2">
                          {status.min.running ? (
                            <>
                              <Row label="Started by" value={status.min.startedBy ?? 'unknown'} />
                              <Row label="Started at" value={fmtStamp(status.min.startedAt)} />
                              {status.min.stopsAt && <Row label="Stops at" value={`${status.min.stopsAt} IST`} />}
                            </>
                          ) : (
                            <>
                              <Row label="Last stopped by" value={status.min.lastStoppedBy ?? '—'} />
                              <Row label="Last stopped at" value={fmtStamp(status.min.lastStoppedAt)} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="grid gap-2 sm:grid-cols-2 rounded-lg border bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <User size={12} className="shrink-0 opacity-50" /> Active Token Session
                        <span className="ml-auto font-mono text-foreground/80 truncate font-medium">
                          {status.currentSessionUser ?? 'none'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Activity size={12} className="shrink-0 opacity-50" /> Logged In Today
                        <span className="ml-auto font-mono text-foreground/80 truncate font-medium">
                          {status.usersLoggedInToday.length ? status.usersLoggedInToday.join(', ') : 'nobody yet'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── 2. Wizard Step Navigation Bar ────────────────────────────── */}
            <div className="flex items-center mb-5">
              {[
                { key: 'user-select' as Step, label: 'User & PIN',  icon: <User size={11} /> },
                { key: 'auth'        as Step, label: 'Fyers Auth',  icon: <Zap size={11} /> },
                { key: 'service'     as Step, label: 'Services',    icon: <Database size={11} /> },
              ].map((s, i, arr) => {
                const stepIdx = arr.findIndex(x => x.key === step);
                const active = step === s.key;
                const done   = stepIdx > i;
                return (
                  <React.Fragment key={s.key}>
                    {i > 0 && <div className={`h-px flex-1 transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-border'}`} />}
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all
                      ${active ? 'bg-primary text-primary-foreground shadow-md' : done ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                      {done ? <CheckCircle2 size={11} /> : s.icon}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── 3. Action Cards (3 columns) ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* CARD 1: User & PIN */}
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <User size={15} className="text-primary" /> User &amp; PIN
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {isUserDone && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]"><CheckCircle2 size={9} className="mr-1" />Unlocked</Badge>}
                      {usersSource && (
                        <Badge variant={usersSource === 'ini' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {usersSource === 'ini' ? 'Config' : usersSource === 'api' ? 'Live API' : 'Fallback'}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => loadUsers(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {isUserDone ? `Signed in as ${activeUser?.displayName} — PIN verified` : 'Choose an account then enter your 4-digit PIN'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Account selection chips */}
                  <div>
                    <SectionLabel>Account</SectionLabel>
                    {usersLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Loading…</div>
                    ) : users.length === 0 ? (
                      <p className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <AlertCircle size={12} /> No users — check config.ini mount &amp; container.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {users.map(u => (
                          <button key={u.id} onClick={() => !isUserDone && pickUser(u)} disabled={isUserDone}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                              ${activeUser?.id === u.id
                                ? isUserDone ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-primary bg-primary/10 text-primary'
                                : isUserDone ? 'border-border text-muted-foreground/40 cursor-default' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}`}>
                            {u.displayName}
                            {isUserDone && activeUser?.id === u.id && <CheckCircle2 size={10} className="inline ml-1" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PIN entry */}
                  {!isUserDone && activeUser && (
                    <div className="space-y-3">
                      <PinInput
                        label={`4-Digit PIN for ${activeUser.displayName}`}
                        value={pin} onChange={v => { setPin(v); setPinError(''); }}
                        onEnter={() => pin.length === 4 && handleValidatePin()}
                        disabled={pinLocked} error={pinError} autoFocus
                      />
                      {pinLocked && <p className="text-xs text-amber-400 flex items-center gap-1"><Lock size={11} /> Locked — try again in 5 minutes.</p>}
                      <Button onClick={handleValidatePin} disabled={pin.length !== 4 || pinLoading || pinLocked} className="gap-1.5 w-full">
                        {pinLoading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                        Unlock Account
                      </Button>
                    </div>
                  )}

                  {!isUserDone && !activeUser && !usersLoading && users.length > 0 && (
                    <p className="text-xs text-muted-foreground/60 italic flex items-center gap-1.5">
                      <ChevronRight size={11} /> Select an account above to continue
                    </p>
                  )}

                  {isUserDone && activeUser && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <CheckCircle2 size={12} /> Authenticated as <strong>{activeUser.displayName}</strong>
                    </p>
                  )}

                  {/* Reset PIN link */}
                  {users.length > 0 && (
                    <div className="pt-2 border-t">
                      <button
                        onClick={() => {
                          const target = activeUser ?? (users.length === 1 ? users[0] : null);
                          if (target) openResetPin(target);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                      >
                        <KeySquare size={11} />
                        {activeUser ? `Reset PIN for ${activeUser.displayName}` : 'Reset PIN…'}
                      </button>
                      {!activeUser && users.length > 1 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {users.map(u => (
                            <button key={u.id} onClick={() => openResetPin(u)}
                              className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors">
                              {u.displayName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CARD 2: Fyers Auth */}
              <div className={`transition-opacity duration-300 ${!isAuthActive ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Zap size={15} className="text-yellow-400" /> Fyers Auth
                      </CardTitle>
                      {authLocked && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]"><Lock size={9} className="mr-1" />Token Active</Badge>}
                    </div>
                    <CardDescription className="text-xs">
                      {!isAuthActive ? 'Complete User & PIN first'
                        : authLocked ? `${activeUser?.displayName} authenticated — token active`
                        : `Authenticate ${activeUser?.displayName ?? 'user'} with Fyers API`}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4">
                    {authLocked ? (
                      <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-3">
                        <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-emerald-400">Auth lock active</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Token written to service paths. Services can now be started.</p>
                          {lockedAt && (
                            <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                              <Clock size={10} /> Issued {fmtStamp(lockedAt)} · valid until 23:59 IST
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* A — Generate URL */}
                        <div className="space-y-2">
                          <SectionLabel>A — Generate Login URL</SectionLabel>
                          <Button variant="outline" size="sm" onClick={handleGenerateUrl} disabled={urlLoading || !isAuthActive} className="gap-1.5 h-8">
                            {urlLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Generate URL
                          </Button>

                          {authUrl && (
                            <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <code className="flex-1 min-w-0 text-[10px] font-mono text-muted-foreground truncate select-all">
                                  {authUrl}
                                </code>
                                <CopyBtn text={authUrl} />
                              </div>

                              <div className="flex gap-2">
                                <Button size="sm" onClick={openAuthPopup} className="gap-1.5 h-7 flex-1 text-xs">
                                  <ExternalLink size={11} /> Open Popup
                                </Button>
                                <a href={authUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                                  <Button variant="outline" size="sm" className="gap-1.5 h-7 w-full text-xs">
                                    <ExternalLink size={11} /> Open Tab
                                  </Button>
                                </a>
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 leading-snug">
                                After login, copy the full redirect URL containing <span className="font-mono bg-muted px-0.5 rounded">?auth_code=…</span> and paste in field B.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* B — Auth code */}
                        <div className="space-y-1.5">
                          <SectionLabel>B — Auth Code</SectionLabel>
                          {codeSource === 'auto' && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                              <CheckCircle2 size={10} />
                              <span>Auto-captured from redirect</span>
                              <Badge className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-300 border-0 px-1">AUTO</Badge>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text" value={authCode} disabled={!isAuthActive}
                              onChange={e => { setAuthCode(e.target.value); setCodeSource('manual'); }}
                              placeholder="Paste auth_code or full redirect URL…"
                              className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-xs
                                font-mono outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
                            />
                            {authCode && <CopyBtn text={authCode} />}
                          </div>
                          {authCode && (
                            <p className={`text-[10px] flex items-center gap-1 ${codeValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {codeValid ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
                              {codeValid ? `Valid code (${parsedCode.length} chars)` : 'Too short — paste the full redirect URL'}
                            </p>
                          )}
                        </div>

                        {/* C — Exchange */}
                        <div>
                          <SectionLabel>C — Exchange Token</SectionLabel>
                          <Button onClick={handleAuthenticate} disabled={!codeValid || tokenLoading || !isAuthActive} className="gap-1.5 h-8 w-full">
                            {tokenLoading ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                            Authenticate &amp; Unlock Services
                          </Button>
                          {tokenMsg && (
                            <div className={`mt-2 flex items-start gap-2 text-xs rounded-lg px-3 py-2 border
                              ${tokenMsg.ok ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                              {tokenMsg.ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <XCircle size={12} className="mt-0.5 shrink-0" />}
                              {tokenMsg.text}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Reset token — clears the lock and deletes token files */}
                    {isAuthActive && (
                      <div className="pt-3 border-t border-border/50">
                        {!resetTokConfirm ? (
                          <Button variant="outline" size="sm" onClick={() => setResetTokConfirm(true)}
                            className="gap-1.5 h-8 w-full text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300">
                            <Trash2 size={12} /> Reset Token
                          </Button>
                        ) : (
                          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2.5">
                            <p className="text-xs text-red-300 flex items-start gap-1.5">
                              <AlertCircle size={12} className="mt-0.5 shrink-0" />
                              <span>
                                Delete the saved token for {activeUser?.displayName} and start fresh?
                                {anyUp && ' Services are running — they keep using the old token until stopped.'}
                              </span>
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={handleResetToken} disabled={resetTokLoading} className="gap-1.5 h-7 flex-1 text-xs">
                                {resetTokLoading ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Delete Token
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setResetTokConfirm(false)} disabled={resetTokLoading} className="h-7 flex-1 text-xs">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* CARD 3: Service Control Panel (Interactive dropdown & switches) */}
              <div className={`transition-opacity duration-300 ${!isServiceActive ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Power size={15} className="text-violet-400" /> Services Control
                      </CardTitle>
                      <Badge variant="outline"
                        className={`text-[10px] font-semibold ${
                          bothUp ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
                          dataOk ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                          minOk  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                          'text-muted-foreground'
                        }`}>
                        {bothUp ? '🟢 Both Active (Data + Min)' :
                         dataOk ? `🟢 Data Only (${status?.data.option ? `Opt ${status.data.option}` : 'Active'})` :
                         minOk  ? '🟢 Min Only (Active)' :
                         '⚪ All Stopped'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {!isServiceActive ? 'Complete auth or start a service' : pre ? 'Pre-9:15 IST (Pre-market mode)' : 'Market Open Session'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3">
                    {/* Live Health Status Display */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <SectionLabel>Active Service Health</SectionLabel>
                        <Button variant="ghost" size="icon" className="h-5 w-5 -mt-1" onClick={() => pollHealth(true)} disabled={healthLoading || !isServiceActive}>
                          {healthLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Data Box */}
                        <div className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 transition-all ${
                          dataOk
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : 'border-border bg-muted/20'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <StatusDot ok={dataOk} pulse={dataOk} />
                              <span className={`text-xs font-semibold ${dataOk ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                                Data
                              </span>
                            </div>
                            {dataOk && status?.data.option && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-semibold">
                                Opt {status.data.option}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground/70 ml-4">
                            {dataOk ? 'Ingestion Active' : 'Offline'}
                          </span>
                        </div>

                        {/* Min Box */}
                        <div className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 transition-all ${
                          minOk
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : 'border-border bg-muted/20'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <StatusDot ok={minOk} pulse={minOk} />
                              <span className={`text-xs font-semibold ${minOk ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                                Min
                              </span>
                            </div>
                            {minOk && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-semibold">
                                {status?.min.stopsAt ?? '15:45'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground/70 ml-4">
                            {minOk ? 'Aggregating 1m' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata summary */}
                    {lastStarted && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Clock size={9} /> Last action: {fmtTime(lastStarted)}
                      </p>
                    )}
                    {isServiceActive && activeUser && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/20 border rounded-lg px-2.5 py-1.5">
                        <User size={9} /> Operator: <span className="font-medium text-foreground ml-0.5">{activeUser.displayName}</span>
                        <span className="ml-auto font-mono opacity-50">{activeUser.id}</span>
                      </div>
                    )}

                    {/* Interactive Service Controls — every control lives here, and only
                        here, so there's a single source of truth for on/off state. */}
                    {isServiceActive && (
                      <div className="space-y-3 pt-1">

                        {/* Data Feed Option — locked while Data is running since a change
                            only takes effect on the next start. */}
                        <div className="flex items-center justify-between gap-2 border rounded-lg p-2.5 bg-muted/10">
                          <SectionLabel>Data Feed Option</SectionLabel>
                          <Select value={startOption} onValueChange={v => setStartOption(v as DataOption)} disabled={dataOk || startLoading}>
                            <SelectTrigger className="h-7 w-28 text-xs font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">Option A</SelectItem>
                              <SelectItem value="B">Option B</SelectItem>
                              <SelectItem value="C">Option C</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Starting Banner / Spinner */}
                        {startingState && (
                          <div className="flex items-center gap-2 text-xs bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2 animate-pulse">
                            <Loader2 size={13} className="animate-spin shrink-0" />
                            <span>{startingState}</span>
                          </div>
                        )}

                        {/* Running Status Banner */}
                        {anyUp && (
                          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
                            <Activity size={12} className="animate-pulse" />
                            <span className="font-semibold">
                              {bothUp ? 'Both Services Active (Data + Min)' : dataOk ? 'Data Service Active (Min Stopped)' : 'Min Service Active (Data Stopped)'}
                            </span>
                          </div>
                        )}

                        {/* Start — exactly three explicit actions. Each is disabled only
                            when its own target is already running, so Data and Min are
                            always independently startable regardless of the other's state. */}
                        <div className="space-y-1.5">
                          <SectionLabel>Start</SectionLabel>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-semibold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-40"
                              onClick={() => handleStartServices('data')}
                              disabled={dataOk || startLoading}
                            >
                              <Play size={12} /> Start Data ({startOption})
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-semibold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-40"
                              onClick={() => handleStartServices('min')}
                              disabled={minOk || startLoading}
                            >
                              <Play size={12} /> Start Min
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleStartServices('both')}
                            disabled={bothUp || startLoading}
                            className="w-full gap-2 h-9 text-xs font-semibold shadow-sm"
                          >
                            {startLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                            Start Both ({startOption}){pre ? ' — Pre-market' : ''}
                          </Button>
                        </div>

                        {/* Stop — mirrors Start: one control per service, always enabled
                            exactly when that service is actually running. */}
                        <div className="space-y-1.5">
                          <SectionLabel>Stop</SectionLabel>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-semibold border-red-500/40 text-red-400 hover:bg-red-500/15 disabled:opacity-40"
                              onClick={() => handleStopOne(1)}
                              disabled={!dataOk || stopOneLoading === 1 || stopLoading}
                            >
                              {stopOneLoading === 1 ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                              Stop Data
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs font-semibold border-red-500/40 text-red-400 hover:bg-red-500/15 disabled:opacity-40"
                              onClick={() => handleStopOne(2)}
                              disabled={!minOk || stopOneLoading === 2 || stopLoading}
                            >
                              {stopOneLoading === 2 ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                              Stop Min
                            </Button>
                          </div>

                          {!stopConfirm ? (
                            <Button
                              variant="destructive"
                              className="w-full gap-2 h-9 text-xs font-semibold shadow-sm"
                              onClick={() => setStopConfirm(true)}
                              disabled={!anyUp || stopLoading}
                            >
                              <Power size={13} /> Stop Both
                            </Button>
                          ) : (
                            <div className="border border-red-500/30 rounded-lg p-3 space-y-2 bg-red-500/5">
                              <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                                <AlertCircle size={13} /> Stop both Data &amp; Min?
                              </p>
                              <p className="text-[10px] text-muted-foreground">Sends stop signal (service:3) to server processes.</p>
                              <div className="flex gap-2">
                                <Button variant="destructive" onClick={handleStopServices} disabled={stopLoading} className="flex-1 h-8 text-xs">
                                  {stopLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Square size={12} className="mr-1" />}
                                  Yes, Stop All
                                </Button>
                                <Button variant="outline" onClick={() => setStopConfirm(false)} className="flex-1 h-8 text-xs">Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isServiceActive && !anyUp && authLocked && (
                      <div className="flex items-center gap-2 text-[10px] bg-muted/30 border rounded-lg px-2.5 py-2 text-muted-foreground">
                        <Lock size={10} /> Auth token active — services stopped.
                        <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[10px]"
                          onClick={() => { setAuthLocked(false); setTokenMsg(null); setAuthCode(''); setCodeSource(null); setAuthUrl(''); setStep('auth'); }}>
                          Re-auth
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>

            {/* ── 4. Terminal Panel (Isolated internal scroll) ──────────────── */}
            <Card>
              <CardHeader className="py-2.5 px-4 flex-row items-center justify-between shrink-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Terminal size={14} /> Server Terminal
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ml-0.5
                    ${sseStatus === 'live' ? 'bg-emerald-400' : sseStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-amber-400 animate-pulse'}`}
                    title={sseStatus}
                  />
                  <span className="text-[10px] text-muted-foreground/50 font-normal">{sseStatus}</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {lastLog && (
                    <span className={`text-[10px] hidden lg:flex items-center gap-1 ${logColor(lastLog.level)} max-w-sm truncate`}>
                      {logPrefix(lastLog.level)} [{lastLog.action}] {lastLog.message}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{logs.length}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearLogs} disabled={clearingLogs} title="Clear logs">
                    {clearingLogs ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={terminalScrollRef}
                  className="h-56 overflow-y-auto px-4 py-2 font-mono text-[11px] space-y-px border-t bg-muted/10"
                >
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground/40 italic py-6 text-center">No events yet — actions appear here in real-time.</p>
                  ) : (
                    logs.map((l, i) => (
                      <div key={i} className={`flex gap-2 leading-5 min-w-0 rounded px-1 ${i === logs.length - 1 ? logBg(l.level) : ''}`}>
                        <span className="text-muted-foreground/40 shrink-0 tabular-nums select-none w-16">{fmtTime(l.timestamp)}</span>
                        <span className={`shrink-0 w-4 text-center ${logColor(l.level)}`}>{logPrefix(l.level)}</span>
                        <span className="text-muted-foreground/50 shrink-0 select-none w-32 truncate">[{l.action}]</span>
                        <span className={`${logColor(l.level)} break-all flex-1`}>{l.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* ── Reset PIN Dialog ─────────────────────────────────────────────── */}
        <Dialog open={resetOpen} onOpenChange={v => { setResetOpen(v); if (!v) setResetSuccess(false); }}>
          <DialogContent className="sm:max-w-sm" onOpenAutoFocus={e => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeySquare size={16} /> Reset PIN — {resetUser?.displayName}
              </DialogTitle>
              <DialogDescription>
                Enter your current PIN, then choose a new 4-digit PIN.
              </DialogDescription>
            </DialogHeader>

            {resetSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 size={40} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">PIN updated successfully</p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <PinInput
                  label="Current PIN"
                  value={resetCurPin}
                  onChange={v => { setResetCurPin(v); setResetError(''); }}
                  error={resetError && !resetSuccess ? resetError : undefined}
                  autoFocus
                />
                <PinInput
                  label="New PIN"
                  value={resetNewPin}
                  onChange={v => { setResetNewPin(v); setResetError(''); }}
                />
                <PinInput
                  label="Confirm New PIN"
                  value={resetConfPin}
                  onChange={v => { setResetConfPin(v); setResetError(''); }}
                  onEnter={() => resetCurPin.length === 4 && resetNewPin.length === 4 && resetConfPin.length === 4 && handleResetPin()}
                  error={resetConfPin.length === 4 && resetNewPin !== resetConfPin ? 'PINs do not match' : undefined}
                />

                {resetError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <XCircle size={12} /> {resetError}
                  </p>
                )}

                <Button
                  onClick={handleResetPin}
                  disabled={resetLoading || resetCurPin.length !== 4 || resetNewPin.length !== 4 || resetConfPin.length !== 4}
                  className="w-full gap-1.5"
                >
                  {resetLoading ? <Loader2 size={13} className="animate-spin" /> : <KeySquare size={13} />}
                  Update PIN
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </SidebarProvider>
  );
}
