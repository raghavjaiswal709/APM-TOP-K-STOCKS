import { useState, useEffect, useCallback, useRef } from 'react';

// Combined API response structure from /visualize/predicted-analysis (port 8506)
interface TopClusterData {
    cluster_id: number;
    probability: number;  // This is the reoccurrence probability!
    desirability_score: number;
    classification: string;
    details: {
        time_above_open_pct?: number;
        slope?: number;
        final_position?: number;
        max_drawdown?: number;
        recovery_time_minutes?: number | null;
        trend_strength?: number;
        pattern_length?: number;
        net_change?: number;
        start_value?: number;
        end_value?: number;
        pattern_volatility?: number;
    };
}

interface CombinedApiResponse {
    symbol: string;
    prediction_date: string;
    day_of_week: string;
    top_clusters: TopClusterData[];
}

// UMAP Clustering V2 API response (port 6968 – fallback)
interface UMAPCluster {
    cluster_id: number;
    h_label: string;
    archetype: string;
    win_rate: number;
    risk_adjusted_return: number;
    avg_return_pct: number;
    avg_volatility_pct: number;
    persistence: number;
    recurrence_rate: number;
    n_days: number;
    intra_pattern_similarity: number;
    return_std: number;
    intraday_range: number;
    days_in_window: number;
    core_days: number;
    noise_days: number;
    noise_fraction: number;
}

interface UMAPAnalysisResponse {
    symbol: string;
    analysis_window: number;
    total_days: number;
    noise: { rolling_noise_fraction: number; total_noise_fraction: number; total_noise_days: number };
    quality_metrics: { silhouette_score: number; silhouette_reduced: number; trustworthiness: number; dbcv: number };
    active_clusters: { count: number; clusters: UMAPCluster[] };
}

export interface DesirabilityData {
    symbol: string;
    exchange: string;
    method: string;
    prediction_date?: string;
    day_of_week?: string;
    source?: 'primary' | 'umap-fallback';
    top_pattern: {
        cluster_id: number;
        strength_score: number;
        desirability_score: number;
        reoccurrence_probability: number;
        classification: string;
        details: {
            time_above_open_pct?: number;
            slope?: number;
            final_position?: number;
            max_drawdown?: number;
            recovery_time_minutes?: number | null;
            trend_strength?: number;
            pattern_length?: number;
            net_change?: number;
            start_value?: number;
            end_value?: number;
            pattern_volatility?: number;
        };
    };
    all_clusters?: TopClusterData[];
    all_patterns_count: number;
    timestamp: string;
}

interface UseDesirabilityReturn {
    score: number | null;
    classification: string | null;
    reoccurrenceProbability: number | null;
    loading: boolean;
    error: any;
    data: DesirabilityData | null;
    refetch: () => Promise<void>;
}

// ── Derive desirability from UMAP cluster data ──────────────────────────────
function classifyCluster(c: UMAPCluster): string {
    if (c.win_rate >= 0.7 && c.risk_adjusted_return > 0.5) return 'Highly Desirable';
    if (c.win_rate >= 0.5 && c.risk_adjusted_return > 0) return 'Moderately Desirable';
    if (c.win_rate >= 0.3 && c.risk_adjusted_return > -0.3) return 'Neutral';
    if (c.archetype === 'Trending_Down' || c.risk_adjusted_return < -0.5) return 'Undesirable';
    return 'Low Desirability';
}

function computeDesirabilityScore(c: UMAPCluster): number {
    // Weighted formula: 40% win_rate + 30% normalised risk-adj return + 20% recurrence + 10% persistence
    const normRAR = Math.max(0, Math.min(1, (c.risk_adjusted_return + 1) / 2)); // map [-1,1] → [0,1]
    const score = 0.4 * c.win_rate + 0.3 * normRAR + 0.2 * Math.min(c.recurrence_rate * 5, 1) + 0.1 * c.persistence;
    return Math.max(0, Math.min(1, score));
}

function convertUMAPToDesirabilityData(symbol: string, umap: UMAPAnalysisResponse): DesirabilityData | null {
    const clusters = umap.active_clusters?.clusters || [];
    if (clusters.length === 0) return null;

    // Score and rank each cluster
    const scored = clusters.map(c => ({
        ...c,
        desirabilityScore: computeDesirabilityScore(c),
        classification: classifyCluster(c),
    }));
    scored.sort((a, b) => b.desirabilityScore - a.desirabilityScore);
    const best = scored[0];

    // Map to TopClusterData[] for all_clusters
    const allClusters: TopClusterData[] = scored.map(c => ({
        cluster_id: c.cluster_id,
        probability: c.recurrence_rate,
        desirability_score: c.desirabilityScore,
        classification: c.classification,
        details: {
            trend_strength: c.avg_return_pct,
            pattern_volatility: c.avg_volatility_pct,
        },
    }));

    return {
        symbol: umap.symbol,
        exchange: 'NSE',
        method: 'umap-v2',
        source: 'umap-fallback',
        top_pattern: {
            cluster_id: best.cluster_id,
            strength_score: best.desirabilityScore,
            desirability_score: best.desirabilityScore,
            reoccurrence_probability: best.recurrence_rate,
            classification: best.classification,
            details: {
                trend_strength: best.avg_return_pct,
                pattern_volatility: best.avg_volatility_pct,
            },
        },
        all_clusters: allClusters,
        all_patterns_count: allClusters.length,
        timestamp: new Date().toISOString(),
    };
}

// ── Track whether port 8506 is known-down to avoid repeated timeouts ────────
let primaryServiceDown = false;
let primaryServiceDownAt = 0;
const PRIMARY_RETRY_INTERVAL = 5 * 60_000; // retry primary every 5 minutes

/**
 * Custom hook to fetch desirability score and probability for a symbol.
 *
 * Primary: /visualize/predicted-analysis (port 8506)
 * Fallback: UMAP Clustering V2 /api/v2/clustering/{symbol}/analysis (port 6968)
 *
 * When the primary service is unreachable the hook silently falls back to
 * deriving desirability from UMAP cluster metrics (win_rate, risk-adjusted
 * return, recurrence, persistence).  No console errors are thrown – the UI
 * simply shows fallback-derived scores.
 */
export function useDesirability(symbol: string): UseDesirabilityReturn {
    const [data, setData] = useState<DesirabilityData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<any>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchDesirability = useCallback(async () => {
        if (!symbol) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        // Abort any in-flight request for the previous symbol
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        setLoading(true);
        setError(null);

        const cleanSymbol = symbol.includes(':') ? symbol.split(':')[1]?.split('-')[0] : symbol;

        // ── 1. Try primary (port 8506) unless known-down ────────────────────
        const shouldTryPrimary = !primaryServiceDown || (Date.now() - primaryServiceDownAt > PRIMARY_RETRY_INTERVAL);

        if (shouldTryPrimary) {
            try {
                const response = await fetch('/api/proxy/visualize/predicted-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: cleanSymbol, method: 'spectral', exchange: 'NSE', top_n: 5 }),
                    signal: ac.signal,
                });

                if (response.ok) {
                    const apiResult: CombinedApiResponse = await response.json();
                    const topClusters = apiResult.top_clusters || [];

                    if (topClusters.length > 0) {
                        // Primary is alive again
                        primaryServiceDown = false;

                        const sorted = [...topClusters].sort((a, b) => b.desirability_score - a.desirability_score);
                        const top = sorted[0];

                        const transformed: DesirabilityData = {
                            symbol: apiResult.symbol,
                            exchange: 'NSE',
                            method: 'spectral',
                            source: 'primary',
                            prediction_date: apiResult.prediction_date,
                            day_of_week: apiResult.day_of_week,
                            top_pattern: {
                                cluster_id: top.cluster_id,
                                strength_score: top.desirability_score,
                                desirability_score: top.desirability_score,
                                reoccurrence_probability: top.probability,
                                classification: top.classification,
                                details: top.details || {},
                            },
                            all_clusters: topClusters,
                            all_patterns_count: topClusters.length,
                            timestamp: new Date().toISOString(),
                        };

                        if (!ac.signal.aborted) {
                            setData(transformed);
                            setLoading(false);
                        }
                        return; // success – done
                    }
                }
                // Non-OK or empty → mark down and fall through
                primaryServiceDown = true;
                primaryServiceDownAt = Date.now();
            } catch (primaryErr: any) {
                if (primaryErr.name === 'AbortError') { setLoading(false); return; }
                // Network / timeout error → mark primary as down
                primaryServiceDown = true;
                primaryServiceDownAt = Date.now();
                console.warn(`⚠️ [useDesirability] Primary service (8506) unreachable, falling back to UMAP V2`);
            }
        }

        // ── 2. Fallback: UMAP Clustering V2 (port 6968) ────────────────────
        try {
            const umapRes = await fetch(`/api/v2/clustering/${encodeURIComponent(cleanSymbol)}/analysis?window=7`, {
                signal: ac.signal,
            });

            if (!umapRes.ok) {
                throw new Error(`UMAP API returned ${umapRes.status}`);
            }

            const umapData: UMAPAnalysisResponse = await umapRes.json();
            const derived = convertUMAPToDesirabilityData(cleanSymbol, umapData);

            if (!ac.signal.aborted) {
                if (derived) {
                    setData(derived);
                } else {
                    setData(null);
                    setError(new Error('No active clusters in UMAP data'));
                }
            }
        } catch (fallbackErr: any) {
            if (fallbackErr.name === 'AbortError') { setLoading(false); return; }
            console.warn(`⚠️ [useDesirability] Both primary and UMAP fallback failed for ${cleanSymbol}`);
            if (!ac.signal.aborted) {
                setError(fallbackErr);
                setData(null);
            }
        } finally {
            if (!ac.signal.aborted) setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchDesirability();
        return () => { abortRef.current?.abort(); };
    }, [fetchDesirability]);

    return {
        score: data?.top_pattern?.desirability_score ?? null,
        classification: data?.top_pattern?.classification ?? null,
        reoccurrenceProbability: data?.top_pattern?.reoccurrence_probability ?? null,
        loading,
        error,
        data,
        refetch: fetchDesirability,
    };
}
