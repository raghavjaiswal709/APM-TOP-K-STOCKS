// apps/frontend/app/recommendation-list/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AppSidebar } from "@/app/components/app-sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/app/components/toggleButton";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Database, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTimeMachine } from '@/hooks/useTimeMachine';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Dynamic imports
const PlotlyChart = dynamic(() => import('../market-data/components/charts/PlotlyChart'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <div className="animate-pulse text-blue-500">Loading Time Machine...</div>
        </div>
    )
});

interface MarketData {
    symbol: string;
    ltp: number;
    change?: number;
    changePercent?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    bid?: number;
    ask?: number;
    timestamp: number;
}

const RecommendationListPage: React.FC = () => {
    const [isClient, setIsClient] = useState(false);

    const {
        availableDates,
        selectedDate,
        availableCompanies,
        selectedCompany,
        priceData,
        chartImages,
        positiveClusters,
        negativeClusters,
        neutralClusters,
        headlines,
        predictions,
        loadingDates,
        loadingCompanies,
        loadingPriceData,
        loadingCharts,
        loadingClusters,
        loadingHeadlines,
        loadingPredictions,
        setSelectedDate,
        setSelectedCompany,
    } = useTimeMachine();

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    // Convert price data to MarketData format
    const currentData = useMemo<MarketData | null>(() => {
        if (!priceData) return null;

        return {
            symbol: priceData.symbol || selectedCompany || '',
            ltp: priceData.ltp,
            change: priceData.ltp - priceData.prev_close_price,
            changePercent: ((priceData.ltp - priceData.prev_close_price) / priceData.prev_close_price) * 100,
            open: priceData.open_price,
            high: priceData.high_price,
            low: priceData.low_price,
            close: priceData.ltp,
            volume: priceData.vol_traded_today,
            bid: priceData.bid_price,
            ask: priceData.ask_price,
            timestamp: priceData.timestamp,
        };
    }, [priceData, selectedCompany]);

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

    // Overall sentiment calculation
    const overallSentiment = useMemo(() => {
        if (predictions) {
            return predictions.sentiment || 'NEUTRAL';
        }

        const positiveCount = positiveClusters.length;
        const negativeCount = negativeClusters.length;

        if (positiveCount > negativeCount) return 'POSITIVE';
        if (negativeCount > positiveCount) return 'NEGATIVE';
        return 'NEUTRAL';
    }, [predictions, positiveClusters, negativeClusters]);

    const getSentimentStyle = (sentiment: string) => {
        switch (sentiment.toUpperCase()) {
            case 'POSITIVE':
                return {
                    background: 'bg-gradient-to-r from-green-500/10 to-green-900/10 border-green-500/40',
                    text: 'text-green-400',
                    label: 'Overall Sentiment: Positive',
                };
            case 'NEGATIVE':
                return {
                    background: 'bg-gradient-to-r from-red-500/10 to-red-900/10 border-red-500/40',
                    text: 'text-red-400',
                    label: 'Overall Sentiment: Negative',
                };
            default:
                return {
                    background: 'bg-gradient-to-r from-zinc-500/30 to-zinc-600/20 border-zinc-500/40',
                    text: 'text-zinc-400',
                    label: 'Overall Sentiment: Neutral',
                };
        }
    };

    if (!isClient) {
        return (
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 w-full">
                        <div className="flex items-center gap-2 px-4">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>Loading Time Machine...</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                        <div className="flex items-center justify-center h-[80vh]">
                            <div className="text-xl animate-pulse">Initializing Time Machine...</div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 w-full">
                    <div className="flex items-center gap-2 px-4 w-full">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb className="flex items-center justify-between w-full">
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>📅 Historical Data Time Machine</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                            <ModeToggle />
                        </Breadcrumb>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    {/* Selection Controls */}
                    <Card className="w-full">
                        <CardContent className="p-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-blue-500" />
                                        Time Machine Controls
                                    </h3>
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                                        Historical Mode
                                    </Badge>
                                </div>

                                <div className="flex gap-4 items-center">
                                    {/* Date Picker */}
                                    <div className="flex-1">
                                        <label className="text-sm text-zinc-400 mb-2 block">Select Date</label>
                                        <Select
                                            value={selectedDate || ''}
                                            onValueChange={setSelectedDate}
                                            disabled={loadingDates}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={loadingDates ? "Loading dates..." : "Select a date"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <ScrollArea className="h-[200px]">
                                                    {availableDates.map((date) => (
                                                        <SelectItem key={date} value={date}>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-blue-400" />
                                                                {new Date(date).toLocaleDateString('en-IN', {
                                                                    weekday: 'short',
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </ScrollArea>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Company Picker */}
                                    <div className="flex-1">
                                        <label className="text-sm text-zinc-400 mb-2 block">Select Company</label>
                                        <Select
                                            value={selectedCompany || ''}
                                            onValueChange={setSelectedCompany}
                                            disabled={loadingCompanies || !selectedDate}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={loadingCompanies ? "Loading companies..." : "Select a company"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <ScrollArea className="h-[200px]">
                                                    {availableCompanies.map((company) => (
                                                        <SelectItem key={company} value={company}>
                                                            {company}
                                                        </SelectItem>
                                                    ))}
                                                </ScrollArea>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {selectedDate && (
                                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                                        <Database className="h-3 w-3" />
                                        Viewing historical data from {new Date(selectedDate).toLocaleDateString()} •
                                        {availableCompanies.length} companies available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Main Content */}
                    <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
                        <div className="w-full p-4">
                            <div className="flex gap-6 mb-6">
                                {/* Chart Area */}
                                <div className="w-3/4">
                                    <div className="bg-zinc-800 rounded-lg shadow-lg h-[800px]">
                                        {!selectedCompany ? (
                                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                                <Database className="h-16 w-16 text-zinc-600 mb-4" />
                                                <h3 className="text-xl font-semibold text-zinc-400">Select Date & Company</h3>
                                                <p className="text-zinc-500 max-w-md text-center">
                                                    Choose a date and company from the dropdowns above to view historical market data
                                                </p>
                                            </div>
                                        ) : loadingPriceData ? (
                                            <div className="h-full flex items-center justify-center">
                                                <div className="text-center space-y-2">
                                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                                    <p className="text-zinc-400">Loading historical data for {selectedCompany}...</p>
                                                </div>
                                            </div>
                                        ) : currentData ? (
                                            <div className="w-full h-full p-4">
                                                <div className="text-center space-y-2 bg-zinc-900 p-6 rounded-lg">
                                                    <h3 className="text-2xl font-bold text-white">{selectedCompany}</h3>
                                                    <div className="text-4xl font-bold text-white">₹{formatPrice(currentData.ltp)}</div>
                                                    <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                                                        {formatChange(currentData.change, currentData.changePercent)}
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-4 mt-4">
                                                        <div className="bg-zinc-800 p-3 rounded">
                                                            <div className="text-xs text-zinc-400">Open</div>
                                                            <div className="text-lg text-white">₹{formatPrice(currentData.open)}</div>
                                                        </div>
                                                        <div className="bg-zinc-800 p-3 rounded">
                                                            <div className="text-xs text-zinc-400">High</div>
                                                            <div className="text-lg text-green-400">₹{formatPrice(currentData.high)}</div>
                                                        </div>
                                                        <div className="bg-zinc-800 p-3 rounded">
                                                            <div className="text-xs text-zinc-400">Low</div>
                                                            <div className="text-lg text-red-400">₹{formatPrice(currentData.low)}</div>
                                                        </div>
                                                        <div className="bg-zinc-800 p-3 rounded">
                                                            <div className="text-xs text-zinc-400">Volume</div>
                                                            <div className="text-lg text-white">{currentData.volume?.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Chart Images Display */}
                                                {loadingCharts ? (
                                                    <div className="mt-6 text-center text-zinc-400">Loading charts...</div>
                                                ) : chartImages.length > 0 ? (
                                                    <div className="mt-6 space-y-4">
                                                        <h4 className="text-lg font-semibold text-white">Sthiti Analysis Charts</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {chartImages.slice(0, 4).map((imageUrl, idx) => (
                                                                <div key={idx} className="bg-zinc-900 rounded-lg overflow-hidden">
                                                                    <img
                                                                        src={imageUrl}
                                                                        alt={`Chart ${idx + 1}`}
                                                                        className="w-full h-auto"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center">
                                                <div className="text-center text-red-400">
                                                    <p>No data available for this selection</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar */}
                                <div className="w-1/4 bg-zinc-800 p-4 rounded-lg shadow-lg max-h-[800px] overflow-y-auto">
                                    {currentData ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-semibold text-white">{selectedCompany}</h2>
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-400">Historical</Badge>
                                            </div>

                                            <div className="text-3xl font-bold text-white">₹{formatPrice(currentData.ltp)}</div>
                                            <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                                                {formatChange(currentData.change, currentData.changePercent)}
                                            </div>

                                            {/* Sentiment Display */}
                                            {(() => {
                                                const style = getSentimentStyle(overallSentiment);
                                                return (
                                                    <div className={`mt-3 p-3 rounded-lg border-2 ${style.background} backdrop-blur-sm`}>
                                                        <span className={`text-sm font-medium ${style.text}`}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                            {/* Predictions */}
                                            {loadingPredictions ? (
                                                <div className="text-center text-zinc-400 text-sm">Loading predictions...</div>
                                            ) : predictions ? (
                                                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
                                                    <h3 className="text-sm font-semibold text-white mb-2">AI Prediction</h3>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-zinc-400">Sentiment:</span>
                                                            <span className={getSentimentStyle(predictions.sentiment).text}>
                                                                {predictions.sentiment}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-zinc-400">Confidence:</span>
                                                            <span className="text-white">{(predictions.confidence * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-zinc-400">Score:</span>
                                                            <span className="text-white">{predictions.score.toFixed(2)}</span>
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-zinc-700">
                                                            <p className="text-xs text-zinc-400">{predictions.reasoning}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Headlines */}
                                            {loadingHeadlines ? (
                                                <div className="text-center text-zinc-400 text-sm">Loading headlines...</div>
                                            ) : headlines.length > 0 ? (
                                                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
                                                    <h3 className="text-sm font-semibold text-white mb-3">Market Headlines ({headlines.length})</h3>
                                                    <ScrollArea className="h-[200px]">
                                                        <div className="space-y-3">
                                                            {headlines.map((headline, idx) => (
                                                                <div key={idx} className="text-xs pb-3 border-b border-zinc-800 last:border-0">
                                                                    <p className="text-zinc-300 mb-1">{headline.text}</p>
                                                                    <div className="flex items-center gap-2 text-zinc-500">
                                                                        <span>{new Date(headline.timestamp).toLocaleTimeString()}</span>
                                                                        <span>•</span>
                                                                        <span className={getSentimentStyle(headline.gpt4o_sentiment).text}>
                                                                            {headline.gpt4o_sentiment}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            ) : null}

                                            {/* Clusters Summary */}
                                            {loadingClusters ? (
                                                <div className="text-center text-zinc-400 text-sm">Loading sentiment clusters...</div>
                                            ) : (positiveClusters.length > 0 || negativeClusters.length > 0 || neutralClusters.length > 0) ? (
                                                <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
                                                    <h3 className="text-sm font-semibold text-white mb-3">Sentiment Clusters</h3>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-green-400">Positive:</span>
                                                            <span className="text-white">{positiveClusters.length}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-red-400">Negative:</span>
                                                            <span className="text-white">{negativeClusters.length}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-zinc-400">Neutral:</span>
                                                            <span className="text-white">{neutralClusters.length}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                            <Database className="h-12 w-12 text-zinc-600" />
                                            <p className="text-zinc-500 text-sm">
                                                Select a company to view historical data and analysis
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
};

export default RecommendationListPage;
