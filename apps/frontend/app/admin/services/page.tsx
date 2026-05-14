'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppSidebar } from '@/app/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModeToggle } from '@/app/components/toggleButton';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Globe,
  Layers,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  ScrollText,
  Server,
  Square,
  Terminal,
  XCircle,
  Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ContainerKey = 'fyers-5001' | 'fyers-5010' | 'backend' | 'frontend';

interface ServiceStatus {
  key: ContainerKey;
  running: boolean;
  status: string;
  startedAt: string | null;
  restartCount: number;
  containerName: string;
}

interface ServicesData {
  services: Record<ContainerKey, ServiceStatus>;
}

interface ActivityEntry {
  timestamp: string;
  key: string;
  action: string;
  result: 'success' | 'error';
  message: string;
}

interface InstanceServiceStatus {
  containerName: string;
  state: string;
  status: string;
  running: boolean;
}

interface InstanceData {
  instanceId: string;
  instanceName: string;
  services: Record<string, InstanceServiceStatus>;
  totalContainers: number;
  runningContainers: number;
}

interface InstancesData {
  instances: Record<string, InstanceData>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_KEYS: ContainerKey[] = ['fyers-5001', 'fyers-5010', 'backend', 'frontend'];

const SERVICE_INFO: Record<ContainerKey, {
  name: string;
  description: string;
  port: number;
  iconColor: string;
  bgColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  'fyers-5001': {
    name: 'Fyers Service A',
    description: 'ASGI / Uvicorn — single-company live chart',
    port: 5001,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    Icon: Zap,
  },
  'fyers-5010': {
    name: 'Fyers Service B',
    description: 'Eventlet — multi-company live market data',
    port: 5010,
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    Icon: Activity,
  },
  'backend': {
    name: 'NestJS Backend',
    description: 'REST API + WebSocket server',
    port: 5002,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    Icon: Database,
  },
  'frontend': {
    name: 'Next.js Frontend',
    description: 'Web UI (this container)',
    port: 3000,
    iconColor: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    Icon: Globe,
  },
};

const TAB_LABELS = ['Main Services', 'Multi-Instances'] as const;
type Tab = typeof TAB_LABELS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUptime(startedAt: string | null): string {
  if (!startedAt) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatusBadge({ svc }: { svc?: ServiceStatus }) {
  if (!svc) return <Badge variant="secondary">Loading…</Badge>;
  switch (svc.status) {
    case 'running':    return <Badge className="bg-green-600 text-white">Running</Badge>;
    case 'exited':     return <Badge variant="destructive">Stopped</Badge>;
    case 'restarting': return <Badge className="bg-yellow-600 text-white animate-pulse">Restarting</Badge>;
    case 'not_found':  return <Badge variant="outline">Not Found</Badge>;
    case 'unreachable': return <Badge variant="destructive">Unreachable</Badge>;
    default:           return <Badge variant="secondary">{svc.status}</Badge>;
  }
}

function InstanceStatusBadge({ data }: { data: InstanceData }) {
  const { runningContainers: running, totalContainers: total } = data;
  if (total === 0) return <Badge variant="outline">No containers</Badge>;
  if (running === 0) return <Badge variant="destructive">Down</Badge>;
  if (running < total) return <Badge className="bg-yellow-600 text-white">Partial ({running}/{total})</Badge>;
  return <Badge className="bg-green-600 text-white">Running ({running}/{total})</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LogViewer — streams live Docker logs via SSE
// ─────────────────────────────────────────────────────────────────────────────

function LogViewer({ containerKey }: { containerKey: ContainerKey }) {
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const MAX_LINES = 500;

  const startStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setLines([]);
    setLogError(null);
    setStreaming(true);

    const es = new EventSource(`/api/admin/service-logs?key=${encodeURIComponent(containerKey)}&tail=100`);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as { log?: string; error?: string };
        if (parsed.error) { setLogError(parsed.error); setStreaming(false); es.close(); return; }
        if (parsed.log !== undefined) {
          setLines((prev) => {
            const next = [...prev, parsed.log!];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { setStreaming(false); es.close(); esRef.current = null; };
  }, [containerKey]);

  const stopStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => { startStream(); return () => { esRef.current?.close(); }; }, [startStream]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <div className="rounded-lg border border-border/40 bg-black/90 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-black/60">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-mono text-green-400">{SERVICE_INFO[containerKey].name} — live logs</span>
          {streaming && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-muted-foreground hover:text-white" onClick={() => setLines([])}>Clear</Button>
          {streaming ? (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-400 hover:text-red-300" onClick={stopStream}>
              <Square className="h-3 w-3 mr-1" />Stop
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-400 hover:text-green-300" onClick={startStream}>
              <RefreshCw className="h-3 w-3 mr-1" />Resume
            </Button>
          )}
        </div>
      </div>
      <div className="h-64 overflow-y-auto font-mono text-[11px] leading-relaxed p-2 space-y-0.5">
        {logError && <p className="text-red-400 py-1">⚠ {logError}</p>}
        {lines.length === 0 && !logError && <p className="text-muted-foreground py-1 italic">Waiting for log output…</p>}
        {lines.map((line, i) => <p key={i} className="text-gray-300 whitespace-pre-wrap break-all leading-5">{line}</p>)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ServiceCard
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceCardProps {
  containerKey: ContainerKey;
  svc?: ServiceStatus;
  isActing: boolean;
  onAction: (key: ContainerKey, action: 'restart' | 'stop' | 'start') => void;
}

function ServiceCard({ containerKey, svc, isActing, onAction }: ServiceCardProps) {
  const info = SERVICE_INFO[containerKey];
  const { Icon } = info;
  const [showLogs, setShowLogs] = useState(false);

  return (
    <Card className="border-border/50 bg-card/50 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${info.bgColor}`}>
              <Icon className={`h-5 w-5 ${info.iconColor}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">{info.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5 leading-tight">{info.description}</CardDescription>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{svc?.containerName || '—'}</p>
            </div>
          </div>
          <StatusBadge svc={svc} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 flex flex-col">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Port</p>
            <p className="text-xs font-mono font-medium">{info.port}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Uptime</p>
            <p className="text-xs font-mono font-medium">{formatUptime(svc?.startedAt ?? null)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Restarts</p>
            <p className="text-xs font-mono font-medium">{svc?.restartCount ?? '—'}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={isActing} onClick={() => onAction(containerKey, 'restart')}>
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Restart
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs text-red-500 hover:text-red-400 border-red-500/30 hover:border-red-400/50" disabled={isActing || !svc?.running} onClick={() => onAction(containerKey, 'stop')}>
            <PowerOff className="h-3.5 w-3.5 mr-1" />Stop
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs text-green-500 hover:text-green-400 border-green-500/30 hover:border-green-400/50" disabled={isActing || svc?.running} onClick={() => onAction(containerKey, 'start')}>
            <Power className="h-3.5 w-3.5 mr-1" />Start
          </Button>
        </div>

        <button onClick={() => setShowLogs((p) => !p)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ScrollText className="h-3.5 w-3.5" />
          <span>{showLogs ? 'Hide' : 'View'} Logs</span>
          {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showLogs && <div className="mt-1"><LogViewer containerKey={containerKey} /></div>}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InstanceCard
// ─────────────────────────────────────────────────────────────────────────────

interface InstanceCardProps {
  data: InstanceData;
  isActing: boolean;
  onAction: (instanceId: string, action: 'restart' | 'stop' | 'start', service?: string) => void;
}

function InstanceCard({ data, isActing, onAction }: InstanceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Layers className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-sm">{data.instanceName}</CardTitle>
              <CardDescription className="text-xs font-mono">{data.instanceId}</CardDescription>
            </div>
          </div>
          <InstanceStatusBadge data={data} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Running</p>
            <p className="text-sm font-semibold text-green-500">{data.runningContainers}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Total</p>
            <p className="text-sm font-semibold">{data.totalContainers}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={isActing} onClick={() => onAction(data.instanceId, 'restart')}>
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Restart All
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs text-red-500 hover:text-red-400 border-red-500/30 hover:border-red-400/50" disabled={isActing || data.runningContainers === 0} onClick={() => onAction(data.instanceId, 'stop')}>
            <PowerOff className="h-3.5 w-3.5 mr-1" />Stop All
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs text-green-500 hover:text-green-400 border-green-500/30 hover:border-green-400/50" disabled={isActing || data.runningContainers === data.totalContainers} onClick={() => onAction(data.instanceId, 'start')}>
            <Power className="h-3.5 w-3.5 mr-1" />Start All
          </Button>
        </div>

        <button onClick={() => setExpanded((p) => !p)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Server className="h-3.5 w-3.5" />
          <span>{expanded ? 'Hide' : 'Show'} services ({Object.keys(data.services).length})</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="space-y-1.5 pt-1">
            {Object.entries(data.services).map(([svcName, svcData]) => (
              <div key={svcName} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${svcData.running ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs font-mono">{svcData.containerName || svcName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{svcData.status}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" disabled={isActing} onClick={() => onAction(data.instanceId, 'restart', svcName)}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Main Services');

  // ── Main services state ──
  const [services, setServices] = useState<ServicesData['services'] | null>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ key: string; action: string } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const servicesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Instances state ──
  const [instances, setInstances] = useState<InstancesData['instances'] | null>(null);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [instanceActionLoading, setInstanceActionLoading] = useState<string | null>(null);
  const instancesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchServices = useCallback(async (silent = false) => {
    if (!silent) setServicesLoading(true);
    try {
      const res = await fetch('/api/admin/service-control');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ServicesData = await res.json();
      setServices(data.services);
      setServicesError(null);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to reach Docker socket');
    } finally {
      if (!silent) setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    servicesIntervalRef.current = setInterval(() => fetchServices(true), 5000);
    return () => { if (servicesIntervalRef.current) clearInterval(servicesIntervalRef.current); };
  }, [fetchServices]);

  const fetchInstances = useCallback(async (silent = false) => {
    if (!silent) setInstancesLoading(true);
    try {
      const res = await fetch('/api/admin/instances');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InstancesData = await res.json();
      setInstances(data.instances);
      setInstancesError(null);
    } catch (err) {
      setInstancesError(err instanceof Error ? err.message : 'Failed to fetch instances');
    } finally {
      if (!silent) setInstancesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'Multi-Instances') {
      fetchInstances();
      instancesIntervalRef.current = setInterval(() => fetchInstances(true), 8000);
    } else {
      if (instancesIntervalRef.current) { clearInterval(instancesIntervalRef.current); instancesIntervalRef.current = null; }
    }
    return () => { if (instancesIntervalRef.current) clearInterval(instancesIntervalRef.current); };
  }, [activeTab, fetchInstances]);

  const performAction = useCallback(async (key: ContainerKey, action: 'restart' | 'stop' | 'start') => {
    setActionLoading({ key, action });
    try {
      const res = await fetch('/api/admin/service-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action }),
      });
      const data = await res.json();
      setActivityLog((prev) => [{ timestamp: new Date().toISOString(), key, action, result: data.success ? 'success' : 'error', message: (data.message ?? data.error ?? 'Unknown') as string }, ...prev].slice(0, 50));
      setTimeout(() => fetchServices(true), 2000);
    } catch (err) {
      setActivityLog((prev) => [{ timestamp: new Date().toISOString(), key, action, result: 'error', message: err instanceof Error ? err.message : 'Network error' }, ...prev].slice(0, 50));
    } finally { setActionLoading(null); }
  }, [fetchServices]);

  const performInstanceAction = useCallback(async (instanceId: string, action: 'restart' | 'stop' | 'start', service?: string) => {
    setInstanceActionLoading(instanceId);
    try {
      const res = await fetch('/api/admin/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, action, ...(service ? { service } : {}) }),
      });
      const data = await res.json();
      setActivityLog((prev) => [{
        timestamp: new Date().toISOString(),
        key: instanceId + (service ? `/${service}` : ''),
        action,
        result: data.success ? 'success' : 'error',
        message: data.success ? `${action} applied to ${instanceId}` : (data.error ?? 'Some containers failed'),
      }, ...prev].slice(0, 50));
      setTimeout(() => fetchInstances(true), 2000);
    } catch (err) {
      setActivityLog((prev) => [{ timestamp: new Date().toISOString(), key: instanceId, action, result: 'error', message: err instanceof Error ? err.message : 'Network error' }, ...prev].slice(0, 50));
    } finally { setInstanceActionLoading(null); }
  }, [fetchInstances]);

  const instanceList = instances
    ? Object.values(instances).sort((a, b) => a.instanceId.localeCompare(b.instanceId))
    : [];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 w-full border-b border-border/40">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-between w-full">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin/validate">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Services</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-4 min-h-0">
          {/* Page title */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Docker Services</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Manage containers and multi-instance deployments</p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => activeTab === 'Main Services' ? fetchServices() : fetchInstances()}
              disabled={activeTab === 'Main Services' ? servicesLoading : instancesLoading}
            >
              {(activeTab === 'Main Services' ? servicesLoading : instancesLoading)
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'Multi-Instances' && instanceList.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5">{instanceList.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Main Services Tab ── */}
          {activeTab === 'Main Services' && (
            <div className="space-y-4">
              {servicesError && (
                <Card className="border-red-500/50 bg-red-500/5">
                  <CardContent className="flex items-start gap-2 py-3">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm space-y-1">
                      <p className="text-red-500 font-medium">{servicesError}</p>
                      <p className="text-muted-foreground text-xs">
                        Make sure <code className="font-mono">/var/run/docker.sock</code> is mounted in the frontend container.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {SERVICE_KEYS.map((key) => (
                  <ServiceCard
                    key={key}
                    containerKey={key}
                    svc={services?.[key]}
                    isActing={actionLoading?.key === key}
                    onAction={performAction}
                  />
                ))}
              </div>

              {activityLog.length > 0 && (
                <Card className="border-border/40">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />Activity Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {activityLog.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {entry.result === 'success'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />}
                          <span className="text-muted-foreground font-mono shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                          <span className="font-mono text-foreground/80">[{entry.key}] {entry.action}</span>
                          <span className={entry.result === 'success' ? 'text-green-400' : 'text-red-400'}>— {entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Multi-Instances Tab ── */}
          {activeTab === 'Multi-Instances' && (
            <div className="space-y-4">
              {instancesError && (
                <Card className="border-red-500/50 bg-red-500/5">
                  <CardContent className="flex items-start gap-2 py-3">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-red-500 font-medium">{instancesError}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Instances are discovered via Docker label <code className="font-mono">com.daks.instance</code>.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {instancesLoading && instanceList.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />Discovering instances…
                </div>
              )}

              {!instancesLoading && instanceList.length === 0 && !instancesError && (
                <Card className="border-dashed border-border/60">
                  <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                    <Layers className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No multi-instance containers found.</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Start instances via <code className="font-mono text-xs">multi-instances/manager.sh</code>, then refresh.
                      Containers must have label <code className="font-mono text-xs">com.daks.instance</code>.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {instanceList.map((inst) => (
                  <InstanceCard
                    key={inst.instanceId}
                    data={inst}
                    isActing={instanceActionLoading === inst.instanceId}
                    onAction={performInstanceAction}
                  />
                ))}
              </div>

              {activityLog.filter((e) => e.key.startsWith('instance')).length > 0 && (
                <Card className="border-border/40">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />Instance Activity Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {activityLog.filter((e) => e.key.startsWith('instance')).map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {entry.result === 'success'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />}
                          <span className="text-muted-foreground font-mono shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                          <span className="font-mono text-foreground/80">[{entry.key}] {entry.action}</span>
                          <span className={entry.result === 'success' ? 'text-green-400' : 'text-red-400'}>— {entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
