'use client';
import { useState, useEffect, useRef } from 'react';

interface ClusterSymbolsResponse {
    count: number;
    symbols: string[];
}

// Module-level cache so all component instances share the same fetch result
let cachedSymbols: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useClusterSymbols() {
    const [clusterSymbols, setClusterSymbols] = useState<Set<string>>(
        () => cachedSymbols ?? new Set()
    );
    const [loading, setLoading] = useState(!cachedSymbols);
    const fetchedRef = useRef(false);

    useEffect(() => {
        // Use cache if it's still fresh
        if (cachedSymbols && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
            setClusterSymbols(cachedSymbols);
            setLoading(false);
            return;
        }

        // Prevent duplicate in-flight fetches per component mount
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        fetch('/api/pattern-overlay/symbols')
            .then(r => r.ok ? r.json() as Promise<ClusterSymbolsResponse> : Promise.reject(r.status))
            .then(data => {
                const symbolSet = new Set<string>(data.symbols ?? []);
                cachedSymbols = symbolSet;
                cacheTimestamp = Date.now();
                setClusterSymbols(symbolSet);
            })
            .catch(() => {
                // Silently fail — no cluster icons shown on network error
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return { clusterSymbols, loading };
}
