'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
}

export const FyersAuthStatus: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuthStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/fyers/status');
      const data = await response.json();
      setAuthStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch auth status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startAuthFlow = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/fyers/start', { method: 'POST' });
      const data = await response.json();
      
      if (data.auth_url) {
        window.open(data.auth_url, '_blank');
      }
    } catch (err) {
      setError('Failed to start authentication');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
    const interval = setInterval(fetchAuthStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (!authStatus) return null;
    
    if (authStatus.authenticated && authStatus.token_valid) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    } else if (authStatus.authenticated) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
    }
  };

  const getExpiryText = () => {
    if (!authStatus?.expires_at) return 'N/A';
    
    const expiryDate = new Date(authStatus.expires_at);
    const now = new Date();
    const diffHours = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours <= 0) return 'Expired';
    if (diffHours === 1) return '1 hour remaining';
    return `${diffHours} hours remaining`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Fyers Authentication</CardTitle>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAuthStatus}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium">
              {authStatus?.authenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token Valid:</span>
            <span className="font-medium">
              {authStatus?.token_valid ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expires:</span>
            <span className="font-medium">{getExpiryText()}</span>
          </div>
          
          {authStatus?.services_notified && authStatus.services_notified.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-muted-foreground text-xs mb-1">Services Notified:</div>
              <div className="flex flex-wrap gap-1">
                {authStatus.services_notified.map((service) => (
                  <Badge key={service} variant="outline" className="text-xs">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button
            onClick={startAuthFlow}
            disabled={loading}
            size="sm"
            className="flex-1"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            {authStatus?.authenticated ? 'Re-authenticate' : 'Start Auth'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
