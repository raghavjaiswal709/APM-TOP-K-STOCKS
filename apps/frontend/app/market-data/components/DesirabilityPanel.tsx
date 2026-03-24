// @ts-nocheck
'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { DesirabilityData } from '@/hooks/useDesirability';

interface DesirabilityPanelProps {
    score: number | null;
    classification: string | null;
    loading: boolean;
    onFetch: () => void;
    data: DesirabilityData | null;
}

interface ScoreConfig {
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    label: string;
    description: string;
    Icon: React.ElementType;
}

function getScoreConfig(score: number | null): ScoreConfig {
    if (score === null) {
        return {
            color: 'text-zinc-400',
            bgColor: 'bg-zinc-500/10',
            borderColor: 'border-zinc-500/40',
            textColor: 'text-zinc-400',
            label: 'N/A',
            description: 'Score unavailable',
            Icon: XCircle,
        };
    }

    if (score >= 0.70) {
        return {
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/40',
            textColor: 'text-green-300',
            label: 'Highly Desirable',
            description: 'Strong long opportunity',
            Icon: TrendingUp,
        };
    }

    if (score >= 0.50) {
        return {
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/40',
            textColor: 'text-yellow-300',
            label: 'Moderately Desirable',
            description: 'Good opportunity',
            Icon: TrendingUp,
        };
    }

    if (score >= 0.30) {
        return {
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/10',
            borderColor: 'border-orange-500/40',
            textColor: 'text-orange-300',
            label: 'Acceptable',
            description: 'Marginal opportunity',
            Icon: AlertTriangle,
        };
    }

    return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/40',
        textColor: 'text-red-300',
        label: 'Not Desirable',
        description: 'Weak structure',
        Icon: TrendingDown,
    };
}

function getReoccurrenceConfig(probability: number | null): ScoreConfig {
    if (probability === null) {
        return {
            color: 'text-zinc-400',
            bgColor: 'bg-zinc-500/10',
            borderColor: 'border-zinc-500/40',
            textColor: 'text-zinc-400',
            label: 'N/A',
            description: 'Data unavailable',
            Icon: XCircle,
        };
    }

    if (probability >= 0.70) {
        return {
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/40',
            textColor: 'text-blue-300',
            label: 'High Probability',
            description: 'Pattern repeats frequently',
            Icon: RefreshCw,
        };
    }

    if (probability >= 0.50) {
        return {
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/40',
            textColor: 'text-cyan-300',
            label: 'Moderate Probability',
            description: 'Pattern repeats occasionally',
            Icon: RefreshCw,
        };
    }

    if (probability >= 0.30) {
        return {
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-500/10',
            borderColor: 'border-indigo-500/40',
            textColor: 'text-indigo-300',
            label: 'Low Probability',
            description: 'Pattern repeats infrequently',
            Icon: AlertTriangle,
        };
    }

    return {
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/40',
        textColor: 'text-purple-300',
        label: 'Very Low Probability',
        description: 'Pattern rarely repeats',
        Icon: TrendingDown,
    };
}

export const DesirabilityPanel = React.memo(function DesirabilityPanel({ score, classification, loading, onFetch, data }: DesirabilityPanelProps) {
    const desirabilityConfig = getScoreConfig(score);
    const reoccurrenceProbability = data?.top_pattern?.reoccurrence_probability ?? null;
    const reoccurrenceConfig = getReoccurrenceConfig(reoccurrenceProbability);
    const details = data?.top_pattern?.details;

    // Format detail values for tooltip
    const formatValue = (val: number | null | undefined, multiplier = 1, suffix = '') => {
        if (val === null || val === undefined) return 'N/A';
        const adjusted = val * multiplier;
        return `${adjusted.toFixed(2)}${suffix}`;
    };

    return (
        <Card className="bg-zinc-800 border-zinc-700 h-full flex flex-col">
            <CardHeader className="pb-3 px-4 pt-4 flex flex-row items-center justify-between space-y-0">
                <h3 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Pattern Metrics</h3>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 px-4 pb-4">
                {loading ? (
                    <div className="space-y-3">
                        <div className="h-32 bg-zinc-700/50 rounded-lg animate-pulse" />
                        <div className="h-32 bg-zinc-700/50 rounded-lg animate-pulse" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {/* LEFT: Desirability Card with Detailed Tooltip */}
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={`p-4 rounded-lg border-2 ${desirabilityConfig.bgColor} ${desirabilityConfig.borderColor} space-y-3 cursor-help transition-all hover:scale-[1.02] hover:shadow-lg`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Desirability</span>
                                            <desirabilityConfig.Icon className={`w-5 h-5 ${desirabilityConfig.color}`} />
                                        </div>
                                        <div className={`text-3xl font-bold ${desirabilityConfig.color}`}>
                                            {score !== null ? `${Math.round(score * 100)}%` : 'N/A'}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium border inline-block ${desirabilityConfig.bgColor} ${desirabilityConfig.textColor} ${desirabilityConfig.borderColor}`}>
                                            {desirabilityConfig.label}
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-snug">
                                            {desirabilityConfig.description}
                                        </p>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="w-72 p-0">
                                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-zinc-200 border-b border-zinc-700 pb-2">
                                            Desirability Details
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Classification</span>
                                                <span className={`font-medium ${desirabilityConfig.textColor}`}>{classification || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Cluster ID</span>
                                                <span className="text-zinc-200 font-medium">{data?.top_pattern?.cluster_id ?? 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Trend Strength</span>
                                                <span className="text-zinc-200 font-medium">{formatValue(details?.trend_strength)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Max Drawdown</span>
                                                <span className="text-red-400 font-medium">{formatValue(details?.max_drawdown, 100, '%')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Net Change</span>
                                                <span className={`font-medium ${(details?.net_change ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatValue(details?.net_change, 100, '%')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Time Above Open</span>
                                                <span className="text-zinc-200 font-medium">{formatValue(details?.time_above_open_pct, 1, '%')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Volatility</span>
                                                <span className="text-zinc-200 font-medium">{formatValue(details?.pattern_volatility, 100, '%')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Slope</span>
                                                <span className="text-zinc-200 font-medium">{details?.slope?.toExponential(2) ?? 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* RIGHT: Reoccurrence Card with Detailed Tooltip */}
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={`p-4 rounded-lg border-2 ${reoccurrenceConfig.bgColor} ${reoccurrenceConfig.borderColor} space-y-3 cursor-help transition-all hover:scale-[1.02] hover:shadow-lg`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Reoccurrence</span>
                                            <reoccurrenceConfig.Icon className={`w-5 h-5 ${reoccurrenceConfig.color}`} />
                                        </div>
                                        <div className={`text-3xl font-bold ${reoccurrenceConfig.color}`}>
                                            {reoccurrenceProbability !== null ? `${(reoccurrenceProbability * 100).toFixed(1)}%` : 'N/A'}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium border inline-block ${reoccurrenceConfig.bgColor} ${reoccurrenceConfig.textColor} ${reoccurrenceConfig.borderColor}`}>
                                            {reoccurrenceConfig.label}
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-snug">
                                            {reoccurrenceConfig.description}
                                        </p>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="w-72 p-0">
                                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-zinc-200 border-b border-zinc-700 pb-2">
                                            Reoccurrence Details
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Probability</span>
                                                <span className={`font-medium ${reoccurrenceConfig.textColor}`}>
                                                    {reoccurrenceProbability !== null ? `${(reoccurrenceProbability * 100).toFixed(2)}%` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Prediction Date</span>
                                                <span className="text-zinc-200 font-medium">{data?.prediction_date ?? 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Day of Week</span>
                                                <span className="text-zinc-200 font-medium">{data?.day_of_week ?? 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Pattern Length</span>
                                                <span className="text-zinc-200 font-medium">{details?.pattern_length ?? 'N/A'} min</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Recovery Time</span>
                                                <span className="text-zinc-200 font-medium">
                                                    {details?.recovery_time_minutes !== null && details?.recovery_time_minutes !== undefined 
                                                        ? `${details.recovery_time_minutes} min` 
                                                        : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Total Clusters</span>
                                                <span className="text-zinc-200 font-medium">{data?.all_patterns_count ?? 'N/A'}</span>
                                            </div>
                                        </div>
                                        {data?.all_clusters && data.all_clusters.length > 1 && (
                                            <div className="pt-2 border-t border-zinc-700">
                                                <p className="text-xs text-zinc-500">
                                                    Top {Math.min(3, data.all_clusters.length)} predicted clusters by probability
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </CardContent>
        </Card>
    );
});
