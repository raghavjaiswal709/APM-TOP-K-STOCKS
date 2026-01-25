import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown } from 'lucide-react';
import { HistoricalMarketNews } from "./HistoricalMarketNews";
import { SthitiCluster, SthitiPrediction } from '@/lib/historicalSthitiService';

interface MarketData {
    ltp: number;
    change?: number;
    changePercent?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    timestamp: number;
}

interface AnalysisPanelProps {
    selectedCompany: string | null;
    currentData: MarketData | null;
    overallSentiment: string;
    sthitiPrediction: SthitiPrediction | null;
    loadingSthitiPrediction: boolean;
    sthitiPositiveClusters: SthitiCluster[];
    sthitiNegativeClusters: SthitiCluster[];
    sthitiNeutralClusters: SthitiCluster[];
    loadingSthitiClusters: boolean;
    selectedDate: string | null;
}

export function AnalysisPanel({
    selectedCompany,
    currentData,
    overallSentiment,
    sthitiPrediction,
    loadingSthitiPrediction,
    sthitiPositiveClusters,
    sthitiNegativeClusters,
    sthitiNeutralClusters,
    loadingSthitiClusters,
    selectedDate
}: AnalysisPanelProps) {

    // Format helpers
    const formatPrice = (price?: number) => price?.toFixed(2) || '0.00';
    const formatChange = (change?: number, percent?: number) => {
        if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
    };
    const getChangeClass = (change?: number) => {
        if (!change && change !== 0) return '';
        return change >= 0 ? 'text-green-500' : 'text-red-500';
    };

    const getSentimentStyle = (sentiment: string) => {
        switch (sentiment.toUpperCase()) {
            case 'POSITIVE':
                return {
                    background: 'bg-green-500/10 border-green-500/40',
                    text: 'text-green-500',
                    label: 'Overall Sentiment: Positive',
                };
            case 'NEGATIVE':
                return {
                    background: 'bg-red-500/10 border-red-500/40',
                    text: 'text-red-500',
                    label: 'Overall Sentiment: Negative',
                };
            default:
                return {
                    background: 'bg-zinc-500/10 border-zinc-500/40',
                    text: 'text-zinc-500',
                    label: 'Overall Sentiment: Neutral',
                };
        }
    };

    if (!selectedCompany || !currentData) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-muted-foreground">
                <p>Select a company to view analysis</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{selectedCompany}</h2>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Historical
                </Badge>
            </div>

            <div className="text-3xl font-bold">₹{formatPrice(currentData.ltp)}</div>
            <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                {formatChange(currentData.change, currentData.changePercent)}
            </div>

            {/* Sentiment Display */}
            {(() => {
                const style = getSentimentStyle(overallSentiment);
                return (
                    <div className={`mt-3 p-3 rounded-lg border ${style.background}`}>
                        <span className={`text-sm font-medium ${style.text}`}>
                            {style.label}
                        </span>
                    </div>
                );
            })()}

            {/* Price Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-muted/30 p-3 rounded border">
                    <div className="text-xs text-muted-foreground">Open</div>
                    <div className="text-lg">₹{formatPrice(currentData.open)}</div>
                </div>
                <div className="bg-muted/30 p-3 rounded border">
                    <div className="text-xs text-muted-foreground">Close</div>
                    <div className="text-lg">₹{formatPrice(currentData.close)}</div>
                </div>
                <div className="bg-muted/30 p-3 rounded border">
                    <div className="text-xs text-muted-foreground">High</div>
                    <div className="text-lg text-green-500">₹{formatPrice(currentData.high)}</div>
                </div>
                <div className="bg-muted/30 p-3 rounded border">
                    <div className="text-xs text-muted-foreground">Low</div>
                    <div className="text-lg text-red-500">₹{formatPrice(currentData.low)}</div>
                </div>
            </div>

            <div className="mt-6 border-t pt-4">
                <div className="grid grid-cols-2 gap-y-2">
                    <div>
                        <div className="text-xs text-muted-foreground">Volume</div>
                        <div>{currentData.volume?.toLocaleString() || '0'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Updated</div>
                        <div className="text-blue-500">
                            {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============ STHITI INTELLIGENCE WIDGETS ============ */}

            {/* AI Prediction Widget */}
            {loadingSthitiPrediction ? (
                <div className="text-center text-muted-foreground text-sm mt-4">Loading predictions...</div>
            ) : sthitiPrediction ? (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 mt-4">
                    <CardContent className="p-3">
                        <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🤖 AI Prediction</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sentiment:</span>
                                <span className={getSentimentStyle(sthitiPrediction.sentiment).text}>
                                    {sthitiPrediction.sentiment}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Confidence:</span>
                                <Badge
                                    variant="outline"
                                    className={`text-xs ${sthitiPrediction.confidence === 'HIGH'
                                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                        : sthitiPrediction.confidence === 'MEDIUM'
                                            ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400'
                                        }`}
                                >
                                    {sthitiPrediction.confidence}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Score:</span>
                                <span>{typeof sthitiPrediction.score === 'number' ? sthitiPrediction.score.toFixed(2) : sthitiPrediction.score}</span>
                            </div>
                            {sthitiPrediction.headlines_analyzed !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Headlines:</span>
                                    <span>{sthitiPrediction.headlines_analyzed}</span>
                                </div>
                            )}
                            <div className="mt-2 pt-2 border-t text-muted-foreground">
                                <p className="text-xs">{sthitiPrediction.reasoning}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {/* Sentiment Clusters */}
            {!loadingSthitiClusters && (sthitiPositiveClusters.length > 0 || sthitiNegativeClusters.length > 0 || sthitiNeutralClusters.length > 0) && (
                <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground">Market Sentiment</h4>

                    {sthitiPositiveClusters.length > 0 && (
                        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                        Positive ({sthitiPositiveClusters.length})
                                    </span>
                                </div>
                                <ScrollArea className="h-[100px]">
                                    {sthitiPositiveClusters.map((cluster, i) => (
                                        <div key={i} className="text-xs text-muted-foreground mb-1">
                                            • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                        </div>
                                    ))}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    {sthitiNegativeClusters.length > 0 && (
                        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                        Negative ({sthitiNegativeClusters.length})
                                    </span>
                                </div>
                                <ScrollArea className="h-[100px]">
                                    {sthitiNegativeClusters.map((cluster, i) => (
                                        <div key={i} className="text-xs text-muted-foreground mb-1">
                                            • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                        </div>
                                    ))}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    {sthitiNeutralClusters.length > 0 && (
                        <Card className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                                        Neutral ({sthitiNeutralClusters.length})
                                    </span>
                                </div>
                                <ScrollArea className="h-[80px]">
                                    {sthitiNeutralClusters.map((cluster, i) => (
                                        <div key={i} className="text-xs text-muted-foreground mb-1">
                                            • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                        </div>
                                    ))}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Market News Widget */}
            {selectedCompany && selectedDate && (
                <div className="mt-4">
                    <HistoricalMarketNews
                        symbol={selectedCompany}
                        date={selectedDate}
                    />
                </div>
            )}
        </div>
    );
}
