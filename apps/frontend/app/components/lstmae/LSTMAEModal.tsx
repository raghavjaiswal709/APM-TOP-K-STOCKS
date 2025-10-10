// components/lstmae/LSTMAEModal.tsx
'use client';

import React from 'react';
import { X, RefreshCw, Activity, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LSTMAEVisualization } from './LSTMAEVisualization';
import { LSTMAEInteractiveDashboard } from './LSTMAEInteractiveDashboard';
import { useLSTMAEData } from '@/hooks/useLSTMAEData';
import type { LSTMAEModalProps } from '../../types/lstmae.types';

export const LSTMAEModal: React.FC<LSTMAEModalProps> = ({
  isOpen,
  onClose,
  companyCode,
  companyName,
}) => {
  const { dashboard, plotUrls, health, loading, error, refresh, checkHealth } = useLSTMAEData(
    companyCode,
    'spectral',
    isOpen,
    true
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-600" />
              <div>
                <DialogTitle className="text-2xl">
                  LSTMAE Pattern Discovery Dashboard
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {companyName || companyCode} • Pipeline 2 Analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {health && (
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    health.status === 'healthy'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {health.status === 'healthy' ? '✓ Service Healthy' : '⚠ Degraded'}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading === 'loading'}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading === 'loading' ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{error.code}:</strong> {error.message}
                  {error.suggestion && <p className="mt-1 text-sm">{error.suggestion}</p>}
                </AlertDescription>
              </Alert>
            )}

            {loading === 'loading' && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                  <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                  <p className="text-lg font-medium">Generating Dashboard...</p>
                  <p className="text-sm text-muted-foreground">
                    First request: 10-20 seconds • Subsequent: &lt;1 second (cached)
                  </p>
                </div>
              </div>
            )}

            {(dashboard || plotUrls) && !error && loading !== 'loading' && (
              <>
                {dashboard && dashboard.dominantPatterns.length > 0 && (
                  <div className="rounded-lg border bg-blue-50 p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Dominant Patterns Detected: {dashboard.nDominantPatterns}
                    </h3>
                    <div className="grid gap-2">
                      {dashboard.dominantPatterns.slice(0, 3).map((pattern, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-blue-700">
                            Cluster {pattern.clusterId}:
                          </span>
                          <span className="text-gray-700">{pattern.patternType}</span>
                          <span className="ml-auto text-xs font-semibold text-blue-600">
                            {(pattern.strengthScore * 100).toFixed(1)}% strength
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <LSTMAEVisualization dashboard={dashboard || undefined} plotUrls={plotUrls || undefined} />

                {dashboard?.dashboardPath && (
                  <LSTMAEInteractiveDashboard
                    dashboardPath={dashboard.dashboardPath}
                    symbol={companyCode}
                  />
                )}

                <p className="text-xs text-center text-muted-foreground">
                  {loading === 'cached' ? '⚡ Loaded from cache' : '🔄 Freshly generated'} •
                  Cache TTL: 1 hour • Service: Port 8506
                </p>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
