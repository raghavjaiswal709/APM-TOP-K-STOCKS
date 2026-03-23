'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useClusterPattern } from '@/hooks/useClusterPattern';
import { ARCHETYPE_COLORS } from '@/types/clustering';

// Dynamically import the full UMAP dashboard for separate view
const UMAPClusterDashboard = dynamic(() => import('@/app/market-data/components/umap/UMAPClusterDashboard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-cyan-500">Loading UMAP Analysis...</div>
    </div>
  )
});

// Dynamically import ClusterChart to avoid SSR issues
const ClusterChart = dynamic(
  () => import('@/app/market-data/components/charts/ClusterChart').then(mod => ({ default: mod.ClusterChart })),
  { ssr: false }
);

// Prediction data interface - matches actual API response structure
// API returns: { "2026-02-03 09:15": { "close": 415.26, "predicted_at": "2026-02-03 09:15:00" } }
// The key IS the timestamp, not a property in the value
interface PredictionData {
  close: number;
  predicted_at?: string;  // When prediction was made
  // Legacy support for old format
  timestamp?: string;
  predictedat?: string;
}

interface CompanyPredictions {
  company?: string;
  predictions: Record<string, PredictionData>;
  count?: number;
  starttime?: string;
  endtime?: string;
}

interface SeparateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  chartType?: 'line' | 'candle';
  predictions?: CompanyPredictions | null;

  // For LightWeightStockChart
  LiveChartComponent?: React.ComponentType<any>;
  liveChartProps?: any;

  // Common props
  todayPredictionInfo?: {
    hasTodayPredictions: boolean;
  };

  // Cluster pattern props
  exchange?: string;
  forcedXRange?: [Date, Date] | undefined;
  selectedTimeframe?: string;
  predictionRevision?: number;
  onXRangeChange?: (range: [Date, Date] | undefined) => void;
  getTimeRange?: () => [Date, Date];
}

export function SeparateViewModal({
  isOpen,
  onClose,
  symbol,
  chartType = 'line',
  predictions,
  LiveChartComponent,
  liveChartProps,
  todayPredictionInfo = { hasTodayPredictions: true },
  exchange = 'NSE',
  forcedXRange,
  selectedTimeframe = '1m',
  predictionRevision = 0,
  onXRangeChange,
  getTimeRange,
}: SeparateViewModalProps) {
  const [separateViewMode, setSeparateViewMode] = useState<'live-prediction' | 'live-cluster' | 'prediction-cluster' | 'combined' | 'umap-analysis'>('live-prediction');

  // Cluster Pattern Hook
  const {
    clusterInfo,
    patternData: clusterPatternData,
    loading: clusterLoading,
    error: clusterError,
  } = useClusterPattern({
    symbol: symbol,
    exchange: exchange,
    method: 'spectral',
    enabled: isOpen && (separateViewMode === 'live-cluster' || separateViewMode === 'prediction-cluster' || separateViewMode === 'combined'),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[98vw] h-screen max-h-screen bg-zinc-950 rounded-xl shadow-xl border border-zinc-800 overflow-hidden flex flex-col">
        
        {/* Compact Top Bar: Dropdown + Close */}
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <select
            value={separateViewMode}
            onChange={(e) => setSeparateViewMode(e.target.value as any)}
            className="flex-1 px-3 py-1.5 text-sm bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
          >
            <option value="combined">Combined View</option>
            <option value="live-prediction">Live Market ↔ Prediction</option>
            <option value="live-cluster">Live Market ↔ Cluster Pattern</option>
            <option value="prediction-cluster">Prediction ↔ Cluster Pattern</option>
            <option value="umap-analysis">Live Market ↔ UMAP Cluster Analysis</option>
          </select>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {/* Modal Content - Conditional Layout */}
        {separateViewMode === 'combined' ? (
          /* COMBINED VIEW - Single Full-Width Chart with predictions overlay */
          <div className="flex-1 min-h-0 p-2 bg-zinc-950">
            <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 p-2">
                {LiveChartComponent ? (
                  <LiveChartComponent {...liveChartProps} predictions={predictions} showPredictions={true} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-zinc-400">Combined view not available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SIDE-BY-SIDE VIEW */
          <div className="grid grid-cols-2 gap-2 p-2 flex-1 min-h-0 bg-zinc-950">

            {/* LEFT PANEL */}
            <div className="flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden min-h-0">
              <div className="flex-1 min-h-0 p-2">
                {separateViewMode === 'prediction-cluster' ? (
                  /* LEFT: predictions panel for pred-cluster mode */
                  LiveChartComponent && predictions ? (
                    <LiveChartComponent {...liveChartProps} data={[]} predictions={predictions} showPredictions={true} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl mb-2 text-zinc-700">📊</div>
                        <p className="text-sm text-zinc-400">
                          {predictions && (predictions.count ?? 0) > 0 && !todayPredictionInfo.hasTodayPredictions
                            ? 'No prediction found for today'
                            : 'No predictions available'}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  LiveChartComponent ? (
                    <LiveChartComponent {...liveChartProps} predictions={null} showPredictions={false} />
                  ) : null
                )}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden min-h-0">
              <div className="flex-1 min-h-0 p-2">
                {separateViewMode === 'umap-analysis' ? (
                  /* RIGHT: Full UMAP Cluster Dashboard */
                  <div className="h-full overflow-y-auto">
                    <UMAPClusterDashboard initialSymbol={symbol} />
                  </div>
                ) : separateViewMode === 'live-prediction' ? (
                  LiveChartComponent && predictions ? (
                    <LiveChartComponent {...liveChartProps} data={[]} predictions={predictions} showPredictions={true} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl mb-2 text-zinc-700">📊</div>
                        <p className="text-sm text-zinc-400">
                          {predictions && (predictions.count ?? 0) > 0 && !todayPredictionInfo.hasTodayPredictions
                            ? 'No prediction found for today'
                            : 'No predictions available'}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <ClusterChart
                    symbol={symbol}
                    clusterInfo={clusterInfo}
                    patternData={clusterPatternData}
                    loading={clusterLoading}
                    error={clusterError}
                    height={undefined}
                    syncedTimeRange={forcedXRange || (getTimeRange ? getTimeRange() : undefined)}
                    syncedSelectedTimeframe={selectedTimeframe}
                    updateTrigger={`${symbol}-${selectedTimeframe}-${predictionRevision}`}
                    onXRangeChange={onXRangeChange}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
