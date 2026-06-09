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
import { ModeToggle } from '@/app/components/toggleButton';
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink,
  KeyRound, Loader2, Lock, LogOut, Play, Power, RefreshCw,
  Shield, Square, Terminal, Trash2, XCircle, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FyersUser      { id: string; displayName: string }
interface HealthState    { Data: boolean; Min: boolean }
interface LogEntry       { timestamp: string; level: 'info'|'success'|'error'|'warning'; action: string; message: string }
interface ApiError       extends Error { data?: Record<string, unknown> }

type Step = 'user-select' | 'auth' | 'service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function isPreMarket(): boolean {
  const d = nowIST();
  return d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() < 15);
}

/** Fetch wrapper — throws ApiError with .data = full response body on non-2xx */
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
function logPrefix(l: LogEntry['level']) {
  return ({ info: 'ℹ', success: '✓', error: '✗', warning: '⚠' })[l];
}

function parseAuthCode(raw: string): string {
  try { return new URL(raw.trim()).searchParams.get('auth_code') ?? raw.trim(); }
  catch { return raw.trim(); }
}

// ─── Small atoms ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-zinc-600'}`} />;
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FyersControlPage() {

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users,         setUsers]         = useState<FyersUser[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(true);
  const [usersSource,   setUsersSource]   = useState<'api'|'fallback'|null>(null);
  const [refreshing,    setRefreshing]    = useState(false);

  // ── Navigation step ───────────────────────────────────────────────────────
  const [step,         setStep]         = useState<Step>('user-select');
  const [activeUser,   setActiveUser]   = useState<FyersUser | null>(null);

  // ── PIN ───────────────────────────────────────────────────────────────────
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

  // ── Services ──────────────────────────────────────────────────────────────
  const [health,        setHealth]       = useState<HealthState | null>(null);
  const [healthLoading, setHealthLoading]= useState(false);
  const [startLoading,  setStartLoading] = useState(false);
  const [stopLoading,   setStopLoading]  = useState(false);
  const [stopConfirm,   setStopConfirm]  = useState(false);

  // ── Logs / terminal ───────────────────────────────────────────────────────
  const [logs,          setLogs]         = useState<LogEntry[]>([]);
  const [clearingLogs,  setClearingLogs] = useState(false);
  const [sseStatus,     setSseStatus]    = useState<'connecting'|'live'|'error'>('connecting');
  const logsEndRef   = useRef<HTMLDivElement>(null);
  const esRef        = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ═════════════════════════════════════════════════════════════════════════
  // Effects
  // ═════════════════════════════════════════════════════════════════════════

  // Fetch user list (optionally force-refresh from API)
  const loadUsers = useCallback(async (forceRefresh = false) => {
    forceRefresh ? setRefreshing(true) : setUsersLoading(true);
    try {
      if (forceRefresh) {
        const r = await apiFetch<{ count: number; source: 'api'|'fallback' }>(
          '/api/fyers-control/users/refresh', { method: 'POST' }
        );
        setUsersSource(r.source);
      }
      const d = await apiFetch<{ users: FyersUser[] }>('/api/fyers-control/users');
      setUsers(d.users ?? []);
    } catch { /* backend not running — stay empty */ }
    finally { setUsersLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // SSE log stream with reconnect
  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource('/api/fyers-control/logs/stream');
    esRef.current = es;

    es.onopen    = () => setSseStatus('live');
    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs(prev => [...prev, entry].slice(-600));
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => {
      setSseStatus('error');
      es.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connectSSE, 4000);
    };
  }, []);

  useEffect(() => {
    connectSSE();
    return () => {
      esRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectSSE]);

  // Auto-scroll logs
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Capture auth_code from query string (if redirect lands here)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('auth_code');
    if (code) {
      setAuthCode(code);
      setCodeSource('auto');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Poll health while on service step
  const pollHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await apiFetch<HealthState>('/api/fyers-control/health');
      setHealth(h);
    } catch { setHealth(null); }
    finally  { setHealthLoading(false); }
  }, []);

  useEffect(() => {
    if (step !== 'service') return;
    pollHealth();
    const id = setInterval(pollHealth, 8000);
    return () => clearInterval(id);
  }, [step, pollHealth]);

  // ═════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═════════════════════════════════════════════════════════════════════════

  function pickUser(u: FyersUser) {
    setActiveUser(u);
    setPin(''); setPinError(''); setPinLocked(false); setAttemptsLeft(5);
  }

  async function handleValidatePin() {
    if (!activeUser || pin.length !== 4) return;
    setPinLoading(true); setPinError('');
    try {
      await apiFetch('/api/fyers-control/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id, pin }),
      });
      // PIN OK — check if already authenticated on backend
      const state = await apiFetch<{ authenticated: boolean; authLocked: boolean }>(
        `/api/fyers-control/auth-state/${activeUser.id}`
      );
      setAuthLocked(state.authLocked);
      if (state.authLocked) {
        // Services may already be running; go straight to service step
        setStep('service');
      } else {
        setStep('auth');
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      const body = e.data ?? {};
      if (body.locked) {
        setPinLocked(true);
        setPinError('Too many attempts — locked for 5 minutes.');
      } else if (typeof body.attemptsLeft === 'number') {
        setAttemptsLeft(body.attemptsLeft);
        setPinError(`Incorrect PIN — ${body.attemptsLeft} attempt${body.attemptsLeft !== 1 ? 's' : ''} remaining.`);
      } else {
        setPinError(e.message ?? 'Invalid PIN.');
      }
    } finally { setPinLoading(false); }
  }

  async function handleGenerateUrl() {
    if (!activeUser) return;
    setUrlLoading(true); setAuthUrl('');
    try {
      const d = await apiFetch<{ auth_url: string }>('/api/fyers-control/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id }),
      });
      setAuthUrl(d.auth_url);
    } catch (e: unknown) {
      const err = e as ApiError;
      addLocalLog({ level: 'error', action: 'GET_AUTH_URL', message: err.message ?? 'Failed to generate auth URL' });
    } finally { setUrlLoading(false); }
  }

  async function handleAuthenticate() {
    if (!activeUser || !authCode.trim()) return;
    setTokenLoading(true); setTokenMsg(null);
    try {
      const d = await apiFetch<{ accepted: boolean; message: string }>(
        '/api/fyers-control/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: activeUser.id, authCode: parseAuthCode(authCode) }),
        },
      );
      setTokenMsg({ ok: d.accepted, text: d.message ?? (d.accepted ? 'Token accepted' : 'Token rejected') });
      if (d.accepted) {
        setAuthLocked(true);
        setStep('service');
      }
    } catch (e: unknown) {
      const err = e as ApiError;
      setTokenMsg({ ok: false, text: err.message ?? 'Token exchange failed' });
    } finally { setTokenLoading(false); }
  }

  async function handleStartServices() {
    setStartLoading(true);
    const mode = isPreMarket() ? 'pre-9:15' : 'post-9:15';
    try {
      // 1. Start Data — always option C per API spec
      await apiFetch('/api/fyers-control/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 1, option: 'C' }),
      });
      addLocalLog({ level: 'success', action: 'START', message: `Data service started (${mode}, option C)` });

      // 2. Start Min
      await apiFetch('/api/fyers-control/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 2 }),
      });
      addLocalLog({ level: 'success', action: 'START', message: `Min service started (${mode})` });

      await pollHealth();
    } catch (e: unknown) {
      addLocalLog({ level: 'error', action: 'START', message: (e as ApiError).message ?? 'Start failed' });
    } finally { setStartLoading(false); }
  }

  async function handleStopServices() {
    setStopLoading(true); setStopConfirm(false);
    try {
      await apiFetch('/api/fyers-control/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 3 }),
      });
      setAuthLocked(false);
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
    setHealth(null); setStopConfirm(false);
  }

  function addLocalLog(entry: Omit<LogEntry, 'timestamp'>) {
    setLogs(p => [...p, { ...entry, timestamp: new Date().toISOString() }].slice(-600));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═════════════════════════════════════════════════════════════════════════

  function StepBar() {
    const STEPS: { key: Step; label: string }[] = [
      { key: 'user-select', label: 'User & PIN' },
      { key: 'auth',        label: 'Fyers Auth' },
      { key: 'service',     label: 'Services'   },
    ];
    const cur = STEPS.findIndex(s => s.key === step);
    return (
      <div className="flex items-center gap-2 mb-5">
        {STEPS.map((s, i) => {
          const active = step === s.key;
          const done   = cur > i;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`h-px flex-1 transition-colors ${done ? 'bg-emerald-500' : 'bg-border'}`} />}
              <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap transition-colors
                ${active ? 'bg-primary text-primary-foreground' : done ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {done && <CheckCircle2 size={11} />}
                {s.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // ── CARD 1: User picker + PIN ─────────────────────────────────────────────
  function UserPinCard() {
    const locked = step === 'service' || step === 'auth';
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={16} /> User Selection &amp; PIN
          </CardTitle>
          {!locked && <CardDescription>Choose a Fyers account then enter your 4-digit PIN.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Account chips */}
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={13} className="animate-spin" /> Loading accounts…
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</p>
                <div className="flex items-center gap-1.5">
                  {usersSource && (
                    <Badge variant={usersSource === 'api' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {usersSource === 'api' ? 'Live API' : 'Fallback'}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => loadUsers(true)} disabled={refreshing}>
                    {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  </Button>
                </div>
              </div>
              {users.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No users — ensure backend &amp; local API are running.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {users.map(u => (
                    <button key={u.id} onClick={() => !locked && pickUser(u)}
                      disabled={locked}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                        ${activeUser?.id === u.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : locked
                            ? 'border-border text-muted-foreground cursor-default'
                            : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}`}>
                      {u.displayName}
                      {locked && activeUser?.id === u.id && <CheckCircle2 size={12} className="inline ml-1.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PIN input — only on user-select step */}
          {step === 'user-select' && activeUser && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">4-Digit PIN</p>
              <div className="flex items-center gap-2">
                <input
                  type="password" inputMode="numeric" maxLength={4} autoFocus
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleValidatePin()}
                  disabled={pinLocked}
                  placeholder="••••"
                  className={`w-24 text-center text-lg tracking-[0.6em] bg-background border rounded-lg px-2 py-2
                    outline-none focus:ring-2 focus:ring-primary/40 transition
                    ${pinError ? 'border-red-500' : 'border-border'}`}
                />
                <Button onClick={handleValidatePin} disabled={pin.length !== 4 || pinLoading || pinLocked}>
                  {pinLoading ? <Loader2 size={13} className="animate-spin mr-1" /> : <KeyRound size={13} className="mr-1" />}
                  Unlock
                </Button>
              </div>
              {pinError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <XCircle size={12} /> {pinError}
                </p>
              )}
              {pinLocked && (
                <p className="mt-1.5 text-xs text-amber-400 flex items-center gap-1">
                  <Lock size={12} /> Locked — try again in 5 minutes.
                </p>
              )}
            </div>
          )}

          {/* Locked summary */}
          {locked && activeUser && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Signed in as <strong>{activeUser.displayName}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── CARD 2: Fyers auth ─────────────────────────────────────────────────────
  function FyersAuthCard() {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap size={16} /> Fyers Authentication
          </CardTitle>
          <CardDescription>
            {authLocked
              ? `${activeUser?.displayName} is authenticated. Stop services to re-authenticate.`
              : 'Generate a login URL → complete Fyers auth → paste the auth_code.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {authLocked ? (
            /* Locked summary view */
            <div className="flex items-center gap-2 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-emerald-400">
              <Lock size={14} className="shrink-0" />
              <span>Auth lock active for <strong>{activeUser?.displayName}</strong> — token written to service paths.</span>
            </div>
          ) : (
            <>
              {/* Step A — generate URL */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  A — Generate Fyers Login URL
                </p>
                <Button variant="outline" size="sm" onClick={handleGenerateUrl} disabled={urlLoading}>
                  {urlLoading
                    ? <Loader2 size={13} className="animate-spin mr-1.5" />
                    : <RefreshCw size={13} className="mr-1.5" />}
                  Generate Login URL
                </Button>
                {authUrl && (
                  <div className="flex items-center gap-1 bg-muted/40 border rounded-lg px-2.5 py-1.5 mt-1">
                    <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                      {authUrl.length > 70 ? authUrl.slice(0, 70) + '…' : authUrl}
                    </span>
                    <CopyBtn text={authUrl} />
                    <a href={authUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Open Fyers login">
                        <ExternalLink size={13} />
                      </Button>
                    </a>
                  </div>
                )}
              </div>

              {/* Step B — paste auth code */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  B — Paste Auth Code
                </p>
                {codeSource === 'auto' && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Captured automatically from redirect URL
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={authCode}
                    onChange={e => { setAuthCode(e.target.value); setCodeSource('manual'); }}
                    placeholder="Paste auth_code or full redirect URL…"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs
                      font-mono outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {authCode && <CopyBtn text={authCode} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  After Fyers login you are redirected to a URL containing <code className="bg-muted px-1 rounded">?auth_code=…</code>. Paste the full URL or just the code.
                </p>
              </div>

              {/* Step C — exchange token */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  C — Authenticate Dashboard
                </p>
                <Button
                  onClick={handleAuthenticate}
                  disabled={!authCode.trim() || tokenLoading}
                  className="gap-1.5"
                >
                  {tokenLoading
                    ? <Loader2 size={13} className="animate-spin" />
                    : <KeyRound size={13} />}
                  Authenticate Dashboard
                </Button>
                {tokenMsg && (
                  <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border
                    ${tokenMsg.ok
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
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

  // ── CARD 3: Service control ────────────────────────────────────────────────
  function ServiceCard() {
    const dataOk   = health?.Data  ?? false;
    const minOk    = health?.Min   ?? false;
    const anyUp    = dataOk || minOk;
    const pre      = isPreMarket();

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Power size={16} /> Service Control
          </CardTitle>
          <CardDescription>
            {pre ? 'Market not open — Pre-9:15 IST mode.' : 'Market open — Post-9:15 IST mode.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Health status row */}
          <div className="flex items-center gap-4 bg-muted/25 border rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={dataOk} />
              <span className={dataOk ? 'text-emerald-400' : 'text-muted-foreground'}>Data {dataOk ? 'running' : 'stopped'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={minOk} />
              <span className={minOk ? 'text-emerald-400' : 'text-muted-foreground'}>Min {minOk ? 'running' : 'stopped'}</span>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={pollHealth} disabled={healthLoading} title="Refresh health">
              {healthLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </Button>
          </div>

          {/* Controls */}
          {!anyUp ? (
            /* ── START ── */
            <div className="space-y-1.5">
              <Button onClick={handleStartServices} disabled={startLoading} className="w-full gap-2">
                {startLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {pre ? 'Start Services (Pre-9:15)' : 'Start Services (Post-9:15)'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Starts Data (service:1, option:C) then Min (service:2)
              </p>
            </div>
          ) : (
            /* ── STOP ── */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Services are live — start controls are disabled.
              </div>

              {!stopConfirm ? (
                <Button variant="destructive" className="w-full gap-2" onClick={() => setStopConfirm(true)} disabled={stopLoading}>
                  <Square size={14} /> Stop All Services
                </Button>
              ) : (
                <div className="border border-red-500/30 rounded-lg p-3.5 space-y-3 bg-red-500/5">
                  <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <AlertCircle size={14} /> Stop both Data &amp; Min services?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sends Ctrl-C to both services (service:3). The <code>screen</code> session stays alive.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleStopServices} disabled={stopLoading} className="flex-1">
                      {stopLoading ? <Loader2 size={13} className="animate-spin mr-1" /> : <Square size={13} className="mr-1" />}
                      Yes, Stop
                    </Button>
                    <Button variant="outline" onClick={() => setStopConfirm(false)} className="flex-1">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Re-auth prompt after stop */}
          {!anyUp && authLocked && (
            <div className="flex items-center gap-2 text-xs bg-muted/30 border rounded-lg px-3 py-2 text-muted-foreground">
              <Lock size={11} />
              Auth lock released — services stopped.
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs"
                onClick={() => {
                  setAuthLocked(false);
                  setTokenMsg(null);
                  setAuthCode('');
                  setCodeSource(null);
                  setAuthUrl('');
                  setStep('auth');
                }}>
                Re-authenticate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Terminal ───────────────────────────────────────────────────────────────
  function TerminalPanel() {
    return (
      <Card className="flex flex-col min-h-[360px]">
        <CardHeader className="py-3 px-4 flex-row items-center justify-between shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal size={14} /> Server Terminal
            <span className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${
              sseStatus === 'live' ? 'bg-emerald-400' : sseStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-amber-400 animate-pulse'
            }`} title={sseStatus} />
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{logs.length}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearLogs} disabled={clearingLogs} title="Clear">
              {clearingLogs ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-[320px]">
            <div className="px-4 py-2.5 font-mono text-[11px] space-y-0.5">
              {logs.length === 0
                ? <p className="text-muted-foreground/60 italic">No events yet — actions appear here in real-time.</p>
                : logs.map((l, i) => (
                    <div key={i} className="flex gap-2 leading-5 min-w-0">
                      <span className="text-muted-foreground/50 shrink-0 tabular-nums select-none">
                        {new Date(l.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                      </span>
                      <span className={`shrink-0 ${logColor(l.level)}`}>{logPrefix(l.level)}</span>
                      <span className="text-muted-foreground/70 shrink-0 select-none">[{l.action}]</span>
                      <span className={`${logColor(l.level)} break-all`}>{l.message}</span>
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

  // ═════════════════════════════════════════════════════════════════════════
  // Layout
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
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
            {step !== 'user-select' && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={handleResetSession}>
                <LogOut size={12} /> Reset Session
              </Button>
            )}
            <ModeToggle />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <div className="max-w-5xl w-full mx-auto space-y-4">

            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Shield size={18} /> Fyers Control Panel
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ephemeral session — browser refresh resets all UI state. Services keep running on the server.
              </p>
            </div>

            <StepBar />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Left column — step cards */}
              <div className="space-y-4">
                {/* User/PIN always visible */}
                <UserPinCard />

                {/* Fyers auth — shown on auth + service steps */}
                {(step === 'auth' || step === 'service') && <FyersAuthCard />}

                {/* Service control — shown only on service step */}
                {step === 'service' && <ServiceCard />}
              </div>

              {/* Right column — terminal */}
              <div className="lg:sticky lg:top-4">
                <TerminalPanel />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
