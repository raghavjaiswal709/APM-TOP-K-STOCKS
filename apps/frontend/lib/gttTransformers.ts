// apps/frontend/lib/gttTransformers.ts

export interface GttApiResponse {
    latest: {
        S1_H1_pred: number;
        S1_H2_pred: number;
        S1_H3_pred: number;
        S1_H4_pred: number;
        S1_H5_pred: number;
        S2_H1_pred: number;
        S2_H2_pred: number;
        S2_H3_pred: number;
        S2_H4_pred: number;
        S2_H5_pred: number;
        askbid_available?: boolean;
        input_close: number;
        prediction_time: string;
        timestamp: string;
    };
    predictions: Array<{
        S1_H1_pred: number;
        S1_H2_pred: number;
        S1_H3_pred: number;
        S1_H4_pred: number;
        S1_H5_pred: number;
        S2_H1_pred: number;
        S2_H2_pred: number;
        S2_H3_pred: number;
        S2_H4_pred: number;
        S2_H5_pred: number;
        askbid_available?: boolean;
        input_close: number;
        prediction_time: string;
        timestamp: string;
    }>;
    symbol: string;
    total_predictions: number;
}

export interface PredictionData {
    close: number;
    predicted_at?: string;  // When prediction was made
    // Legacy support for old format
    timestamp?: string;
    predictedat?: string;
}

export interface GttPredictionItem {
    S1_H1_pred: number;
    S1_H2_pred: number;
    S1_H3_pred: number;
    S1_H4_pred: number;
    S1_H5_pred: number;
    S2_H1_pred: number;
    S2_H2_pred: number;
    S2_H3_pred: number;
    S2_H4_pred: number;
    S2_H5_pred: number;
    askbid_available?: boolean;
    input_close: number;
    prediction_time: string;
    timestamp: string;
}

export interface CompanyPredictions {
    symbol?: string;
    company?: string;
    predictions: Record<string, PredictionData>;
    count?: number;
    total_predictions?: number;
    starttime?: string;
    endtime?: string;
    latest?: {
        timestamp: string;
        input_close: number;
        prediction_time: string;
        S1_H1_pred: number;
        S1_H2_pred: number;
        S1_H3_pred: number;
        S1_H4_pred: number;
        S1_H5_pred: number;
        S2_H1_pred: number;
        S2_H2_pred: number;
        S2_H3_pred: number;
        S2_H4_pred: number;
        S2_H5_pred: number;
        askbid_available?: boolean;
    };
}

/**
 * Multi-series GTT chart data.
 * Contains SEPARATE prediction records for each individual horizon line
 * (S1_H1 through S1_H5, S2_H1 through S2_H5, and input_close) so each
 * can be rendered as an independent toggleable line on the chart.
 */
export interface GttMultiSeriesData {
    symbol: string;
    total_predictions: number;
    latest: GttApiResponse['latest'] | null;
    /** Raw predictions array from API — every prediction with ALL fields */
    rawPredictions: GttApiResponse['predictions'];
    /** Individual horizon lines: S1_H1 through S1_H5, S2_H1 through S2_H5 */
    horizonLines: Record<string, Record<string, PredictionData>>;
    horizonCounts: Record<string, number>;
    /** input_close anchor points at each prediction_time */
    inputClosePredictions: Record<string, PredictionData>;
    inputCloseCount: number;
    /** Combined S1 H1 predictions for backward compat */
    predictions: Record<string, PredictionData>;
    count: number;
    company?: string;
}

// Helper: parse prediction_time as IST and return Date, or null if invalid
function parsePredictionTimeIST(predictionTime: string): Date | null {
    const normalizedTime = predictionTime.includes(':') && predictionTime.split(':').length === 2
        ? `${predictionTime}:00`
        : predictionTime;
    const baseIso = normalizedTime.replace(' ', 'T') + '+05:30';
    const d = new Date(baseIso);
    return isNaN(d.getTime()) ? null : d;
}

// Helper: format a Date to IST timestamp key "YYYY-MM-DD HH:MM"
function toISTKey(date: Date): string {
    const istStr = date.toLocaleString('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(',', '');
    const parts = istStr.split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : istStr;
}

/** All 10 individual horizon keys */
export const ALL_HORIZON_KEYS = [
    'S1_H1_pred', 'S1_H2_pred', 'S1_H3_pred', 'S1_H4_pred', 'S1_H5_pred',
    'S2_H1_pred', 'S2_H2_pred', 'S2_H3_pred', 'S2_H4_pred', 'S2_H5_pred',
] as const;

export type HorizonKey = typeof ALL_HORIZON_KEYS[number];

/** Offset minutes for each horizon index (H1=+15, H2=+30, ..., H5=+75) */
const HORIZON_OFFSET_MINUTES = [15, 30, 45, 60, 75];

/** Display config for each horizon line */
export const HORIZON_LINE_CONFIG: Record<string, { label: string; color: string; style: 'solid' | 'dashed' | 'dotted'; group: 'S1' | 'S2' }> = {
    S1_H1_pred: { label: 'S1 H1 (+15m)', color: '#9c27b0', style: 'solid', group: 'S1' },
    S1_H2_pred: { label: 'S1 H2 (+30m)', color: '#ab47bc', style: 'solid', group: 'S1' },
    S1_H3_pred: { label: 'S1 H3 (+45m)', color: '#ba68c8', style: 'solid', group: 'S1' },
    S1_H4_pred: { label: 'S1 H4 (+60m)', color: '#ce93d8', style: 'solid', group: 'S1' },
    S1_H5_pred: { label: 'S1 H5 (+75m)', color: '#e1bee7', style: 'solid', group: 'S1' },
    S2_H1_pred: { label: 'S2 H1 (+15m)', color: '#00bcd4', style: 'dashed', group: 'S2' },
    S2_H2_pred: { label: 'S2 H2 (+30m)', color: '#26c6da', style: 'dashed', group: 'S2' },
    S2_H3_pred: { label: 'S2 H3 (+45m)', color: '#4dd0e1', style: 'dashed', group: 'S2' },
    S2_H4_pred: { label: 'S2 H4 (+60m)', color: '#80deea', style: 'dashed', group: 'S2' },
    S2_H5_pred: { label: 'S2 H5 (+75m)', color: '#b2ebf2', style: 'dashed', group: 'S2' },
};

/**
 * Transform GTT predictions into MULTI-SERIES chart data.
 * Produces a separate time-series for each of the 10 horizons (S1_H1–S1_H5,
 * S2_H1–S2_H5) PLUS input_close — each can be independently toggled on chart.
 *
 * Each GTT prediction has prediction_time and 10 horizon values + input_close.
 * Each horizon is at +15/+30/+45/+60/+75 min from prediction_time.
 */
export function transformGttToChartPredictions(
    gttResponse: GttApiResponse | null
): GttMultiSeriesData | null {
    if (!gttResponse || !gttResponse.predictions || gttResponse.predictions.length === 0) {
        console.warn('⚠️ [transformGttToChartPredictions] No GTT data available');
        return null;
    }

    const latest = gttResponse.latest;
    if (!latest || !latest.prediction_time) {
        console.warn('⚠️ [transformGttToChartPredictions] No latest prediction available');
        return null;
    }

    console.log('🔄 [transformGttToChartPredictions] Converting GTT format → per-horizon chart format:', {
        symbol: gttResponse.symbol,
        totalPredictions: gttResponse.total_predictions,
        latestPredictionTime: latest.prediction_time
    });

    // Initialize separate record per horizon
    const horizonLines: Record<string, Record<string, PredictionData>> = {};
    for (const hk of ALL_HORIZON_KEYS) {
        horizonLines[hk] = {};
    }
    const inputCloseRecord: Record<string, PredictionData> = {};

    for (const pred of gttResponse.predictions) {
        if (!pred.prediction_time) continue;

        const baseDate = parsePredictionTimeIST(pred.prediction_time);
        if (!baseDate) {
            console.warn(`⚠️ [transformGttToChartPredictions] Invalid prediction_time: ${pred.prediction_time}`);
            continue;
        }

        // input_close anchor point at prediction_time
        const anchorKey = pred.prediction_time.substring(0, 16);
        inputCloseRecord[anchorKey] = {
            close: pred.input_close,
            predicted_at: pred.prediction_time,
        };

        // Each of the 10 horizons
        for (const hk of ALL_HORIZON_KEYS) {
            const predValue = pred[hk] as number;
            if (typeof predValue !== 'number' || !isFinite(predValue)) continue;

            // Extract horizon index (1-5) from key like "S1_H3_pred"
            const hIdx = parseInt(hk.charAt(4)) - 1; // 0-indexed
            const offsetMs = HORIZON_OFFSET_MINUTES[hIdx] * 60 * 1000;
            const futureDate = new Date(baseDate.getTime() + offsetMs);
            const dateKey = toISTKey(futureDate);

            horizonLines[hk][dateKey] = {
                close: predValue,
                predicted_at: pred.prediction_time,
            };
        }
    }

    const horizonCounts: Record<string, number> = {};
    for (const hk of ALL_HORIZON_KEYS) {
        horizonCounts[hk] = Object.keys(horizonLines[hk]).length;
    }
    const inputCloseCount = Object.keys(inputCloseRecord).length;

    console.log(`✅ [transformGttToChartPredictions] Generated per-horizon data:`, {
        horizons: Object.fromEntries(ALL_HORIZON_KEYS.map(k => [k, horizonCounts[k]])),
        inputClosePoints: inputCloseCount,
        fromPredictions: gttResponse.predictions.length
    });

    return {
        symbol: gttResponse.symbol,
        company: gttResponse.symbol,
        total_predictions: gttResponse.total_predictions,
        latest: gttResponse.latest,
        rawPredictions: gttResponse.predictions,
        horizonLines,
        horizonCounts,
        inputClosePredictions: inputCloseRecord,
        inputCloseCount,
        // Backward compat: "predictions" = S1_H1 data
        predictions: horizonLines['S1_H1_pred'] || {},
        count: horizonCounts['S1_H1_pred'] || 0,
    };
}

// Extract latest prediction values (both S1 and S2)
export function extractLatestGttValues(transformed: GttMultiSeriesData | null) {
    if (!transformed || !transformed.latest) return null;

    return {
        anchor: transformed.latest.input_close,
        // S1
        S1_H1: transformed.latest.S1_H1_pred,
        S1_H2: transformed.latest.S1_H2_pred,
        S1_H3: transformed.latest.S1_H3_pred,
        S1_H4: transformed.latest.S1_H4_pred,
        S1_H5: transformed.latest.S1_H5_pred,
        // S2
        S2_H1: transformed.latest.S2_H1_pred,
        S2_H2: transformed.latest.S2_H2_pred,
        S2_H3: transformed.latest.S2_H3_pred,
        S2_H4: transformed.latest.S2_H4_pred,
        S2_H5: transformed.latest.S2_H5_pred,
        predictionTime: transformed.latest.prediction_time,
        baseTime: transformed.latest.timestamp,
    };
}
