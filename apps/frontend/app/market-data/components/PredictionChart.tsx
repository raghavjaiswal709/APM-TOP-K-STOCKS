'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { CompanyPredictions } from '@/hooks/usePredictions';
import PredictionAPIService from '@/lib/predictionService';
import {
  formatPredictionTime,
  getPredictionFreshnessColor,
  formatDataAge,
} from '@/lib/predictionUtils';

interface PredictionChartProps {
  company: string;
  predictions: CompanyPredictions | null;
  actualData?: Record<string, { open: number; high: number; low: number; close: number }>;
  dataAge?: number;
  loading?: boolean;
  height?: number;
  showComparison?: boolean;
  showConfidence?: boolean;
}

export const PredictionChart: React.FC<PredictionChartProps> = ({
  company,
  predictions,
  actualData,
  dataAge = 0,
  loading = false,
  height = 500,
  showComparison = true,
  showConfidence = true,
}) => {
  const [hoverData, setHoverData] = useState<{
    timestamp: string;
    predicted: number;
    actual?: number;
    predictedat: string;
  } | null>(null);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!predictions) return null;

    const chartData = PredictionAPIService.transformToChartData(predictions, actualData);

    const predictedTrace = {
      x: chartData.timestamps.map(formatPredictionTime),
      y: chartData.predictedPrices,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: `${company} - Predicted Price`,
      line: {
        color: '#3B82F6',
        width: 3,
        dash: 'solid' as const,
      },
      marker: {
        size: 6,
        color: '#3B82F6',
        symbol: 'circle' as const,
      },
      hovertemplate:
        '<b>%{fullData.name}</b><br>' +
        'Time: %{x}<br>' +
        'Price: ₹%{y:.2f}<br>' +
        '<extra></extra>',
    };

    const traces = [predictedTrace];

    // Add actual prices if available
    if (showComparison && chartData.actualPrices.some((p) => p !== null)) {
      const actualTrace = {
        x: chartData.timestamps.map(formatPredictionTime),
        y: chartData.actualPrices,
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: `${company} - Actual Price`,
        line: {
          color: '#10B981',
          width: 2,
          dash: 'dash' as const,
        },
        marker: {
          size: 5,
          color: '#10B981',
          symbol: 'square' as const,
        },
        connectgaps: false,
        hovertemplate:
          '<b>%{fullData.name}</b><br>' +
          'Time: %{x}<br>' +
          'Price: ₹%{y:.2f}<br>' +
          '<extra></extra>',
      };

      traces.push(actualTrace);
    }

    return traces;
  }, [predictions, actualData, company, showComparison]);

  const layout = useMemo(
    () => ({
      title: {
        text: `<b>${company} - Price Predictions</b><br><sub>Data Age: ${formatDataAge(dataAge)} | Status: ${loading ? 'Updating...' : 'Ready'}</sub>`,
        font: { size: 16 },
      },
      xaxis: {
        title: 'Time (IST)',
        tickangle: -45,
        showgrid: true,
        gridwidth: 1,
        gridcolor: '#E5E7EB',
      },
      yaxis: {
        title: 'Price (₹)',
        showgrid: true,
        gridwidth: 1,
        gridcolor: '#E5E7EB',
      },
      hovermode: 'x unified' as const,
      plot_bgcolor: 'rgba(249, 250, 251, 0.5)',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 40, t: 100, b: 80 },
      height: height,
      responsive: true,
      showlegend: true,
      legend: {
        x: 0.01,
        y: 0.99,
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        bordercolor: '#E5E7EB',
        borderwidth: 1,
      },
    }),
    [company, dataAge, loading, height]
  );

  const config = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }),
    []
  );

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      <div className="overflow-x-auto">
        {chartData && chartData.length > 0 ? (
          <Plot data={chartData as any} layout={layout as any} config={config} />
        ) : (
          <div className="flex items-center justify-center h-96 text-gray-500">
            <div className="text-center">
              {loading && (
                <>
                  <div className="animate-spin mb-4">⚙️</div>
                  <p>Loading predictions...</p>
                </>
              )}
              {!loading && !predictions && (
                <>
                  <div className="mb-4">📊</div>
                  <p>No prediction data available</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showConfidence && predictions && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Predictions</p>
              <p className="text-lg font-bold text-blue-600">{predictions.count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Price</p>
              <p className="text-lg font-bold text-blue-600">
                ₹{Math.max(...Object.values(predictions.predictions).map((p) => p.close)).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Lowest Price</p>
              <p className="text-lg font-bold text-red-600">
                ₹{Math.min(...Object.values(predictions.predictions).map((p) => p.close)).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Age</p>
              <p className="text-lg font-bold text-amber-600">{formatDataAge(dataAge)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionChart;
