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
    syncedTimeRange?: [Date, Date] | undefined;
    syncedSelectedTimeframe?: string;
    updateTrigger?: string;
    onXRangeChange?: (range: [Date, Date]) => void; // ✅ NEW: Emit range changes to parent
}

export const ClusterChart: React.FC<ClusterChartProps> = ({
    symbol,
    clusterInfo,
    patternData,
    loading,
    error,
    height,
    syncedTimeRange,
    syncedSelectedTimeframe,
    updateTrigger,
    onXRangeChange, // ✅ NEW: Callback for range changes
}) => {
    // ✅ Time synchronization effect - responds to Live Market timeline changes
    React.useEffect(() => {
        if (updateTrigger && syncedSelectedTimeframe) {
            console.log(`🔄 [ClusterChart Sync] Update triggered:`, {
                symbol,
                timeframe: syncedSelectedTimeframe,
                trigger: updateTrigger,
                timeRange: syncedTimeRange
            });
        }
    }, [updateTrigger, syncedSelectedTimeframe, syncedTimeRange, symbol]);

    const chartData = useMemo(() => {
        if (!patternData || patternData.length === 0) return [];

        // ✅ CRITICAL: Convert to Date objects for synchronization with PlotlyChart
        const timeLabels = patternData.map((point) => {
            const totalMinutes = point.timestamp;
            const hours = Math.floor(totalMinutes / 60) + 9;
            const minutes = (totalMinutes % 60) + 15;
            const adjustedHours = minutes >= 60 ? hours + 1 : hours;
            const adjustedMinutes = minutes >= 60 ? minutes - 60 : minutes;
            
            // Create Date object for today with the calculated time
            const today = new Date();
            today.setHours(adjustedHours, adjustedMinutes, 0, 0);
            return today;
        });

        const priceTrace = {
            x: timeLabels,
            y: patternData.map((p) => p.normClose * 100),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'Cluster Pattern',
            line: {
                color: '#8b5cf6',
                width: 3,
            },
            hovertemplate: '<b>Time:</b> %{x|%H:%M}<br><b>Change:</b> %{y:.2f}%<extra></extra>',
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
                text: `<b>Cluster Pattern Analysis</b><br><sub>${symbol} | Cluster ID: ${clusterInfo?.clusterId || 'N/A'} | Based on ${clusterInfo?.nDays || 0} Days${syncedSelectedTimeframe ? ` | Synced: ${syncedSelectedTimeframe}` : ''}</sub>`,
                font: { size: 14, color: '#e4e4e7', family: 'Inter, system-ui, sans-serif' },
            },
            xaxis: {
                title: 'Time (IST)',
                type: 'date', // ✅ CRITICAL: Changed from 'category' to 'date'
                color: '#a1a1aa',
                gridcolor: '#27272a',
                linecolor: '#3f3f46',
                tickangle: -45,
                nticks: 15,
                tickformat: '%H:%M', // ✅ Format as time only
                tickfont: { color: '#a1a1aa', size: 11 },
                titlefont: { color: '#d4d4d8', size: 12 },
                ...(syncedTimeRange ? {
                    range: syncedTimeRange, // ✅ Apply synchronized range
                    autorange: false,
                } : {
                    autorange: true,
                }),
                rangeslider: { visible: false },
            },
            yaxis: {
                title: 'Normalized Change (%)',
                color: '#a1a1aa',
                gridcolor: '#27272a',
                linecolor: '#3f3f46',
                zeroline: true,
                zerolinecolor: '#52525b',
                zerolinewidth: 2,
                tickfont: { color: '#a1a1aa', size: 11 },
                titlefont: { color: '#d4d4d8', size: 12 },
            },
            plot_bgcolor: '#18181b',
            paper_bgcolor: '#18181b',
            font: { color: '#e4e4e7', family: 'Inter, system-ui, sans-serif' },
            height: height,
            margin: { l: 60, r: 40, t: 100, b: 80 },
            hovermode: 'x unified' as const,
            showlegend: true,
            legend: {
                x: 0.01,
                y: 0.99,
                bgcolor: 'rgba(39, 39, 42, 0.8)',
                bordercolor: '#52525b',
                borderwidth: 1,
                font: { color: '#e4e4e7' },
            },
        }),
        [symbol, clusterInfo, height, syncedSelectedTimeframe, syncedTimeRange] // ✅ Added syncedTimeRange
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

    // ✅ NEW: Handle relayout events and emit range changes
    const handleRelayout = React.useCallback((eventData: any) => {
        if (onXRangeChange && eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
            const startDate = new Date(eventData['xaxis.range[0]']);
            const endDate = new Date(eventData['xaxis.range[1]']);
            console.log('🔄 [ClusterChart] Emitting range change:', { startDate, endDate });
            onXRangeChange([startDate, endDate]);
        }
    }, [onXRangeChange]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto"></div>
                    <p className="text-sm text-zinc-400">Loading cluster pattern...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3 max-w-md">
                    <div className="text-red-500 text-3xl">⚠️</div>
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                    <p className="text-xs text-zinc-500">
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
                    <div className="text-zinc-700 text-3xl">📊</div>
                    <p className="text-sm text-zinc-400">No cluster pattern data available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col rounded-lg overflow-hidden">
            {/* ✅ CHART FIRST - Takes available space with flex-1 */}
            <div className="flex-1 min-h-0 p-4 w-full">
                <Plot
                    data={chartData as any}
                    layout={{ ...layout, autosize: true, width: undefined, height: height }}
                    config={config}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    onRelayout={handleRelayout} // ✅ NEW: Emit range changes
                />
            </div>

            {/* ✅ METRICS BELOW - Fixed height at bottom */}
            {clusterInfo && (
                <div className="grid grid-cols-4 gap-3 p-4 bg-zinc-900 border-t border-zinc-800">
                    <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <div className="p-2 bg-violet-500/10 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400">Desirability</p>
                            <p className="text-base font-semibold text-zinc-100">
                                {(clusterInfo.desirabilityScore * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Target className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400">Reoccurrence</p>
                            <p className="text-base font-semibold text-zinc-100">
                                {(clusterInfo.reoccurrenceProbability * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <BarChart3 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400">Strength</p>
                            <p className="text-base font-semibold text-zinc-100">
                                {(clusterInfo.strengthScore * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Calendar className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400">Sample Size</p>
                            <p className="text-base font-semibold text-zinc-100">{clusterInfo.nDays} Days</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClusterChart;
