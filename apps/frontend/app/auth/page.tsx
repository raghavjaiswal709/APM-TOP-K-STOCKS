'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from "../components/app-sidebar";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ModeToggle } from "../components/toggleButton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    Key
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

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
                            className={`w-full min-h-[100px] bg-muted/50 rounded-md border px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring ${sensitive && !show ? "blur-sm select-none" : "select-all"}`}
                        />
                        {sensitive && !show && (
                            <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
                                <span className="text-muted-foreground text-xs backdrop-blur-md px-2 py-1 rounded">Hidden</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative flex-1 bg-muted/50 rounded-md border px-3 py-2 text-sm font-mono overflow-hidden h-9 flex items-center">
                        <span className={`w-full truncate ${sensitive && !show ? "blur-sm select-none" : "select-all"}`}>
                            {value || <span className="text-muted-foreground/40 italic">Not available</span>}
                        </span>
                    </div>
                )}

                <div className={`flex flex-col gap-1 ${multiline ? 'mt-0' : ''}`}>
                    {sensitive && (
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShow(!show)} disabled={!value}>
                            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleCopy} disabled={!value}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default function AuthPage() {
    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAuthStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/fyers/status', {
                cache: 'no-store',
                next: { revalidate: 0 },
            });
            const data = await response.json();
            setAuthStatus(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch auth status');
            console.error(err);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    const startAuthFlow = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/auth/fyers/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ force: true }),
            });
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to start authentication');
                return;
            }

            if (data.auth_url) {
                window.open(data.auth_url, '_blank');
            } else if (data.message) {
                setError(data.message);
            }
        } catch (err) {
            setError('Failed to start authentication');
        } finally {
            setLoading(false);
            fetchAuthStatus();
        }
    };

    useEffect(() => {
        fetchAuthStatus();
        const interval = setInterval(fetchAuthStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        if (!authStatus) return 'text-gray-500';
        // Check actual JWT expiry
        if (authStatus.is_expired) return 'text-red-500';
        if (authStatus.authenticated && authStatus.token_valid) return 'text-green-500';
        if (authStatus.authenticated) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getStatusIcon = () => {
        if (!authStatus) return <Activity className="w-6 h-6" />;
        // Check actual JWT expiry
        if (authStatus.is_expired) return <XCircle className="w-6 h-6 text-red-500" />;
        if (authStatus.authenticated && authStatus.token_valid) return <CheckCircle className="w-6 h-6 text-green-500" />;
        if (authStatus.authenticated) return <Clock className="w-6 h-6 text-yellow-500" />;
        return <XCircle className="w-6 h-6 text-red-500" />;
    };

    const getExpiryProgress = () => {
        // Use JWT expiry time if available
        const expiryStr = authStatus?.jwt_expires_at || authStatus?.expires_at;
        if (!expiryStr) return 0;
        const expiryDate = new Date(expiryStr);
        const now = new Date();
        // Assuming 12h token validity for scale (Fyers tokens are typically valid until 6 AM next day)
        const totalDuration = 12 * 60 * 60 * 1000;
        const timeLeft = expiryDate.getTime() - now.getTime();
        const percentage = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));
        return percentage;
    };

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Authentication</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="ml-auto px-4">
                        <ModeToggle />
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-8 p-4 pt-0 max-w-4xl mx-auto w-full">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Status</CardTitle>
                                <Shield className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold flex items-center gap-2 ${getStatusColor()}`}>
                                    {authStatus?.authenticated && authStatus?.token_valid ? 'Active' :
                                        authStatus?.authenticated ? 'Expired' : 'Inactive'}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Fyers Trading API
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Session Type</CardTitle>
                                <Lock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">Secure</div>
                                <p className="text-xs text-muted-foreground">
                                    OAuth 2.0 Protocol
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Data Stream</CardTitle>
                                <Zap className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">Real-time</div>
                                <p className="text-xs text-muted-foreground">
                                    WebSocket Feed
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Connected Apps</CardTitle>
                                <Server className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {authStatus?.services_notified ? authStatus.services_notified.length : 0}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Active Services
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-t-4 border-t-primary shadow-lg">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <Shield className="h-6 w-6 text-primary" />
                                        Broker Authentication
                                    </CardTitle>
                                    <CardDescription className="mt-2">
                                        Connect your Fyers account to enable real-time market data streaming and trading features.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        size="default"
                                        onClick={startAuthFlow}
                                        disabled={loading}
                                        className="min-w-[140px]"
                                    >
                                        {loading ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                        )}
                                        {authStatus?.authenticated ? 'Re-authenticate' : 'Connect Account'}
                                    </Button>
                                    {getStatusIcon()}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Token Validity</span>
                                    <span className="font-medium">
                                        {authStatus?.expires_at ? new Date(authStatus.expires_at).toLocaleString() : 'Not Available'}
                                    </span>
                                </div>
                                <Progress value={getExpiryProgress()} className="h-2" />
                            </div>

                            {authStatus?.services_notified && authStatus.services_notified.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-sm font-medium">Notified Services</span>
                                    <div className="flex flex-wrap gap-2">
                                        {authStatus.services_notified.map((service) => (
                                            <Badge key={service} variant="secondary" className="px-3 py-1">
                                                <Server className="w-3 h-3 mr-2" />
                                                {service}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Configuration Details Section */}
                            <Separator className="my-4" />
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Key className="w-4 h-4 text-primary" />
                                    Configuration & Credentials
                                </h3>
                                <div className="grid gap-4 p-4 rounded-lg border bg-card/50">
                                    <CopyField label="App ID (Client ID)" value={authStatus?.client_id} />
                                    <CopyField label="Redirect URI" value={authStatus?.redirect_uri} />
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
                        <CardFooter className="bg-muted/20 py-4 flex justify-center">
                            <p className="text-xs text-muted-foreground flex items-center">
                                <Lock className="w-3 h-3 mr-1" />
                                You will be redirected to the broker's login page securely via OAuth 2.0
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
