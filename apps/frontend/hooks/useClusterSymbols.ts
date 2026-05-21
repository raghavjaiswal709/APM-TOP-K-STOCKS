'use client';
import { useState, useEffect, useRef } from 'react';

interface ClusterSymbolsResponse {
    count: number;
    symbols: string[];
}

// Module-level cache keyed by paa_width_min so resolutions never share stale data
const symbolsCache: Record<number, { symbols: Set<string>; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useClusterSymbols(paaWidthMin: number = 15) {
    const cacheEntry = symbolsCache[paaWidthMin];
    const [clusterSymbols, setClusterSymbols] = useState<Set<string>>(
        () => cacheEntry?.symbols ?? new Set()
    );
    const [loading, setLoading] = useState(!cacheEntry);
    const fetchedRef = useRef<number | null>(null); // tracks the paaWidthMin of the in-flight fetch

    useEffect(() => {
        // Use cache if still fresh for this resolution
        const entry = symbolsCache[paaWidthMin];
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            setClusterSymbols(entry.symbols);
            setLoading(false);
            return;
        }

        // Prevent duplicate in-flight fetches for the same resolution
        if (fetchedRef.current === paaWidthMin) return;
        fetchedRef.current = paaWidthMin;
        setLoading(true);

        fetch(`/api/pattern-overlay/symbols?paa_width_min=${paaWidthMin}`)
            .then(r => r.ok ? r.json() as Promise<ClusterSymbolsResponse> : Promise.reject(r.status))
            .then(data => {
                const symbolSet = new Set<string>(data.symbols ?? []);
                symbolsCache[paaWidthMin] = { symbols: symbolSet, timestamp: Date.now() };
                setClusterSymbols(symbolSet);
            })
            .catch(() => {
                // Silently fail — no cluster icons shown on network error
            })
            .finally(() => {
                setLoading(false);
                if (fetchedRef.current === paaWidthMin) fetchedRef.current = null;
            });
    }, [paaWidthMin]);

    return { clusterSymbols, loading };
}
