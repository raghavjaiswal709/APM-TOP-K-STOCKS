'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, XCircle } from 'lucide-react';

interface DesirabilityPanelProps {
    score: number | null;
    classification: string | null;
    loading: boolean;
    onFetch: () => void;
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
            description: 'Strong long opportunity with high confidence',
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
            description: 'Good opportunity with favorable conditions',
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
            description: 'Marginal opportunity with mixed signals',
            Icon: AlertTriangle,
        };
    }

    return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/40',
        textColor: 'text-red-300',
        label: 'Not Desirable',
        description: 'Weak structure - avoid or consider inverse',
        Icon: TrendingDown,
    };
}

export function DesirabilityPanel({ score, classification, loading, onFetch }: DesirabilityPanelProps) {
    const config = getScoreConfig(score);
    const Icon = config.Icon;

    return (
        <Card className="bg-zinc-800 border-zinc-700 h-full flex flex-col">
            <CardHeader className="pb-2 px-4 pt-3 flex flex-row items-center justify-between space-y-0">
                {/* <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    Market Desirability
                </CardTitle> */}

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
                                <button
                                    onClick={onFetch}
                                    disabled={loading}
                                    className="px-2 py-1 text-xs bg-[#dbeafe] hover:bg-[#c0e0ff] text-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Analyzing...' : 'Fetch'}
                                </button>
                            </div>
                        </div>

                        {/* Description - Compact */}
                        <div className={`p-2 rounded border ${config.bgColor} ${config.borderColor}`}>
                            <p className="text-xs text-zinc-300 leading-snug">
                                {config.description}
                            </p>
                        </div>

                        {/* Additional Info - Compact Grid */}
                        {score !== null && (
                            <div className="pt-2 border-t border-zinc-700">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Method:</span>
                                        <span className="text-zinc-400">Spectral</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Confidence:</span>
                                        <span className={`${config.textColor} font-medium`}>
                                            {score >= 0.70 ? 'High' : score >= 0.50 ? 'Med' : 'Low'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
