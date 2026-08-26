'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    ExternalLink,
    Lock,
    Activity,
    Server,
    Zap,
    AlertCircle,
    Copy,
    Check,
    Eye,
    EyeOff,
    Key,
    Maximize2,
    KeyRound,
    User,
    Users,
    Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthStatus {
    authenticated: boolean;
    token_valid: boolean;
    expires_at: string | null;
    services_notified: string[];
    client_id?: string;
    redirect_uri?: string;
    access_token?: string;
    auth_code?: string;
    timestamp?: string;
    is_expired?: boolean;
    hours_until_expiry?: number;
    jwt_expires_at?: string;
}

/** One member of config.ini. secretKey never leaves the server. */
interface FyersUser {
    id: string;
    displayName: string;
    clientId?: string;
    redirectUri?: string;
}

interface ApiError extends Error { data?: Record<string, unknown> }

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = 'fyers.authModal.userId';

/** Origins the Fyers redirect page is allowed to postMessage an auth_code from. */
const TRUSTED_REDIRECT_ORIGINS = ['https://raghavjaiswal709.github.io', 'https://daksphere.com'];

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...opts });
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

/** Members may paste the whole redirect URL rather than just the code. */
function parseAuthCode(raw: string): string {
    try { return new URL(raw.trim()).searchParams.get('auth_code') ?? raw.trim(); }
    catch { return raw.trim(); }
}

const CopyField = ({ label, value, sensitive = false, multiline = false }: { label: string, value?: string, sensitive?: boolean, multiline?: boolean }) => {
    const [copied, setCopied] = useState(false);
    const [show, setShow] = useState(!sensitive);

    const handleCopy = () => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <div className={`flex gap-2 ${multiline ? 'items-start' : 'items-center'}`}>
                {multiline ? (
                    <div className="relative flex-1">
                        <textarea
                            readOnly
                            value={value || "Not available"}
                            className={`w-full min-h-[80px] bg-muted/50 rounded-md border px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring ${sensitive && !show ? "blur-sm select-none" : "select-all"}`}
                        />
                        {sensitive && !show && (
                            <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
                                <span className="text-muted-foreground text-xs backdrop-blur-md px-2 py-1 rounded">Hidden</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative flex-1 bg-muted/50 rounded-md border px-3 py-2 text-xs font-mono overflow-hidden h-8 flex items-center">
                        <span className={`w-full truncate ${sensitive && !show ? "blur-sm select-none" : "select-all"}`}>
                            {value || <span className="text-muted-foreground/40 italic">Not available</span>}
                        </span>
                    </div>
                )}

                <div className={`flex gap-1 ${multiline ? 'flex-col mt-0' : ''}`}>
                    {sensitive && (
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShow(!show)} disabled={!value}>
                            {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCopy} disabled={!value}>
                        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const router = useRouter();

    // Session-wide token state (one active Fyers token at a time)
    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
    const [sessionUser, setSessionUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Member roster from config.ini
    const [users, setUsers] = useState<FyersUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string>('');

    // PIN gate
    const [pin, setPin] = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinError, setPinError] = useState('');
    const [verified, setVerified] = useState(false);

    // Fyers OAuth
    const [authUrl, setAuthUrl] = useState('');
    const [urlLoading, setUrlLoading] = useState(false);
    const [authCode, setAuthCode] = useState('');
    const [codeAuto, setCodeAuto] = useState(false);
    const [tokenLoading, setTokenLoading] = useState(false);
    const [tokenMsg, setTokenMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [authLocked, setAuthLocked] = useState(false);
    const popupRef = useRef<Window | null>(null);

    const selected = users.find(u => u.id === selectedId) ?? null;

    // ── Data loading ──────────────────────────────────────────────────────────

    /** Roster comes from config.ini via the same endpoint the control panel uses. */
    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const d = await apiFetch<{ users: FyersUser[] }>('/api/fyers-control/users');
            const list = d.users ?? [];
            setUsers(list);
            if (list.length === 0) {
                setUsersError('No members found in config.ini — check the config mount.');
            }
            setSelectedId(prev => {
                if (prev && list.some(u => u.id === prev)) return prev;
                const remembered = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
                if (remembered && list.some(u => u.id === remembered)) return remembered;
                return list.length === 1 ? list[0].id : '';
            });
        } catch (err) {
            setUsersError((err as ApiError).message ?? 'Could not read the member list from config.ini.');
        } finally {
            setUsersLoading(false);
        }
    }, []);

    const fetchAuthStatus = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/fyers/status', { cache: 'no-store' });
            const data = await response.json();
            setAuthStatus(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch auth status');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    /** Who owns the live session — the controller is the only source for this. */
    const fetchSessionUser = useCallback(async () => {
        try {
            const d = await apiFetch<{ currentSessionUser: string | null }>('/api/fyers-control/status');
            setSessionUser(d.currentSessionUser ?? null);
        } catch {
            setSessionUser(null);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        loadUsers();
        fetchAuthStatus();
        fetchSessionUser();
        const interval = setInterval(() => { fetchAuthStatus(); fetchSessionUser(); }, 10000);
        return () => clearInterval(interval);
    }, [isOpen, loadUsers, fetchAuthStatus, fetchSessionUser]);

    // Auth code arrives by postMessage from the Fyers redirect page.
    useEffect(() => {
        if (!isOpen) return;
        function onMessage(e: MessageEvent) {
            if (!TRUSTED_REDIRECT_ORIGINS.some(o => e.origin === o || e.origin.startsWith(o + '/'))) return;
            const data = e.data as Record<string, unknown> | null;
            const code = data?.auth_code as string | undefined;
            if (code && code.length > 10) {
                setAuthCode(code);
                setCodeAuto(true);
                try { popupRef.current?.close(); } catch { /* ignore */ }
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [isOpen]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    /** Switching member invalidates everything downstream of the choice. */
    function pickUser(id: string) {
        setSelectedId(id);
        try { localStorage.setItem(LS_KEY, id); } catch { /* private mode */ }
        setPin(''); setPinError(''); setVerified(false);
        setAuthUrl(''); setAuthCode(''); setCodeAuto(false);
        setTokenMsg(null); setAuthLocked(false); setError(null);
    }

    async function handleVerifyPin() {
        if (!selected || pin.length !== 4) return;
        setPinLoading(true); setPinError('');
        try {
            await apiFetch('/api/fyers-control/validate-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selected.id, pin }),
            });
            setVerified(true);
            const state = await apiFetch<{ authenticated: boolean; authLocked: boolean }>(
                `/api/fyers-control/auth-state/${selected.id}`,
            );
            setAuthLocked(state.authLocked);
        } catch (err) {
            const e = err as ApiError;
            const body = e.data ?? {};
            if (body.locked) setPinError('Too many attempts — locked for 5 minutes.');
            else if (typeof body.attemptsLeft === 'number') {
                const n = body.attemptsLeft as number;
                setPinError(`Incorrect PIN — ${n} attempt${n !== 1 ? 's' : ''} remaining.`);
            } else setPinError(e.message ?? 'Invalid PIN.');
        } finally {
            setPinLoading(false);
        }
    }

    /** Builds the login URL from the selected member's own config.ini credentials. */
    async function handleConnect() {
        if (!selected) return;
        setUrlLoading(true); setError(null); setTokenMsg(null);
        try {
            const d = await apiFetch<{ auth_url: string }>('/api/fyers-control/auth-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selected.id }),
            });
            setAuthUrl(d.auth_url);
            openPopup(d.auth_url);
        } catch (err) {
            setError((err as ApiError).message ?? 'Failed to start authentication');
        } finally {
            setUrlLoading(false);
        }
    }

    function openPopup(url: string) {
        try { if (popupRef.current && !popupRef.current.closed) popupRef.current.close(); } catch { /* ignore */ }
        const w = 560, h = 680;
        const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
        popupRef.current = window.open(
            url, 'fyers_auth',
            `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
        );
    }

    async function handleAuthenticate() {
        if (!selected || !authCode.trim()) return;
        setTokenLoading(true); setTokenMsg(null);
        try {
            const d = await apiFetch<{ accepted: boolean; message?: string }>(
                '/api/fyers-control/token',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: selected.id, authCode: parseAuthCode(authCode) }),
                },
            );
            setTokenMsg({ ok: d.accepted, text: d.message ?? (d.accepted ? 'Token accepted' : 'Token rejected') });
            if (d.accepted) {
                setAuthLocked(true);
                setAuthUrl(''); setAuthCode(''); setCodeAuto(false);
                fetchAuthStatus();
                fetchSessionUser();
            }
        } catch (err) {
            setTokenMsg({ ok: false, text: (err as ApiError).message ?? 'Token exchange failed' });
        } finally {
            setTokenLoading(false);
        }
    }

    function handleRefreshAll() {
        loadUsers();
        fetchAuthStatus();
        fetchSessionUser();
    }

    // ── Derived display ───────────────────────────────────────────────────────

    const getStatusColor = () => {
        if (!authStatus) return 'text-gray-500';
        if (authStatus.is_expired) return 'text-red-500';
        if (authStatus.authenticated && authStatus.token_valid) return 'text-green-500';
        if (authStatus.authenticated) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getStatusIcon = () => {
        if (!authStatus) return <Activity className="w-5 h-5" />;
        if (authStatus.is_expired) return <XCircle className="w-5 h-5 text-red-500" />;
        if (authStatus.authenticated && authStatus.token_valid) return <CheckCircle className="w-5 h-5 text-green-500" />;
        if (authStatus.authenticated) return <Clock className="w-5 h-5 text-yellow-500" />;
        return <XCircle className="w-5 h-5 text-red-500" />;
    };

    const getExpiryProgress = () => {
        const expiryStr = authStatus?.jwt_expires_at || authStatus?.expires_at;
        if (!expiryStr) return 0;
        const expiryDate = new Date(expiryStr);
        const totalDuration = 12 * 60 * 60 * 1000;
        const timeLeft = expiryDate.getTime() - Date.now();
        return Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));
    };

    const sessionOwner = sessionUser
        ? (users.find(u => u.id === sessionUser)?.displayName ?? sessionUser)
        : null;

    const handleGoToFullPage = () => {
        onClose();
        router.push('/admin/fyers-control');
    };

    const codeValid = parseAuthCode(authCode).length > 10;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Broker Authentication
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Select your name and connect your Fyers account for real-time market data
                            </DialogDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGoToFullPage} className="gap-2">
                            <Maximize2 className="h-4 w-4" />
                            Full Page
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Status Cards Grid */}
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                        <Card className="p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">Status</span>
                                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className={`text-lg font-bold flex items-center gap-1.5 ${getStatusColor()}`}>
                                {authStatus?.authenticated && authStatus?.token_valid ? 'Active' :
                                    authStatus?.authenticated ? 'Expired' : 'Inactive'}
                            </div>
                        </Card>

                        <Card className="p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">Session Owner</span>
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="text-lg font-bold truncate" title={sessionOwner ?? 'Nobody yet'}>
                                {sessionOwner ?? '—'}
                            </div>
                        </Card>

                        <Card className="p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">Data Stream</span>
                                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="text-lg font-bold">Real-time</div>
                        </Card>

                        <Card className="p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">Services</span>
                                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="text-lg font-bold">
                                {authStatus?.services_notified ? authStatus.services_notified.length : 0}
                            </div>
                        </Card>
                    </div>

                    {/* Main Auth Card */}
                    <Card className="border-t-2 border-t-primary">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" />
                                        Account
                                    </label>
                                    {usersLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Loading members from config.ini…
                                        </div>
                                    ) : (
                                        <Select value={selectedId} onValueChange={pickUser} disabled={users.length === 0}>
                                            <SelectTrigger className="h-9 w-full max-w-xs">
                                                <SelectValue placeholder="Select your name…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users.map(u => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        <span className="flex items-center gap-2">
                                                            {u.displayName}
                                                            {sessionUser === u.id && (
                                                                <span className="text-[10px] text-green-500">• live</span>
                                                            )}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    {getStatusIcon()}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRefreshAll}
                                        disabled={loading || usersLoading}
                                        className="h-8 w-8"
                                        title="Refresh members and status"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loading || usersLoading ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {usersError && (
                                <Alert variant="destructive" className="py-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Members unavailable</AlertTitle>
                                    <AlertDescription className="text-xs">{usersError}</AlertDescription>
                                </Alert>
                            )}

                            {error && (
                                <Alert variant="destructive" className="py-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Error</AlertTitle>
                                    <AlertDescription className="text-xs">{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* ── Step: pick a member ─────────────────────────────── */}
                            {!selected && !usersLoading && users.length > 0 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Select your name above to continue.
                                </p>
                            )}

                            {/* ── Step: PIN ───────────────────────────────────────── */}
                            {selected && !verified && (
                                <div className="space-y-2 rounded-lg border bg-card/50 p-3">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        4-Digit PIN for {selected.displayName}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            value={pin}
                                            onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                                            onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                                            placeholder="••••"
                                            className={`w-24 text-center text-lg tracking-[0.4em] bg-background border rounded-md px-2 py-1.5
                                                outline-none focus:ring-2 focus:ring-primary/40 transition-all
                                                ${pinError ? 'border-red-500' : 'border-border'}`}
                                        />
                                        <Button size="sm" onClick={handleVerifyPin} disabled={pin.length !== 4 || pinLoading} className="gap-1.5">
                                            {pinLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                            Unlock
                                        </Button>
                                    </div>
                                    {pinError && (
                                        <p className="text-xs text-red-400 flex items-center gap-1">
                                            <XCircle className="h-3 w-3" />{pinError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ── Step: connect + exchange ────────────────────────── */}
                            {selected && verified && (
                                <div className="space-y-3 rounded-lg border bg-card/50 p-3">
                                    <p className="text-xs text-green-500 flex items-center gap-1.5">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        PIN verified — signed in as <strong>{selected.displayName}</strong>
                                    </p>

                                    {authLocked ? (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            <Lock className="h-3.5 w-3.5" />
                                            Token active for {selected.displayName}. Stop the services in Fyers Control before re-authenticating.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" onClick={handleConnect} disabled={urlLoading} className="min-w-[130px]">
                                                    {urlLoading
                                                        ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                        : <ExternalLink className="mr-2 h-4 w-4" />}
                                                    {authUrl ? 'Reopen Login' : 'Connect'}
                                                </Button>
                                                {authUrl && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Log in, then paste the redirect URL or code below.
                                                    </span>
                                                )}
                                            </div>

                                            {authUrl && (
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                        Authorization Code
                                                        {codeAuto && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">auto-captured</Badge>
                                                        )}
                                                    </label>
                                                    <textarea
                                                        value={authCode}
                                                        onChange={e => { setAuthCode(e.target.value); setCodeAuto(false); }}
                                                        placeholder="Paste the auth_code or the full redirect URL…"
                                                        className="w-full min-h-[64px] bg-muted/50 rounded-md border px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={handleAuthenticate}
                                                        disabled={!codeValid || tokenLoading}
                                                        className="gap-1.5 w-full"
                                                    >
                                                        {tokenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                                        Authenticate as {selected.displayName}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {tokenMsg && (
                                        <p className={`text-xs flex items-start gap-1.5 ${tokenMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tokenMsg.ok
                                                ? <CheckCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                                                : <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />}
                                            {tokenMsg.text}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Token Validity</span>
                                    <span className="font-medium">
                                        {authStatus?.expires_at ? new Date(authStatus.expires_at).toLocaleString() : 'Not Available'}
                                    </span>
                                </div>
                                <Progress value={getExpiryProgress()} className="h-1.5" />
                            </div>

                            {authStatus?.services_notified && authStatus.services_notified.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-xs font-medium">Notified Services</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {authStatus.services_notified.map((service) => (
                                            <Badge key={service} variant="secondary" className="px-2 py-0.5 text-xs">
                                                <Server className="w-3 h-3 mr-1" />
                                                {service}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Configuration Details */}
                            <Separator className="my-3" />
                            <div className="space-y-3">
                                <h3 className="text-xs font-medium flex items-center gap-2">
                                    <Key className="w-3.5 h-3.5 text-primary" />
                                    Configuration &amp; Credentials
                                    {selected && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                            {selected.displayName} · config.ini
                                        </Badge>
                                    )}
                                </h3>

                                <div className="grid gap-3 p-3 rounded-lg border bg-card/50">
                                    <CopyField
                                        label="App ID (Client ID)"
                                        value={selected?.clientId ?? authStatus?.client_id}
                                    />
                                    <CopyField
                                        label="Redirect URI"
                                        value={selected?.redirectUri ?? authStatus?.redirect_uri}
                                    />
                                    <CopyField
                                        label="Authorization Code"
                                        value={authStatus?.auth_code}
                                        sensitive={true}
                                        multiline={true}
                                    />
                                    <CopyField
                                        label="Auth Token (Access Token)"
                                        value={authStatus?.access_token}
                                        sensitive={true}
                                        multiline={true}
                                    />
                                    <CopyField
                                        label="Last Updated"
                                        value={authStatus?.timestamp ? new Date(authStatus.timestamp).toLocaleString() : undefined}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/20 py-3 flex justify-center">
                            <p className="text-xs text-muted-foreground flex items-center">
                                <Lock className="w-3 h-3 mr-1" />
                                Secure OAuth 2.0 authentication
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
