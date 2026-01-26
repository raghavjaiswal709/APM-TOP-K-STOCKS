'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppSidebar } from "@/app/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/app/components/toggleButton";
import {
  Play,
  Square,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileCheck,
  Clock,
} from "lucide-react";

// Types for validation log entries
interface ValidationLogEntry {
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'complete';
  message: string;
  timestamp: string;
  exitCode?: number;
}

type ValidationStatus = 'idle' | 'running' | 'completed' | 'failed';

// Get the appropriate styling for each log type
const getLogStyle = (type: ValidationLogEntry['type']) => {
  switch (type) {
    case 'stdout':
      return 'text-green-400';
    case 'stderr':
      return 'text-red-400';
    case 'info':
      return 'text-blue-400';
    case 'error':
      return 'text-red-500 font-semibold';
    case 'complete':
      return 'text-cyan-400 font-bold';
    default:
      return 'text-gray-300';
  }
};

// Get the prefix icon/symbol for each log type
const getLogPrefix = (type: ValidationLogEntry['type']) => {
  switch (type) {
    case 'stdout':
      return '>';
    case 'stderr':
      return '!';
    case 'info':
      return 'ℹ';
    case 'error':
      return '✗';
    case 'complete':
      return '◆';
    default:
      return '•';
  }
};

export default function AdminValidatePage() {
  const [logs, setLogs] = useState<ValidationLogEntry[]>([]);
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [failedSubscriptions, setFailedSubscriptions] = useState<string[]>([]);
  const [isFixDialogOpen, setIsFixDialogOpen] = useState(false);
  const [selectedFailedSymbol, setSelectedFailedSymbol] = useState<string | null>(null);
  const [fixData, setFixData] = useState({ companyCode: '', exchange: 'NSE', marker: 'EQ' });
  const [isFixing, setIsFixing] = useState(false);
  const [validateFailedOnly, setValidateFailedOnly] = useState(false);

  // Fetch failed subscriptions on load
  useEffect(() => {
    fetchFailedSubscriptions();
  }, []);

  // Refetch failed subscriptions when validation completes
  useEffect(() => {
    if (status === 'completed') {
      // Delay to allow backend to update the file
      setTimeout(fetchFailedSubscriptions, 1000);
    }
  }, [status]);

  const fetchFailedSubscriptions = async () => {
    try {
      const res = await fetch('/api/admin/failed-subscriptions');
      const data = await res.json();
      if (data.success) {
        const failed = data.data || [];
        setFailedSubscriptions(failed);
        // Default to failed-only if there are errors
        if (failed.length > 0) {
          setValidateFailedOnly(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch failed subscriptions:', error);
    }
  };

  const clearFailedSubscriptions = async () => {
    try {
      const res = await fetch('/api/admin/failed-subscriptions', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFailedSubscriptions([]);
        setValidateFailedOnly(false);
      }
    } catch (error) {
      console.error('Failed to clear failed subscriptions:', error);
    }
  };

  const handleFixClick = (symbol: string) => {
    setSelectedFailedSymbol(symbol);
    // Try to parse symbol if possible to pre-fill
    // Format usually: "EXCHANGE:CODE-MARKER" or just "CODE"
    const parts = symbol.includes(':') ? symbol.split(':')[1].split('-') : [symbol];
    setFixData({
      companyCode: parts[0] || symbol,
      exchange: 'NSE',
      marker: 'EQ'
    });
    setIsFixDialogOpen(true);
  };

  const handleFixSubmit = async () => {
    if (!selectedFailedSymbol) return;

    setIsFixing(true);
    try {
      const res = await fetch('/api/admin/fix-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldSymbol: selectedFailedSymbol,
          ...fixData
        })
      });
      const result = await res.json();

      if (result.success) {
        // Remove from local list or refresh
        setFailedSubscriptions(prev => prev.filter(s => s !== selectedFailedSymbol));
        setIsFixDialogOpen(false);
        // Show toast or alert?
      } else {
        alert(`Failed to fix: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fixing subscription:', error);
      alert('Error fixing subscription');
    } finally {
      setIsFixing(false);
    }
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const parseProgress = useCallback((message: string) => {
    // Match patterns like "[123/456]" or "Progress: 123/456"
    const progressMatch = message.match(/\[(\d+)\/(\d+)\]/);
    if (progressMatch) {
      const current = parseInt(progressMatch[1], 10);
      const total = parseInt(progressMatch[2], 10);
      setProgress({ current, total });
    }

    // Also match "Processing X NSE companies..."
    const totalMatch = message.match(/Processing (\d+) NSE companies/);
    if (totalMatch) {
      setProgress((prev) => ({ ...prev, total: parseInt(totalMatch[1], 10) }));
    }
  }, []);

  // Wait, I should not delete `parseProgress`.
  // Steps 83 showed `parseProgress` at line 101.
  // My previous view in Step 123 showed `failedSubscriptions` state being added around line 383 (duplicate) and line 93 (correct).
  // The correct location validation logic:
  // I will just add `validateFailedOnly` state at the top.
  // And modify `startValidation` later.



  // Calculate percentage and ETA
  const getProgressInfo = useCallback(() => {
    if (progress.total === 0) return { percentage: 0, eta: null };

    const percentage = Math.round((progress.current / progress.total) * 100);

    if (!startTime || progress.current === 0) return { percentage, eta: null };

    const elapsed = (new Date().getTime() - startTime.getTime()) / 1000;
    const avgTimePerItem = elapsed / progress.current;
    const remaining = (progress.total - progress.current) * avgTimePerItem;

    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    const eta = remaining > 0 ? `${minutes}m ${seconds}s` : null;

    return { percentage, eta };
  }, [progress, startTime]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startValidation = useCallback(() => {
    // Reset state
    setLogs([]);
    setStatus('running');
    setStartTime(new Date());
    setEndTime(null);
    setExitCode(null);
    setProgress({ current: 0, total: 0 });

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Dynamically determine backend URL based on window location
    // This ensures it works both locally and on server
    let backendUrl: string;
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // If accessing from server IP, use server IP for backend
      // Use relative URL to go through Next.js proxy
      backendUrl = '';
    } else {
      backendUrl = '';
    }

    // Create SSE connection
    const query = validateFailedOnly ? '?failedOnly=true' : '';
    const eventSource = new EventSource(`${backendUrl}/api/admin/validate/run${query}`);
    eventSourceRef.current = eventSource;

    // Handler for processing log entries
    const handleLogEntry = (event: MessageEvent) => {
      try {
        const logEntry: ValidationLogEntry = JSON.parse(event.data);
        setLogs((prevLogs) => [...prevLogs, logEntry]);

        // Parse progress from the message
        parseProgress(logEntry.message);

        // Check for completion
        if (logEntry.type === 'complete') {
          setEndTime(new Date());
          setExitCode(logEntry.exitCode ?? null);
          setStatus(logEntry.exitCode === 0 ? 'completed' : 'failed');
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    // Listen for custom 'validation-log' events from NestJS SSE
    eventSource.addEventListener('validation-log', handleLogEntry);

    // Also listen for generic messages (fallback)
    eventSource.onmessage = handleLogEntry;

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Only set failed if not already completed
      setStatus((currentStatus) => {
        if (currentStatus === 'running') {
          setEndTime(new Date());
          setLogs((prevLogs) => [
            ...prevLogs,
            {
              type: 'error',
              message: 'Connection to server lost. Please try again.',
              timestamp: new Date().toISOString(),
            },
          ]);
          return 'failed';
        }
        return currentStatus;
      });
      eventSource.close();
    };
  }, [parseProgress, validateFailedOnly]);

  const stopValidation = useCallback(async () => {
    try {
      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Dynamically determine backend URL based on window location
      let backendUrl: string;
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Use relative URL to go through Next.js proxy
        backendUrl = '';
      } else {
        backendUrl = '';
      }

      // Call stop endpoint
      const response = await fetch(`${backendUrl}/api/admin/validate/stop`, {
        method: 'POST',
      });
      const result = await response.json();

      setLogs((prevLogs) => [
        ...prevLogs,
        {
          type: 'info',
          message: result.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      setStatus('failed');
      setEndTime(new Date());
    } catch (error) {
      console.error('Error stopping validation:', error);
    }
  }, []);

  const resetValidation = useCallback(() => {
    setLogs([]);
    setStatus('idle');
    setStartTime(null);
    setEndTime(null);
    setExitCode(null);
    setProgress({ current: 0, total: 0 });
  }, []);

  // Calculate duration
  const getDuration = () => {
    if (!startTime) return null;
    const end = endTime || new Date();
    const diff = Math.floor((end.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}m ${seconds}s`;
  };

  // Get progress info for display
  const progressInfo = getProgressInfo();

  // Get status badge
  const getStatusBadge = () => {
    switch (status) {
      case 'idle':
        return <Badge variant="secondary" className="bg-gray-700 text-gray-200">Ready</Badge>;
      case 'running':
        return <Badge className="bg-blue-600 text-white animate-pulse">Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  // Count log types for stats
  const getLogStats = () => {
    const stats = { success: 0, errors: 0, total: logs.length };
    logs.forEach((log) => {
      if (log.message.includes('✓') || log.message.includes('SUCCESS')) {
        stats.success++;
      }
      if (log.type === 'error' || log.type === 'stderr' || log.message.includes('✗') || log.message.includes('FAILED')) {
        stats.errors++;
      }
    });
    return stats;
  };

  const stats = getLogStats();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* ... (Existing Header and Content) ... */}
        <header className="flex h-16 shrink-0 items-center gap-2 w-full border-b border-border/40">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-between w-full">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Validate</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-4">

          {/* Failed Subscriptions Section */}
          {failedSubscriptions.length > 0 && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-5 w-5" />
                      Failed Subscriptions ({failedSubscriptions.length})
                    </CardTitle>
                    <CardDescription>
                      The following symbols failed to subscribe. Validation required.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={fetchFailedSubscriptions}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                    <Button size="sm" variant="destructive" onClick={clearFailedSubscriptions}>
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {failedSubscriptions.map(symbol => (
                    <div key={symbol} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50">
                      <code className="text-sm font-mono">{symbol}</code>
                      <Button size="sm" variant="outline" onClick={() => handleFixClick(symbol)}>
                        Fix
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ... (Existing Validation Card) ... */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            {/* ... card content ... */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">NSE Stock Series Validator</CardTitle>
                    <CardDescription className="mt-1">
                      Validate NSE stock series (EQ, BE, BZ, etc.) using Fyers API
                    </CardDescription>
                  </div>

                  {/* Big Progress Display */}
                  {status === 'running' && progress.total > 0 && (
                    <div className="hidden md:flex items-center gap-6 ml-8 pl-8 border-l border-border/50">
                      {/* Big Percentage */}
                      <div className="flex flex-col items-center">
                        <div className="text-4xl font-bold text-primary tabular-nums">
                          {progressInfo.percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {progress.current} / {progress.total}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300 ease-out"
                            style={{ width: `${progressInfo.percentage}%` }}
                          />
                        </div>
                        {progressInfo.eta && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>ETA: {progressInfo.eta}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed Progress */}
                  {status === 'completed' && progress.total > 0 && (
                    <div className="hidden md:flex items-center gap-4 ml-8 pl-8 border-l border-border/50">
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle2 className="h-8 w-8" />
                        <div className="text-3xl font-bold">100%</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {progress.total} companies validated
                      </div>
                    </div>
                  )}
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                {status === 'idle' && (
                  <div className="flex flex-col items-start gap-2">
                    {failedSubscriptions.length > 0 && (
                      <div className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          id="failedOnly"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={validateFailedOnly}
                          onChange={(e) => setValidateFailedOnly(e.target.checked)}
                        />
                        <label htmlFor="failedOnly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Validate only failed subscriptions ({failedSubscriptions.length})
                        </label>
                      </div>
                    )}
                    <Button
                      onClick={startValidation}
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <Play className="h-4 w-4" />
                      Start {validateFailedOnly ? 'Targeted' : 'Full'} Validation
                    </Button>
                  </div>
                )}

                {status === 'running' && (
                  <Button
                    onClick={stopValidation}
                    variant="destructive"
                    className="gap-2"
                    size="lg"
                  >
                    <Square className="h-4 w-4" />
                    Stop Process
                  </Button>
                )}

                {(status === 'completed' || status === 'failed') && (
                  <>
                    <Button
                      onClick={startValidation}
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Run Again
                    </Button>
                    <Button
                      onClick={resetValidation}
                      variant="outline"
                      className="gap-2"
                      size="lg"
                    >
                      Clear Logs
                    </Button>
                  </>
                )}

                {/* Duration */}
                {startTime && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                    <Clock className="h-4 w-4" />
                    <span>Duration: {getDuration()}</span>
                  </div>
                )}
              </div>

              {/* Mobile Progress Display */}
              {status === 'running' && progress.total > 0 && (
                <div className="md:hidden mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="text-2xl font-bold text-primary">{progressInfo.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                      style={{ width: `${progressInfo.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progress.current} / {progress.total} companies</span>
                    {progressInfo.eta && <span>ETA: {progressInfo.eta}</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          {logs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                      <Terminal className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Lines</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Success</p>
                      <p className="text-2xl font-bold text-green-500">{stats.success}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Errors</p>
                      <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10">
                      {status === 'running' ? (
                        <Loader2 className="h-4 w-4 text-cyan-500 animate-spin" />
                      ) : status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                      ) : status === 'failed' ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Terminal className="h-4 w-4 text-cyan-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Exit Code</p>
                      <p className="text-2xl font-bold">
                        {exitCode !== null ? exitCode : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Terminal Output Card */}
          <Card className="flex-1 border-border/50 bg-card/50 min-h-[500px]">
            <CardHeader className="pb-2 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
                </div>
                {status === 'running' && (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-muted-foreground">Live</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={logContainerRef}
                className="h-[500px] overflow-auto bg-[#0d1117] rounded-b-lg font-mono text-sm"
              >
                {status === 'idle' && logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/10">
                      <Terminal className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Ready to validate</p>
                      <p className="text-sm mt-1">Click "Start Validation" to begin the NSE stock series validation process</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 ${getLogStyle(log.type)}`}
                      >
                        <span className="text-gray-500 text-xs w-20 flex-shrink-0 font-normal">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="w-4 flex-shrink-0 text-center opacity-60">
                          {getLogPrefix(log.type)}
                        </span>
                        <span className="flex-1 break-all whitespace-pre-wrap">
                          {log.message}
                        </span>
                      </div>
                    ))}
                    {status === 'running' && (
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="w-20 flex-shrink-0"></span>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="animate-pulse">Processing...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Completion Summary */}
          {(status === 'completed' || status === 'failed') && (
            <Card className={`border-l-4 ${status === 'completed' ? 'border-l-green-500 bg-green-500/5' : 'border-l-red-500 bg-red-500/5'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  {status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <p className={`font-semibold ${status === 'completed' ? 'text-green-500' : 'text-red-500'}`}>
                      {status === 'completed' ? 'Validation Completed Successfully!' : 'Validation Failed'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {status === 'completed'
                        ? 'All NSE stock series have been validated and saved to company_validated.csv'
                        : `Process exited with code ${exitCode}. Check the logs for details.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fix Dialog */}
          {isFixDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <Card className="w-[400px]">
                <CardHeader>
                  <CardTitle>Fix Subscription</CardTitle>
                  <CardDescription>Correct the details for {selectedFailedSymbol}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Code</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={fixData.companyCode}
                      onChange={e => setFixData({ ...fixData, companyCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Exchange</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={fixData.exchange}
                      onChange={e => setFixData({ ...fixData, exchange: e.target.value })}
                    >
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marker</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={fixData.marker}
                      onChange={e => setFixData({ ...fixData, marker: e.target.value })}
                    >
                      <option value="EQ">EQ</option>
                      <option value="BE">BE</option>
                      <option value="BZ">BZ</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsFixDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleFixSubmit} disabled={isFixing}>
                      {isFixing ? 'Saving...' : 'Save & Fix'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
