'use client';

import React, { useMemo } from 'react';
import { useHealth } from '@/hooks/usePredictions';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

export const PredictionStatus: React.FC<{
  company?: string;
  lastUpdated?: Date;
  isStale?: boolean;
}> = ({ company, lastUpdated, isStale }) => {
  const { health, loading, error } = useHealth();

  const statusColor = useMemo(() => {
    if (error) return 'bg-red-500/10 border-red-500/30';
    if (!health?.running) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-green-500/10 border-green-500/30';
  }, [error, health?.running]);

  const textColor = useMemo(() => {
    if (error) return 'text-red-300';
    if (!health?.running) return 'text-yellow-300';
    return 'text-green-300';
  }, [error, health?.running]);

  const IconComponent = useMemo(() => {
    if (error) return AlertCircle;
    if (!health?.running) return Clock;
    return CheckCircle;
  }, [error, health?.running]);

  return (
    <div className={`relative p-4 rounded-lg border backdrop-blur-sm ${statusColor}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 mt-0.5 ${textColor}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className={`font-semibold ${textColor}`}>
              Prediction Service {error ? 'Unavailable' : health?.running ? 'Active' : 'Inactive'}
            </p>
            {loading && <span className="text-xs text-purple-300 animate-pulse">Checking...</span>}
          </div>

          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <>
              {health && (
                <>
                  <div className="text-sm space-y-1">
                    <p className={textColor}>
                      ✓ {health.totalcompanies} companies being tracked
                    </p>
                    <p className={textColor}>
                      ✓ {health.companystatus[company || 'ICICIBANK']?.totalpredictions || 0}{' '}
                      predictions available
                    </p>
                    <p className={`text-xs text-purple-300/70`}>
                      Last update: {new Date(health.lastupdate).toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                </>
              )}

              {lastUpdated && (
                <div className="mt-2 pt-2 border-t border-purple-500/20">
                  <p className="text-xs text-green-300">
                    Dashboard updated: {lastUpdated.toLocaleTimeString('en-IN')}
                  </p>
                  {isStale && (
                    <p className="text-xs text-yellow-300 mt-1">
                      ⚠️ Data may be stale. Refresh recommended.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictionStatus;
