'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, XCircle, Info, RefreshCw } from 'lucide-react';
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

export function DesirabilityPanel({ score, classification, loading, onFetch, data }: DesirabilityPanelProps) {
    const desirabilityConfig = getScoreConfig(score);
    const reoccurrenceProbability = data?.top_pattern?.reoccurrence_probability ?? null;
    const reoccurrenceConfig = getReoccurrenceConfig(reoccurrenceProbability);

    return (
        <Card className="bg-zinc-800 border-zinc-700 h-full flex flex-col">
            <CardHeader className="pb-3 px-4 pt-4 flex flex-row items-center justify-between space-y-0">
                <h3 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Pattern Metrics</h3>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 px-4 pb-4">
                {loading ? (
                    <div className="space-y-3">
                        <div className="h-24 bg-zinc-700/50 rounded-lg animate-pulse" />
                        <div className="h-24 bg-zinc-700/50 rounded-lg animate-pulse" />
                        <div className="h-16 bg-zinc-700/50 rounded-lg animate-pulse" />
                    </div>
                ) : (
                    <>
                        {/* Split Grid: Desirability (Left) | Reoccurrence (Right) */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* LEFT: Desirability */}
                            <div className={`p-3 rounded-lg border-2 ${desirabilityConfig.bgColor} ${desirabilityConfig.borderColor} space-y-2`}>
                                <div className="flex items-center justify-between">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-1 cursor-help">
                                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Desirability</span>
                                                    <Info className="w-3 h-3 text-zinc-500" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs">Measures how favorable the pattern is for trading</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <desirabilityConfig.Icon className={`w-4 h-4 ${desirabilityConfig.color}`} />
                                </div>
                                <div className={`text-2xl font-bold ${desirabilityConfig.color}`}>
                                    {score !== null ? `${Math.round(score * 100)}%` : 'N/A'}
                                </div>
                                <div
                                    className={`px-2 py-1 rounded text-xs font-medium border ${desirabilityConfig.bgColor} ${desirabilityConfig.textColor} ${desirabilityConfig.borderColor}`}
                                >
                                    {desirabilityConfig.label}
                                </div>
                            </div>

                            {/* RIGHT: Reoccurrence */}
                            <div className={`p-3 rounded-lg border-2 ${reoccurrenceConfig.bgColor} ${reoccurrenceConfig.borderColor} space-y-2`}>
                                <div className="flex items-center justify-between">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-1 cursor-help">
                                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Reoccurrence</span>
                                                    <Info className="w-3 h-3 text-zinc-500" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs">Probability that this pattern will repeat in the future</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <reoccurrenceConfig.Icon className={`w-4 h-4 ${reoccurrenceConfig.color}`} />
                                </div>
                                <div className={`text-2xl font-bold ${reoccurrenceConfig.color}`}>
                                    {reoccurrenceProbability !== null ? `${(reoccurrenceProbability * 100).toFixed(1)}%` : 'N/A'}
                                </div>
                                <div
                                    className={`px-2 py-1 rounded text-xs font-medium border ${reoccurrenceConfig.bgColor} ${reoccurrenceConfig.textColor} ${reoccurrenceConfig.borderColor}`}
                                >
                                    {reoccurrenceConfig.label}
                                </div>
                            </div>
                        </div>

                        {/* Description Cards */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className={`p-2 rounded-md border ${desirabilityConfig.bgColor} ${desirabilityConfig.borderColor}`}>
                                <p className="text-xs text-zinc-300 leading-snug">
                                    {desirabilityConfig.description}
                                </p>
                            </div>
                            <div className={`p-2 rounded-md border ${reoccurrenceConfig.bgColor} ${reoccurrenceConfig.borderColor}`}>
                                <p className="text-xs text-zinc-300 leading-snug">
                                    {reoccurrenceConfig.description}
                                </p>
                            </div>
                        </div>

                        {/* Detailed Metrics Grid */}
                        {data?.details && (
                            <div className="pt-3 border-t border-zinc-700">
                                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Technical Details</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <MetricRow label="Trend Strength" value={data.details.trend_strength} tooltip="Overall strength of the trend (0-1)" />
                                    <MetricRow label="Recovery" value={data.details.recovery_time_minutes} suffix="m" tooltip="Time to recover from dips" />
                                    <MetricRow label="Drawdown" value={data.details.max_drawdown} suffix="%" tooltip="Maximum percentage drop" />
                                    <MetricRow label="Slope" value={data.details.slope} tooltip="Normalized price slope" />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function MetricRow({ label, value, suffix = '', tooltip }: { label: string, value: number | null | undefined, suffix?: string, tooltip: string }) {
    if (value === null || value === undefined) return null;

    const displayValue = typeof value === 'number'
        ? (Math.abs(value) < 0.01 && value !== 0 ? value.toExponential(1) : value.toFixed(2))
        : value;

    return (
        <div className="flex justify-between items-center group">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 cursor-help">
                            <span className="text-zinc-500">{label}</span>
                            <Info className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <span className="text-zinc-300 font-medium">
                {displayValue}{suffix}
            </span>
        </div>
    );
}
