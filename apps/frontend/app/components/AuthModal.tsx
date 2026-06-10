'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
    Key,
    Maximize2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
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

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const router = useRouter();
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
        if (isOpen) {
            fetchAuthStatus();
            const interval = setInterval(fetchAuthStatus, 10000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

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
        const now = new Date();
        const totalDuration = 12 * 60 * 60 * 1000;
        const timeLeft = expiryDate.getTime() - now.getTime();
        const percentage = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));
        return percentage;
    };

    const handleGoToFullPage = () => {
        onClose();
        router.push('/auth');
    };

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
                                Connect your Fyers account for real-time market data
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
                                <span className="text-xs font-medium text-muted-foreground">Session</span>
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="text-lg font-bold">Secure</div>
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
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Button
                                        size="default"
                                        onClick={startAuthFlow}
                                        disabled={loading}
                                        className="min-w-[130px]"
                                    >
                                        {loading ? (
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                        )}
                                        {authStatus?.authenticated ? 'Re-authenticate' : 'Connect'}
                                    </Button>
                                    {getStatusIcon()}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={fetchAuthStatus} 
                                    disabled={loading}
                                    className="h-8 w-8"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="py-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Error</AlertTitle>
                                    <AlertDescription className="text-xs">{error}</AlertDescription>
                                </Alert>
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
                                    Configuration & Credentials
                                </h3>
                                <div className="grid gap-3 p-3 rounded-lg border bg-card/50">
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
