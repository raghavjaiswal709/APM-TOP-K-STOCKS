'use client';

import React, { useState } from 'react';
import { X, Maximize2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useClusterPattern } from '@/hooks/useClusterPattern';

// Dynamically import Plot and ClusterChart to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
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
  
  // For Plotly charts
  createActualDataOnly?: () => any[];
  createPredictionDataOnly?: () => any[];
  createCombinedViewData?: () => any[];
  
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
  
  // Combined view handlers (for Plotly)
  combinedViewXRange?: [Date, Date] | null;
  combinedViewY1Range?: [number, number] | null;
  combinedViewY2Range?: [number, number] | null;
  resetCombinedViewToDefault?: () => void;
  handleCombinedViewRelayout?: (eventData: any) => void;
  getDefaultMarketHoursRange?: () => [Date, Date];
  getTimeRange?: () => [Date, Date];
  
  // Chart rendering mode
  chartMode: 'plotly' | 'lightweight';
}

export function SeparateViewModal({
  isOpen,
  onClose,
  symbol,
  chartType = 'line',
  predictions,
  createActualDataOnly,
  createPredictionDataOnly,
  createCombinedViewData,
  LiveChartComponent,
  liveChartProps,
  todayPredictionInfo = { hasTodayPredictions: true },
  exchange = 'NSE',
  forcedXRange,
  selectedTimeframe = '1m',
  predictionRevision = 0,
  onXRangeChange,
  combinedViewXRange,
  combinedViewY1Range,
  combinedViewY2Range,
  resetCombinedViewToDefault,
  handleCombinedViewRelayout,
  getDefaultMarketHoursRange,
  getTimeRange,
  chartMode
}: SeparateViewModalProps) {
  const [separateViewMode, setSeparateViewMode] = useState<'live-prediction' | 'live-cluster' | 'prediction-cluster' | 'combined'>('live-prediction');

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
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Maximize2 className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Comparative Analysis
              </h2>
              <p className="text-xs text-zinc-400">
                Side-by-side view of market data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800">
          <select
            value={separateViewMode}
            onChange={(e) => setSeparateViewMode(e.target.value as any)}
            className="w-full px-3 py-2 text-sm bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
          >
            <option value="combined">Combined View</option>
            <option value="live-prediction">Live Market ↔ Prediction</option>
            <option value="live-cluster">Live Market ↔ Cluster Pattern</option>
            <option value="prediction-cluster">Prediction ↔ Cluster Pattern</option>
          </select>
        </div>

        {/* Modal Content - Conditional Layout */}
        {separateViewMode === 'combined' ? (
          /* COMBINED VIEW - Single Full-Width Chart */
          <div className="flex-1 min-h-0 p-6 bg-zinc-950">
            <div className="h-full bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500 rounded-full animate-pulse"></div>
                      <h3 className="text-sm font-medium text-zinc-100">
                        Combined Analysis - Live Market, Predictions & Cluster Pattern
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      All data overlays • Market Hours: 9:15 AM - 3:30 PM {chartMode === 'lightweight' && '• Using LightweightCharts'}
                    </p>
                  </div>
                  
                  {/* Autoscale Button (Plotly only) */}
                  {chartMode === 'plotly' && resetCombinedViewToDefault && (
                    <>
                      <button
                        onClick={resetCombinedViewToDefault}
                        className="px-3 py-1.5 text-xs font-medium bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                        title="Reset to default market hours view (9:15 AM - 3:30 PM)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Autoscale
                      </button>
                      <div className="w-px h-6 bg-zinc-700 mx-3"></div>
                    </>
                  )}
                  
                  {/* Data Status Indicators */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-zinc-400">Live Market</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span className="text-zinc-400">Predictions {predictions?.count ? `(${predictions.count})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {clusterLoading ? (
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                      ) : clusterError ? (
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      ) : clusterPatternData?.length > 0 ? (
                        <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                      )}
                      <span className="text-zinc-400">
                        Cluster {clusterLoading ? '(Loading...)' : clusterError ? '(Error)' : clusterPatternData?.length > 0 ? `(${clusterPatternData.length} pts)` : '(No data)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 p-4">
                {chartMode === 'plotly' && createCombinedViewData && getDefaultMarketHoursRange ? (
                  <Plot
                    divId="combined-view-chart"
                    data={createCombinedViewData()}
                    layout={{
                      autosize: true,
                      height: undefined,
                      margin: { l: 70, r: 70, t: 80, b: 60 },
                      title: {
                        text: `${symbol} - Complete Market Analysis (All Overlays)`,
                        font: { size: 16, color: '#e4e4e7', family: 'Inter, system-ui, sans-serif', weight: 600 },
                      },
                      xaxis: {
                        title: 'Time (Market Hours: 9:15 AM - 3:30 PM)',
                        type: 'date',
                        gridcolor: '#27272a',
                        linecolor: '#3f3f46',
                        tickfont: { color: '#a1a1aa', size: 11 },
                        titlefont: { color: '#d4d4d8', size: 12 },
                        tickformat: '%H:%M',
                        range: combinedViewXRange || getDefaultMarketHoursRange(),
                        dtick: 30 * 60 * 1000,
                        fixedrange: false,
                      },
                      yaxis: {
                        title: 'Price (₹)',
                        side: 'left',
                        gridcolor: '#27272a',
                        linecolor: '#10B981',
                        tickfont: { color: '#10B981', size: 11 },
                        titlefont: { color: '#10B981', size: 13 },
                        autorange: combinedViewY1Range === null,
                        range: combinedViewY1Range || undefined,
                        fixedrange: false,
                      },
                      yaxis2: {
                        title: 'Cluster Pattern (%)',
                        side: 'right',
                        overlaying: 'y',
                        gridcolor: 'rgba(139, 92, 246, 0.1)',
                        linecolor: '#8b5cf6',
                        tickfont: { color: '#8b5cf6', size: 11 },
                        titlefont: { color: '#8b5cf6', size: 13 },
                        autorange: combinedViewY2Range === null,
                        range: combinedViewY2Range || undefined,
                        showgrid: false,
                        fixedrange: false,
                      },
                      plot_bgcolor: '#18181b',
                      paper_bgcolor: '#18181b',
                      font: { family: 'Inter, system-ui, sans-serif', color: '#e4e4e7' },
                      hovermode: 'x unified',
                      showlegend: true,
                      legend: {
                        orientation: 'h',
                        yanchor: 'bottom',
                        y: 1.02,
                        xanchor: 'center',
                        x: 0.5,
                        bgcolor: 'rgba(24, 24, 27, 0.95)',
                        bordercolor: '#3f3f46',
                        borderwidth: 1,
                        font: { size: 12, color: '#e4e4e7' },
                      },
                    }}
                    config={{
                      responsive: true,
                      displayModeBar: true,
                      displaylogo: false,
                      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                      doubleClick: 'reset+autosize',
                    }}
                    style={{ width: '100%', height: '100%' }}
                    onRelayout={handleCombinedViewRelayout}
                  />
                ) : LiveChartComponent ? (
                  <LiveChartComponent {...liveChartProps} predictions={predictions} showPredictions={true} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-zinc-400">Combined view not available for this chart type</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SIDE-BY-SIDE VIEW */
          <div className="grid grid-cols-2 gap-4 p-4 flex-1 min-h-0 bg-zinc-950">
            
            {/* LEFT PANEL */}
            <div className="flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden min-h-0">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    {separateViewMode === 'live-prediction' || separateViewMode === 'live-cluster'
                      ? 'Live Market'
                      : 'Predictions'}
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  {separateViewMode === 'live-prediction' || separateViewMode === 'live-cluster'
                    ? `Real-time data for ${symbol}`
                    : 'AI-generated forecasts'}
                </p>
              </div>

              <div className="flex-1 min-h-0 p-4">
                {separateViewMode === 'prediction-cluster' ? (
                  chartMode === 'plotly' && createPredictionDataOnly && predictions && (predictions.count ?? 0) > 0 && todayPredictionInfo.hasTodayPredictions ? (
                    <Plot
                      data={createPredictionDataOnly()}
                      layout={{
                        autosize: true,
                        height: undefined,
                        margin: { l: 50, r: 50, t: 40, b: 40 },
                        title: {
                          text: `${symbol} Predictions`,
                          font: { size: 14, color: '#e4e4e7', family: 'Inter, system-ui, sans-serif' },
                        },
                        xaxis: {
                          title: 'Time',
                          type: 'date',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        yaxis: {
                          title: 'Price (₹)',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        plot_bgcolor: '#18181b',
                        paper_bgcolor: '#18181b',
                        font: { family: 'Inter, system-ui, sans-serif', color: '#e4e4e7' },
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : LiveChartComponent && predictions ? (
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
                  chartMode === 'plotly' && createActualDataOnly ? (
                    <Plot
                      data={createActualDataOnly()}
                      layout={{
                        autosize: true,
                        height: undefined,
                        margin: { l: 50, r: 50, t: 40, b: 40 },
                        title: {
                          text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'}`,
                          font: { size: 14, color: '#e4e4e7', family: 'Inter, system-ui, sans-serif' },
                        },
                        xaxis: {
                          title: 'Time',
                          type: 'date',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        yaxis: {
                          title: 'Price (₹)',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        plot_bgcolor: '#18181b',
                        paper_bgcolor: '#18181b',
                        font: { family: 'Inter, system-ui, sans-serif', color: '#e4e4e7' },
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : LiveChartComponent ? (
                    <LiveChartComponent {...liveChartProps} predictions={null} showPredictions={false} />
                  ) : null
                )}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden min-h-0">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 bg-violet-500 rounded-full"></div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    {separateViewMode === 'live-prediction'
                      ? 'Predictions'
                      : 'Cluster Pattern'}
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  {separateViewMode === 'live-prediction'
                    ? 'AI-generated forecasts'
                    : 'Historical pattern analysis'}
                </p>
              </div>

              <div className="flex-1 min-h-0 p-4">
                {separateViewMode === 'live-prediction' ? (
                  chartMode === 'plotly' && createPredictionDataOnly && predictions && (predictions.count ?? 0) > 0 && todayPredictionInfo.hasTodayPredictions ? (
                    <Plot
                      data={createPredictionDataOnly()}
                      layout={{
                        autosize: true,
                        height: undefined,
                        margin: { l: 50, r: 50, t: 40, b: 40 },
                        title: {
                          text: `${symbol} Predictions`,
                          font: { size: 14, color: '#e4e4e7', family: 'Inter, system-ui, sans-serif' },
                        },
                        xaxis: {
                          title: 'Time',
                          type: 'date',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        yaxis: {
                          title: 'Price (₹)',
                          gridcolor: '#27272a',
                          linecolor: '#3f3f46',
                          tickfont: { color: '#a1a1aa', size: 11 },
                          titlefont: { color: '#d4d4d8', size: 12 },
                        },
                        plot_bgcolor: '#18181b',
                        paper_bgcolor: '#18181b',
                        font: { family: 'Inter, system-ui, sans-serif', color: '#e4e4e7' },
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : LiveChartComponent && predictions ? (
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
