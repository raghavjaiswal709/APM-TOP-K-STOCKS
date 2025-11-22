'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Types ---

interface RegimeAnalysisResponse {
    most_frequent_regime: {
        regime: number;
        frequency: number;
    };
    regime_recurrence: {
        most_recurrent_regime: number;
        recurrence_score: number;
    };
    day_of_week_patterns: {
        [key: string]: { // "Monday", "Tuesday", etc.
            dominant_regime: number;
            confidence: number;
        };
    };
    most_desirable_regime: {
        most_desirable_regime: number;
        score: number;
    };
}

interface MsaxDashboardProps {
    companyCode: string;
    exchange: string;
}

// --- Constants ---

const BASE_IP = 'http://100.93.172.21:6969';
// ✅ PROXY UPDATE: Use local API route to bypass CORS
const MASTER_LIST_URL = '/api/msax?type=master';

// --- Helper Functions ---

const getDayOfWeek = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const dayName = days[today.getDay()];

    // Handle weekends by defaulting to Friday
    if (dayName === 'Saturday' || dayName === 'Sunday') {
        return 'Friday';
    }
    return dayName;
};

// Cache for the master list to avoid spamming Endpoint A
let masterListCache: string[] | null = null;

export const MsaxDashboard: React.FC<MsaxDashboardProps> = ({ companyCode, exchange }) => {
    // State
    const [isValidTicker, setIsValidTicker] = useState<boolean | null>(null); // null = checking
    const [analysisData, setAnalysisData] = useState<RegimeAnalysisResponse | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'frequent' | 'recurrent' | 'day' | 'desirable'>('frequent');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [masterListLoading, setMasterListLoading] = useState<boolean>(false);

    // Image Carousel State
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [imageLoading, setImageLoading] = useState<boolean>(true);

    // 1. Validation (The Gatekeeper)
    useEffect(() => {
        const checkMasterList = async () => {
            if (!companyCode) return;

            // If we already have the cache, check it immediately
            if (masterListCache) {
                const exists = masterListCache.includes(companyCode.toUpperCase());
                setIsValidTicker(exists);
                return;
            }

            setMasterListLoading(true);
            try {
                console.log(`🔍 Checking MSAX Master List for ${companyCode}...`);
                const response = await fetch(MASTER_LIST_URL);
                if (!response.ok) throw new Error('Failed to fetch Master List');

                const text = await response.text();

                // ✅ PRO FIX: Robust parsing strategy
                const tickers = new Set<string>();

                // Regex 1: Capture from href="TICKER/" or href="TICKER"
                const hrefRegex = /href=["']\/?(?:MSAX\/)?([A-Z0-9]+)\/?["']/gi;
                const hrefMatches = [...text.matchAll(hrefRegex)];
                hrefMatches.forEach(m => {
                    if (m[1]) tickers.add(m[1].toUpperCase());
                });

                // Regex 2: Capture from >TICKER/</a> or >TICKER</a>
                const textRegex = />\s*([A-Z0-9]+)\/?\s*<\/a>/gi;
                const textMatches = [...text.matchAll(textRegex)];
                textMatches.forEach(m => {
                    if (m[1]) tickers.add(m[1].toUpperCase());
                });

                const matches = Array.from(tickers);
                masterListCache = matches; // Cache the result

                const targetTicker = companyCode.toUpperCase();
                const exists = matches.includes(targetTicker);

                console.log(`✅ MSAX Master List loaded. Found ${matches.length} tickers.`);

                // Debug: Log close matches if not found
                if (!exists) {
                    const closeMatches = matches.filter(m => m.includes(targetTicker) || targetTicker.includes(m));
                    if (closeMatches.length > 0) {
                        console.log(`⚠️ Did you mean? ${closeMatches.join(', ')}`);
                    } else {
                        // Double check raw text for the ticker just in case regex failed completely
                        if (text.toUpperCase().includes(targetTicker)) {
                            console.warn(`⚠️ Ticker ${targetTicker} found in raw text but failed regex parsing! Force enabling.`);
                            setIsValidTicker(true); // Fallback: if it's in the text, assume it's valid
                            return;
                        }
                    }
                }

                setIsValidTicker(exists);

            } catch (err) {
                console.error('❌ Error fetching MSAX Master List:', err);
                setIsValidTicker(false);
            } finally {
                setMasterListLoading(false);
            }
        };

        checkMasterList();
    }, [companyCode]);

    // 2. Fetch Analysis Data
    useEffect(() => {
        const fetchAnalysis = async () => {
            if (!isValidTicker || !companyCode) {
                setAnalysisData(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // ✅ PROXY UPDATE: Use local API route
                const url = `/api/msax?type=analysis&ticker=${companyCode.toUpperCase()}`;
                console.log(`📊 Fetching MSAX Analysis: ${url}`);

                const response = await fetch(url);
                if (!response.ok) {
                    if (response.status === 404) throw new Error('Analysis data not found');
                    throw new Error('Failed to fetch analysis data');
                }

                const data: RegimeAnalysisResponse = await response.json();
                setAnalysisData(data);

            } catch (err) {
                console.error('❌ Error fetching MSAX JSON:', err);
                setError(err instanceof Error ? err.message : 'Failed to load analysis data');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [isValidTicker, companyCode]);

    // 3. Determine Regime ID based on Active Tab
    const currentRegimeId = useMemo(() => {
        if (!analysisData) return null;

        switch (activeSubTab) {
            case 'frequent':
                return analysisData.most_frequent_regime.regime;
            case 'recurrent':
                return analysisData.regime_recurrence.most_recurrent_regime;
            case 'day':
                const day = getDayOfWeek();
                return analysisData.day_of_week_patterns[day]?.dominant_regime ?? null;
            case 'desirable':
                return analysisData.most_desirable_regime.most_desirable_regime;
            default:
                return null;
        }
    }, [analysisData, activeSubTab]);

    // Reset image index and loading state when sub-tab changes
    useEffect(() => {
        setActiveImageIndex(0);
        setImageLoading(true);
    }, [activeSubTab]);

    // Set loading true when index changes
    useEffect(() => {
        setImageLoading(true);
    }, [activeImageIndex]);

    // 4. Construct Image URLs
    const imageUrls = useMemo(() => {
        if (currentRegimeId === null || !companyCode) return null;

        const baseUrl = `${BASE_IP}/MSAX/${companyCode.toUpperCase()}/ClusterPlots`;
        return [
            {
                src: `${baseUrl}/${companyCode.toUpperCase()}_Cluster_${currentRegimeId}_panel.png`,
                label: 'Cluster Panel Analysis',
                type: 'Panel View'
            },
            {
                src: `${baseUrl}/${companyCode.toUpperCase()}_Cluster_${currentRegimeId}.png`,
                label: 'Regime Distribution',
                type: 'Cluster View'
            }
        ];
    }, [companyCode, currentRegimeId]);

    const handleNextImage = () => {
        setActiveImageIndex((prev) => (prev + 1) % 2);
    };

    const handlePrevImage = () => {
        setActiveImageIndex((prev) => (prev - 1 + 2) % 2);
    };


    // --- Render: Loading / Checking ---
    if (masterListLoading) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-zinc-900 rounded-lg">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">Checking MSAX availability...</p>
                </div>
            </div>
        );
    }

    // --- Render: Not Valid (Fallback UI) ---
    if (isValidTicker === false) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="text-center max-w-md px-6">
                    <div className="bg-zinc-800/50 p-4 rounded-full inline-block mb-4">
                        <Info className="h-8 w-8 text-zinc-500" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-300 mb-2">Not frequent enough to generate</h3>
                    <p className="text-zinc-500 text-sm">
                        Regime analysis is not available for {companyCode} due to insufficient data frequency or history.
                    </p>
                </div>
            </div>
        );
    }

    // --- Render: Valid but Loading Data ---
    if (loading && !analysisData) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-zinc-900 rounded-lg">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">Loading Regime Analysis...</p>
                </div>
            </div>
        );
    }

    // --- Render: Error ---
    if (error || !analysisData) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-zinc-900 rounded-lg">
                <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                    <p className="text-red-400 text-sm">{error || 'Data unavailable'}</p>
                </div>
            </div>
        );
    }

    // --- Render: Main Dashboard ---
    return (
        <div className="w-full h-full bg-zinc-900 rounded-lg flex flex-col overflow-hidden">
            {/* Header: Tabs + Controls */}
            <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm z-10">
                <div className="p-4 flex flex-col gap-4">
                    {/* Top Row: Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'frequent', label: 'Most Frequent' },
                            { id: 'recurrent', label: 'Most Recurrent' },
                            { id: 'day', label: `Day of Week (${getDayOfWeek()})` },
                            { id: 'desirable', label: 'Most Desirable' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubTab(tab.id as any)}
                                className={`
                    px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${activeSubTab === tab.id
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-transparent'
                                    }
                  `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Bottom Row: Title + Controls */}
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4">
                            <h3 className="text-white font-semibold text-lg">
                                Regime {currentRegimeId} Analysis
                            </h3>
                            {imageUrls && (
                                <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1 border border-zinc-700/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePrevImage}
                                        className="h-6 w-6 p-0 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                                    >
                                        ←
                                    </Button>
                                    <span className="text-xs font-medium text-zinc-400 min-w-[40px] text-center">
                                        {activeImageIndex + 1} / {imageUrls.length}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleNextImage}
                                        className="h-6 w-6 p-0 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                                    >
                                        →
                                    </Button>
                                </div>
                            )}
                        </div>
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                            Source: MSAX Analytics
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Area: Edge-to-Edge Image */}
            <div className="flex-1 relative bg-zinc-950 overflow-hidden">
                {imageUrls ? (
                    <div className="w-full h-full relative group">
                        {/* Loading Spinner Overlay */}
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-20">
                                <div className="text-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" />
                                    <p className="text-zinc-500 text-sm animate-pulse">Loading Chart...</p>
                                </div>
                            </div>
                        )}

                        <img
                            src={imageUrls[activeImageIndex].src}
                            alt={imageUrls[activeImageIndex].label}
                            className={`w-full h-full object-contain p-4 transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setImageLoading(false)}
                            onError={(e) => {
                                setImageLoading(false);
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-zinc-500 text-sm">Image not found</div>';
                            }}
                        />

                        {/* Overlay Label - Only show when loaded */}
                        {!imageLoading && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full border border-zinc-800/50 transition-opacity duration-300">
                                <p className="text-sm font-medium text-zinc-200">
                                    {imageUrls[activeImageIndex].label}
                                    <span className="mx-2 text-zinc-600">|</span>
                                    <span className="text-zinc-400">{imageUrls[activeImageIndex].type}</span>
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        Unable to determine regime for this selection.
                    </div>
                )}
            </div>
        </div>
    );
};
