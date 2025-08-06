'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Copy, ArrowRight } from 'lucide-react';
export default function FyersCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'timeout'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [authCode, setAuthCode] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [countdown, setCountdown] = useState(5);
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    console.log('Callback received:', { code, error, state });
    if (error) {
      setStatus('error');
      setMessage(`Authentication failed: ${error}`);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('No authorization code received');
      return;
    }
    setAuthCode(code);
    processAuthCode(code);
  }, [searchParams]);
  const processAuthCode = async (code: string) => {
    try {
      console.log('Processing auth code:', code);
      setMessage('Generating access token... This may take up to 90 seconds.');
      const response = await fetch('/api/auth/fyers/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      console.log('Token response:', data);
      if (!response.ok) {
        if (response.status === 408) {
          setStatus('timeout');
          setMessage('Authentication timed out. The process took too long. Please try again.');
          return;
        }
        throw new Error(data.error || 'Failed to generate token');
      }
      setAccessToken(data.access_token);
      setStatus('success');
      setMessage('Authentication successful! Python scripts will now start automatically.');
      await notifyPythonScripts(data.access_token, code);
      startCountdown();
    } catch (error) {
      console.error('Auth processing error:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };
  const notifyPythonScripts = async (token: string, code: string) => {
    try {
      console.log('Notifying Python scripts...');
      const results = await Promise.allSettled([
        fetch('/api/auth/fyers/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            service: 'fyers_data', 
            token, 
            auth_code: code 
          }),
        }),
        fetch('/api/auth/fyers/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            service: 'multi_company_live_data', 
            token, 
            auth_code: code 
          }),
        })
      ]);
      console.log('Notification results:', results);
    } catch (error) {
      console.error('Failed to notify Python scripts:', error);
    }
  };
  const startCountdown = () => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/live-market?auth=success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  const goToLiveMarket = () => {
    router.push('/live-market?auth=success');
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'processing' && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-500" />}
            {status === 'timeout' && <XCircle className="h-6 w-6 text-yellow-500" />}
            Fyers Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">{message}</p>
          {authCode && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Authorization Code:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCode}
                  readOnly
                  className="flex-1 p-2 text-sm border rounded bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(authCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {status === 'success' && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                ✅ Authentication completed successfully!
                <br />
                Python scripts have been notified and should start automatically.
              </div>
              {countdown > 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Redirecting to Live Market in {countdown} seconds...
                  </p>
                  <Button 
                    onClick={goToLiveMarket}
                    className="w-full"
                    size="sm"
                  >
                    Go Now <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {(status === 'error' || status === 'timeout') && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {status === 'timeout' ? '⏰' : '❌'} {message}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={goToLiveMarket}
                  className="flex-1"
                  size="sm"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

