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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ModeToggle } from '@/app/components/toggleButton';
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink,
  KeyRound, Loader2, Lock, LogOut, Play, Power, RefreshCw,
  Shield, Square, Terminal, Trash2, XCircle, Zap, Activity,
  User, Database, Clock, ChevronRight, KeySquare,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FyersUser   { id: string; displayName: string }
interface HealthState { Data: boolean; Min: boolean }
interface LogEntry    { timestamp: string; level: 'info'|'success'|'error'|'warning'; action: string; message: string }
interface ApiError    extends Error { data?: Record<string, unknown> }

type Step = 'user-select' | 'auth' | 'service';

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

// ─── Atoms ────────────────────────────────────────────────────────────────────

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0
      ${ok ? `bg-emerald-400 shadow-[0_0_6px_#34d399] ${pulse ? 'animate-pulse' : ''}` : 'bg-zinc-600'}`}
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

// ─── PinDots ──────────────────────────────────────────────────────────────────

function PinDots({ value, max = 4 }: { value: string; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i < value.length ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );
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
        {/* Visible dot indicators */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full border-2 transition-all
              ${i < value.length ? 'bg-primary border-primary scale-110' : 'bg-transparent border-muted-foreground/30'}`}
            />
          ))}
        </div>
        {/* Hidden-but-focused input that captures keystrokes */}
        <input
          type="password" inputMode="numeric" maxLength={4}
          // eslint-disable-next-line jsx-a11y/no-autofocus
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

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const popupRef = useRef<Window | null>(null);

  // ── Services ──────────────────────────────────────────────────────────────
  const [health,        setHealth]       = useState<HealthState | null>(null);
  const [healthLoading, setHealthLoading]= useState(false);
  const [startLoading,  setStartLoading] = useState(false);
  const [stopLoading,   setStopLoading]  = useState(false);
  const [stopConfirm,   setStopConfirm]  = useState(false);
  const [lastStarted,   setLastStarted]  = useState<string | null>(null);

  // ── Logs ──────────────────────────────────────────────────────────────────
  const [logs,          setLogs]         = useState<LogEntry[]>([]);
  const [clearingLogs,  setClearingLogs] = useState(false);
  const [sseStatus,     setSseStatus]    = useState<'connecting'|'live'|'error'>('connecting');
  const logsEndRef   = useRef<HTMLDivElement>(null);
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
  // Effects
  // ═══════════════════════════════════════════════════════════════════════════

  const loadUsers = useCallback(async (forceRefresh = false) => {
    forceRefresh ? setRefreshing(true) : setUsersLoading(true);
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

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

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
      // Accept only from known redirect origins
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
  }, []);

  // Health polling while on service step
  const pollHealth = useCallback(async () => {
    setHealthLoading(true);
    try { const h = await apiFetch<HealthState>('/api/fyers-control/health'); setHealth(h); }
    catch { setHealth(null); }
    finally { setHealthLoading(false); }
  }, []);

  useEffect(() => {
    if (step !== 'service') return;
    pollHealth();
    const id = setInterval(pollHealth, 8000);
    return () => clearInterval(id);
  }, [step, pollHealth]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════════

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
      const state = await apiFetch<{ authenticated: boolean; authLocked: boolean }>(
        `/api/fyers-control/auth-state/${activeUser.id}`,
      );
      setAuthLocked(state.authLocked);
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
      if (d.accepted) { setAuthLocked(true); setStep('service'); }
    } catch (e: unknown) {
      setTokenMsg({ ok: false, text: (e as ApiError).message ?? 'Token exchange failed' });
    } finally { setTokenLoading(false); }
  }

  async function handleStartServices() {
    setStartLoading(true);
    const mode = isPreMarket() ? 'pre-9:15' : 'post-9:15';
    try {
      await apiFetch('/api/fyers-control/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 1, option: 'C' }),
      });
      addLocalLog({ level: 'success', action: 'START', message: `Data service started (${mode}, option C)` });
      await apiFetch('/api/fyers-control/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 2 }),
      });
      addLocalLog({ level: 'success', action: 'START', message: `Min service started (${mode})` });
      setLastStarted(new Date().toISOString());
      await pollHealth();
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'START', message: (e as ApiError).message ?? 'Start failed' });
    } finally { setStartLoading(false); }
  }

  async function handleStopServices() {
    setStopLoading(true); setStopConfirm(false);
    try {
      await apiFetch('/api/fyers-control/stop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 3 }),
      });
      setAuthLocked(false); setLastStarted(null);
      addLocalLog({ level: 'success', action: 'STOP', message: 'Both services stopped (service: 3)' });
      await pollHealth();
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'STOP', message: (e as ApiError).message ?? 'Stop failed' });
    } finally { setStopLoading(false); }
  }

  async function handleClearLogs() {
    setClearingLogs(true);
    try { await apiFetch('/api/fyers-control/logs', { method: 'DELETE' }); setLogs([]); }
    catch { /* ignore */ }
    finally { setClearingLogs(false); }
  }

  function handleResetSession() {
    setStep('user-select'); setActiveUser(null);
    setPin(''); setPinError(''); setPinLocked(false); setAttemptsLeft(5);
    setAuthUrl(''); setAuthCode(''); setCodeSource(null);
    setTokenMsg(null); setAuthLocked(false);
    setHealth(null); setStopConfirm(false); setLastStarted(null);
  }

  function addLocalLog(entry: Omit<LogEntry, 'timestamp'>) {
    setLogs(p => [...p, { ...entry, timestamp: new Date().toISOString() }].slice(-600));
  }

  // ── Reset PIN ─────────────────────────────────────────────────────────────

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

  // ═══════════════════════════════════════════════════════════════════════════
  // Cards
  // ═══════════════════════════════════════════════════════════════════════════

  function UserPinCard() {
    const done = step === 'auth' || step === 'service';
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <User size={15} className="text-primary" /> User &amp; PIN
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {done && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]"><CheckCircle2 size={9} className="mr-1" />Unlocked</Badge>}
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
            {done ? `Signed in as ${activeUser?.displayName} — PIN verified` : 'Choose an account then enter your 4-digit PIN'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          {/* Account chips */}
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
                  <button key={u.id} onClick={() => !done && pickUser(u)} disabled={done}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      ${activeUser?.id === u.id
                        ? done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-primary bg-primary/10 text-primary'
                        : done ? 'border-border text-muted-foreground/40 cursor-default' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}`}>
                    {u.displayName}
                    {done && activeUser?.id === u.id && <CheckCircle2 size={10} className="inline ml-1" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PIN entry */}
          {!done && activeUser && (
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

          {!done && !activeUser && !usersLoading && users.length > 0 && (
            <p className="text-xs text-muted-foreground/60 italic flex items-center gap-1.5">
              <ChevronRight size={11} /> Select an account above to continue
            </p>
          )}

          {done && activeUser && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 size={12} /> Authenticated as <strong>{activeUser.displayName}</strong>
            </p>
          )}

          {/* Reset PIN link — always visible when users loaded */}
          {users.length > 0 && (
            <div className="pt-2 border-t">
              <button
                onClick={() => {
                  const target = activeUser ?? (users.length === 1 ? users[0] : null);
                  if (target) { openResetPin(target); }
                  else { /* prompt to pick — show a small select */ }
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <KeySquare size={11} />
                {activeUser ? `Reset PIN for ${activeUser.displayName}` : 'Reset PIN…'}
              </button>
              {/* If no activeUser and multiple users, show a mini picker */}
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
    );
  }

  // ── Fyers Auth card ───────────────────────────────────────────────────────

  function FyersAuthCard() {
    const isActive   = step === 'auth' || step === 'service';
    const parsedCode = authCode.trim() ? parseAuthCode(authCode) : '';
    const codeValid  = parsedCode.length >= 10;

    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap size={15} className="text-yellow-400" /> Fyers Auth
            </CardTitle>
            {authLocked && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]"><Lock size={9} className="mr-1" />Token Active</Badge>}
          </div>
          <CardDescription className="text-xs">
            {!isActive ? 'Complete User & PIN first'
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
                <p className="text-xs text-muted-foreground mt-0.5">Token written to both service paths. Services can now be started.</p>
              </div>
            </div>
          ) : (
            <>
              {/* A — Generate URL */}
              <div className="space-y-2">
                <SectionLabel>A — Generate Login URL</SectionLabel>
                <Button variant="outline" size="sm" onClick={handleGenerateUrl} disabled={urlLoading || !isActive} className="gap-1.5 h-8">
                  {urlLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Generate URL
                </Button>

                {authUrl && (
                  <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2">
                    {/* URL text box — always visible so user can copy it */}
                    <div className="flex items-center gap-1 min-w-0">
                      <code className="flex-1 min-w-0 text-[10px] font-mono text-muted-foreground truncate select-all">
                        {authUrl}
                      </code>
                      <CopyBtn text={authUrl} />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {/* Primary: open as popup (auth code auto-fills if relay page deployed) */}
                      <Button size="sm" onClick={openAuthPopup} className="gap-1.5 h-7 flex-1 text-xs">
                        <ExternalLink size={11} /> Open Popup
                      </Button>
                      {/* Fallback: plain link for browsers that block popups */}
                      <a href={authUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="outline" size="sm" className="gap-1.5 h-7 w-full text-xs">
                          <ExternalLink size={11} /> Open Tab
                        </Button>
                      </a>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 leading-snug">
                      After login you are redirected to a URL containing <span className="font-mono bg-muted px-0.5 rounded">?auth_code=…</span><br />
                      Copy that full URL and paste it in field B below.
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
                    type="text" value={authCode} disabled={!isActive}
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
                <Button onClick={handleAuthenticate} disabled={!codeValid || tokenLoading || !isActive} className="gap-1.5 h-8 w-full">
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
        </CardContent>
      </Card>
    );
  }

  // ── Service Control card ──────────────────────────────────────────────────

  function ServiceCard() {
    const isActive = step === 'service';
    const dataOk   = health?.Data ?? false;
    const minOk    = health?.Min  ?? false;
    const anyUp    = dataOk || minOk;
    const bothUp   = dataOk && minOk;
    const pre      = isPreMarket();

    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Power size={15} className="text-violet-400" /> Services
            </CardTitle>
            {isActive && (
              <Badge variant="outline"
                className={`text-[10px] ${bothUp ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : anyUp ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'text-muted-foreground'}`}>
                {bothUp ? 'Both Running' : anyUp ? 'Partial' : 'Stopped'}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            {!isActive ? 'Complete auth first' : pre ? 'Pre-9:15 IST — pre-market mode' : 'Post-9:15 IST — market open mode'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          {/* Health */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>Service Health</SectionLabel>
              <Button variant="ghost" size="icon" className="h-5 w-5 -mt-1" onClick={pollHealth} disabled={healthLoading || !isActive}>
                {healthLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'Data', ok: dataOk, desc: 'NSE feed (opt C)' },
                { key: 'Min',  ok: minOk,  desc: 'Minute aggregator' },
              ].map(({ key, ok, desc }) => (
                <div key={key} className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 transition-colors
                  ${ok ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-muted/20'}`}>
                  <div className="flex items-center gap-1.5">
                    <StatusDot ok={ok} pulse={ok} />
                    <span className={`text-xs font-semibold ${ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>{key}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 ml-4">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          {lastStarted && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Clock size={9} /> Started {fmtTime(lastStarted)}
            </p>
          )}
          {isActive && activeUser && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/20 border rounded-lg px-2.5 py-1.5">
              <User size={9} /> Auth as <span className="font-medium text-foreground ml-0.5">{activeUser.displayName}</span>
              <span className="ml-auto font-mono opacity-50">{activeUser.id}</span>
            </div>
          )}

          {/* Controls */}
          {isActive && (
            <div className="space-y-2">
              {!anyUp ? (
                <>
                  <Button onClick={handleStartServices} disabled={startLoading} className="w-full gap-2 h-9">
                    {startLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    {pre ? 'Start Services (Pre-market)' : 'Start Services'}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground/60">
                    Data (service:1, opt C) → Min (service:2)
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                    <Activity size={10} /> Services live — stop before restarting
                  </div>
                  {!stopConfirm ? (
                    <Button variant="destructive" className="w-full gap-2 h-9" onClick={() => setStopConfirm(true)} disabled={stopLoading}>
                      <Square size={13} /> Stop All Services
                    </Button>
                  ) : (
                    <div className="border border-red-500/30 rounded-lg p-3 space-y-2 bg-red-500/5">
                      <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                        <AlertCircle size={13} /> Stop both Data &amp; Min?
                      </p>
                      <p className="text-[10px] text-muted-foreground">Sends Ctrl-C (service:3). Screen session stays alive.</p>
                      <div className="flex gap-2">
                        <Button variant="destructive" onClick={handleStopServices} disabled={stopLoading} className="flex-1 h-8">
                          {stopLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Square size={12} className="mr-1" />}
                          Yes, Stop
                        </Button>
                        <Button variant="outline" onClick={() => setStopConfirm(false)} className="flex-1 h-8">Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isActive && !anyUp && authLocked && (
            <div className="flex items-center gap-2 text-[10px] bg-muted/30 border rounded-lg px-2.5 py-2 text-muted-foreground">
              <Lock size={10} /> Auth lock released — services stopped.
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[10px]"
                onClick={() => { setAuthLocked(false); setTokenMsg(null); setAuthCode(''); setCodeSource(null); setAuthUrl(''); setStep('auth'); }}>
                Re-auth
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Terminal ──────────────────────────────────────────────────────────────

  function TerminalPanel() {
    const lastLog = logs[logs.length - 1];
    return (
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
          <ScrollArea className="h-56">
            <div className="px-4 py-2 font-mono text-[11px] space-y-px">
              {logs.length === 0
                ? <p className="text-muted-foreground/40 italic py-6 text-center">No events yet — actions appear here in real-time.</p>
                : logs.map((l, i) => (
                    <div key={i} className={`flex gap-2 leading-5 min-w-0 rounded px-1 ${i === logs.length - 1 ? logBg(l.level) : ''}`}>
                      <span className="text-muted-foreground/40 shrink-0 tabular-nums select-none w-16">{fmtTime(l.timestamp)}</span>
                      <span className={`shrink-0 w-4 text-center ${logColor(l.level)}`}>{logPrefix(l.level)}</span>
                      <span className="text-muted-foreground/50 shrink-0 select-none w-32 truncate">[{l.action}]</span>
                      <span className={`${logColor(l.level)} break-all flex-1`}>{l.message}</span>
                    </div>
                  ))
              }
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // ── Step bar ──────────────────────────────────────────────────────────────

  function StepBar() {
    const STEPS = [
      { key: 'user-select' as Step, label: 'User & PIN',  icon: <User size={11} /> },
      { key: 'auth'        as Step, label: 'Fyers Auth',  icon: <Zap size={11} /> },
      { key: 'service'     as Step, label: 'Services',    icon: <Database size={11} /> },
    ];
    const cur = STEPS.findIndex(s => s.key === step);
    return (
      <div className="flex items-center mb-5">
        {STEPS.map((s, i) => {
          const active = step === s.key;
          const done   = cur > i;
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
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Layout
  // ═══════════════════════════════════════════════════════════════════════════

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
            {step === 'service' && health && (
              <div className="hidden md:flex items-center gap-3 text-xs bg-muted/40 border rounded-lg px-3 py-1.5 mr-2">
                <span className="flex items-center gap-1.5"><StatusDot ok={health.Data} pulse={health.Data} /><span className={health.Data ? 'text-emerald-400' : 'text-muted-foreground'}>Data</span></span>
                <span className="flex items-center gap-1.5"><StatusDot ok={health.Min}  pulse={health.Min}  /><span className={health.Min  ? 'text-emerald-400' : 'text-muted-foreground'}>Min</span></span>
              </div>
            )}
            {step !== 'user-select' && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={handleResetSession}>
                <LogOut size={12} /> Reset
              </Button>
            )}
            <ModeToggle />
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <div className="w-full space-y-4">

            <div>
              <h1 className="text-base font-semibold flex items-center gap-2">
                <Shield size={16} /> Fyers Control Panel
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ephemeral UI — browser refresh resets visual state. Services keep running on the server.
              </p>
            </div>

            <StepBar />

            {/* 3-column cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UserPinCard />
              <div className={`transition-opacity duration-300 ${step === 'user-select' ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <FyersAuthCard />
              </div>
              <div className={`transition-opacity duration-300 ${step !== 'service' ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <ServiceCard />
              </div>
            </div>

            {/* Terminal full-width */}
            <TerminalPanel />

          </div>
        </div>

        {/* ── Reset PIN Dialog ─────────────────────────────────────────────── */}
        <Dialog open={resetOpen} onOpenChange={v => { setResetOpen(v); if (!v) setResetSuccess(false); }}>
          {/* onOpenAutoFocus: prevent Radix from grabbing focus so our autoFocus input wins */}
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
                {/* autoFocus only on the first field */}
                <PinInput
                  label="Current PIN"
                  value={resetCurPin}
                  onChange={v => { setResetCurPin(v); setResetError(''); }}
                  onEnter={() => resetCurPin.length === 4 && document.getElementById('reset-new-pin')?.focus()}
                  error={resetError && !resetSuccess ? resetError : undefined}
                  autoFocus
                />
                <PinInput
                  label="New PIN"
                  value={resetNewPin}
                  onChange={v => { setResetNewPin(v); setResetError(''); }}
                  onEnter={() => resetNewPin.length === 4 && document.getElementById('reset-conf-pin')?.focus()}
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
