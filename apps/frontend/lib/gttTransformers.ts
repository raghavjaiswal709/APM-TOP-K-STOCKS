// apps/frontend/lib/gttTransformers.ts

export interface GttApiResponse {
    latest: {
        H1_pred: number;
        H2_pred: number;
        H3_pred: number;
        H4_pred: number;
        H5_pred: number;
        input_close: number;
        prediction_time: string;
        timestamp: string;
    };
    predictions: Array<{
        H1_pred: number;
        H2_pred: number;
        H3_pred: number;
        H4_pred: number;
        H5_pred: number;
        input_close: number;
        prediction_time: string;
        timestamp: string;
    }>;
    symbol: string;
    total_predictions: number;
}

export interface PredictionData {
    timestamp: string;
    close: number;
    predictedat: string;
}

export interface CompanyPredictions {
    company: string;
    predictions: Record<string, PredictionData>;
    count: number;
    starttime?: string;
    endtime?: string;
    latest?: {
        timestamp: string;
        input_close: number;
        prediction_time: string;
        H1_pred: number;
        H2_pred: number;
        H3_pred: number;
        H4_pred: number;
        H5_pred: number;
    };
}

/**
 * ✅ FIXED: Complete transformation logic for GTT predictions
 * Converts raw GTT API response to chart-compatible format
 */
export function transformGttToChartPredictions(
    gttResponse: GttApiResponse | null
): CompanyPredictions | null {
    if (!gttResponse || !gttResponse.latest) {
        console.warn('⚠️ [transformGttToChartPredictions] No GTT data available');
        return null;
    }

    const latest = gttResponse.latest;
    const predictions: Record<string, PredictionData> = {};

    // Parse base timestamp (anchor point)
    const baseTime = new Date(latest.timestamp);
    const predictionTime = latest.prediction_time;

    console.log('🔄 [transformGttToChartPredictions] Processing:', {
        symbol: gttResponse.symbol,
        baseTime: baseTime.toISOString(),
        predictionTime,
        latest
    });

    // Add current price as anchor (H0)
    predictions[baseTime.toISOString()] = {
        timestamp: baseTime.toISOString(),
        close: latest.input_close,
        predictedat: predictionTime
    };

    // ✅ FIXED: Complete horizon predictions (H1 through H5)
    const horizons = [
        { key: 'H1', value: latest.H1_pred, offsetMinutes: 15 },
        { key: 'H2', value: latest.H2_pred, offsetMinutes: 30 },
        { key: 'H3', value: latest.H3_pred, offsetMinutes: 45 },
        { key: 'H4', value: latest.H4_pred, offsetMinutes: 60 },
        { key: 'H5', value: latest.H5_pred, offsetMinutes: 75 },
    ];

    horizons.forEach(horizon => {
        const futureTime = new Date(baseTime.getTime() + horizon.offsetMinutes * 60 * 1000);
        predictions[futureTime.toISOString()] = {
            timestamp: futureTime.toISOString(),
            close: horizon.value,
            predictedat: predictionTime
        };
    });

    const timestamps = Object.keys(predictions).sort();
    const startTime = timestamps[0];
    const endTime = timestamps[timestamps.length - 1];

    console.log('✅ [transformGttToChartPredictions] Transformed:', {
        symbol: gttResponse.symbol,
        predictionCount: Object.keys(predictions).length,
        timeRange: `${startTime} → ${endTime}`
    });

    return {
        company: gttResponse.symbol,
        predictions,
        count: Object.keys(predictions).length,
        starttime: startTime,
        endtime: endTime,
        latest: {
            timestamp: latest.timestamp,
            input_close: latest.input_close,
            prediction_time: latest.prediction_time,
            H1_pred: latest.H1_pred,
            H2_pred: latest.H2_pred,
            H3_pred: latest.H3_pred,
            H4_pred: latest.H4_pred,
            H5_pred: latest.H5_pred,
        }
    };
}

/**
 * ✅ NEW: Helper function to extract latest prediction values
 */
export function extractLatestGttValues(transformed: CompanyPredictions | null) {
    if (!transformed || !transformed.latest) return null;

    return {
        anchor: transformed.latest.input_close,
        H1: transformed.latest.H1_pred,
        H2: transformed.latest.H2_pred,
        H3: transformed.latest.H3_pred,
        H4: transformed.latest.H4_pred,
        H5: transformed.latest.H5_pred,
        predictionTime: transformed.latest.prediction_time,
        baseTime: transformed.latest.timestamp,
    };
}
