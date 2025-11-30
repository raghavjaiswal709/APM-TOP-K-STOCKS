'use client';

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { ClusterInfo, ClusterPatternData } from '@/hooks/useClusterPattern';
import { TrendingUp, Calendar, Target, BarChart3 } from 'lucide-react';

interface ClusterChartProps {
    symbol: string;
    clusterInfo: ClusterInfo | null;
    patternData: ClusterPatternData[];
    loading: boolean;
    error: string | null;
    height?: number;
}

export const ClusterChart: React.FC<ClusterChartProps> = ({
    symbol,
    clusterInfo,
    patternData,
    loading,
    error,
    height = 600,
}) => {
    const chartData = useMemo(() => {
        if (!patternData || patternData.length === 0) return [];

        const timeLabels = patternData.map((point) => {
            const totalMinutes = point.timestamp;
            const hours = Math.floor(totalMinutes / 60) + 9;
            const minutes = (totalMinutes % 60) + 15;
            const adjustedHours = minutes >= 60 ? hours + 1 : hours;
            const adjustedMinutes = minutes >= 60 ? minutes - 60 : minutes;
            return `${adjustedHours.toString().padStart(2, '0')}:${adjustedMinutes
                .toString()
                .padStart(2, '0')}`;
        });

        const priceTrace = {
            x: timeLabels,
            y: patternData.map((p) => p.normClose * 100),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'Cluster Pattern',
            line: {
                color: '#8B5CF6',
                width: 3,
            },
            hovertemplate: '<b>Time:</b> %{x}<br><b>Change:</b> %{y:.2f}%<extra></extra>',
        };

        const upperBand = {
            x: timeLabels,
            y: patternData.map((p) => (p.normClose + 0.005) * 100),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'Upper Band',
            line: { color: 'rgba(139, 92, 246, 0.2)', width: 0 },
            showlegend: false,
            hoverinfo: 'skip' as const,
        };

        const lowerBand = {
            x: timeLabels,
            y: patternData.map((p) => (p.normClose - 0.005) * 100),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'Lower Band',
            fill: 'tonexty' as const,
            fillcolor: 'rgba(139, 92, 246, 0.1)',
            line: { color: 'rgba(139, 92, 246, 0.2)', width: 0 },
            showlegend: false,
            hoverinfo: 'skip' as const,
        };

        return [lowerBand, upperBand, priceTrace];
    }, [patternData]);

    const layout = useMemo(
        () => ({
            title: {
                text: `<b>Cluster Pattern Analysis</b><br><sub>${symbol} | Cluster ID: ${clusterInfo?.clusterId || 'N/A'} | Based on ${clusterInfo?.nDays || 0} Days</sub>`,
                font: { size: 18, color: '#FFFFFF' },
            },
            xaxis: {
                title: 'Time (IST)',
                color: '#9CA3AF',
                gridcolor: '#374151',
                tickangle: -45,
                nticks: 15,
            },
            yaxis: {
                title: 'Normalized Change (%)',
                color: '#9CA3AF',
                gridcolor: '#374151',
                zeroline: true,
                zerolinecolor: '#6B7280',
                zerolinewidth: 2,
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#E5E7EB' },
            height: height,
            margin: { l: 60, r: 40, t: 100, b: 80 },
            hovermode: 'x unified' as const,
            showlegend: true,
            legend: {
                x: 0.01,
                y: 0.99,
                bgcolor: 'rgba(31, 41, 55, 0.8)',
                bordercolor: '#4B5563',
                borderwidth: 1,
            },
        }),
        [symbol, clusterInfo, height]
    );

    const config = useMemo(
        () => ({
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
        }),
        []
    );

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="text-gray-400">Loading cluster pattern...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3 max-w-md">
                    <div className="text-red-500 text-4xl">⚠️</div>
                    <p className="text-red-400 font-medium">{error}</p>
                    <p className="text-gray-500 text-sm">
                        Make sure the microservices on ports 8508 and 8505 are running.
                    </p>
                </div>
            </div>
        );
    }

    if (!patternData || patternData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="text-gray-600 text-4xl">📊</div>
                    <p className="text-gray-400">No cluster pattern data available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full rounded-lg overflow-hidden">
            {clusterInfo && (
                <div className="grid grid-cols-4 gap-3 p-4 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-2 bg-purple-900/20 p-3 rounded-lg border border-purple-500/30">
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                        <div>
                            <p className="text-xs text-gray-400">Desirability</p>
                            <p className="text-lg font-bold text-purple-300">
                                {(clusterInfo.desirabilityScore * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-900/20 p-3 rounded-lg border border-blue-500/30">
                        <Target className="h-5 w-5 text-blue-400" />
                        <div>
                            <p className="text-xs text-gray-400">Reoccurrence</p>
                            <p className="text-lg font-bold text-blue-300">
                                {(clusterInfo.reoccurrenceProbability * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        <div>
                            <p className="text-xs text-gray-400">Strength</p>
                            <p className="text-lg font-bold text-green-300">
                                {(clusterInfo.strengthScore * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-900/20 p-3 rounded-lg border border-amber-500/30">
                        <Calendar className="h-5 w-5 text-amber-400" />
                        <div>
                            <p className="text-xs text-gray-400">Sample Size</p>
                            <p className="text-lg font-bold text-amber-300">{clusterInfo.nDays} Days</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 w-full" style={{ height: height }}>
                <Plot
                    data={chartData as any}
                    layout={{ ...layout, autosize: true, width: undefined }}
                    config={config}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        </div>
    );
};

export default ClusterChart;
