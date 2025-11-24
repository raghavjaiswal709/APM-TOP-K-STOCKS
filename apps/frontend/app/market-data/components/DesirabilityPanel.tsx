'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, XCircle, Info } from 'lucide-react';
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

export function DesirabilityPanel({ score, classification, loading, onFetch, data }: DesirabilityPanelProps) {
    const config = getScoreConfig(score);

    return (
        <Card className="bg-zinc-800 border-zinc-700 h-full flex flex-col">
            <CardHeader className="pb-2 px-4 pt-3 flex flex-row items-center justify-between space-y-0">
            </CardHeader>
            <CardContent className="space-y-2 flex-1">
                {loading ? (
                    <div className="">
                        <div className="h-12 bg-zinc-700/50 rounded animate-pulse" />
                        <div className="h-6 bg-zinc-700/50 rounded animate-pulse" />
                        <div className="h-14 bg-zinc-700/50 rounded animate-pulse" />
                    </div>
                ) : (
                    <>
                        {/* Score Display - Compact */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 justify-between w-full">
                                <div className='flex items-center gap-2'>
                                    <div className={`text-3xl font-bold ${config.color}`}>
                                        {score !== null ? `${Math.round(score * 100)}%` : 'N/A'}
                                    </div>

                                    <div
                                        className={`px-2 py-1 rounded text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
                                    >
                                        {config.label}
                                    </div>
                                </div>
                                {/* <button
                                    onClick={onFetch}
                                    disabled={loading}
                                    className="px-2 py-1 text-xs bg-[#dbeafe] hover:bg-[#c0e0ff] text-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Analyzing...' : 'Fetch'}
                                </button> */}
                            </div>
                        </div>

                        {/* Description - Compact */}
                        <div className={`p-2 rounded border ${config.bgColor} ${config.borderColor}`}>
                            <p className="text-xs text-zinc-300 leading-snug">
                                {config.description}
                            </p>
                        </div>

                        {/* Detailed Metrics Grid */}
                        {data?.details && (
                            <div className="pt-2 border-t border-zinc-700">
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
