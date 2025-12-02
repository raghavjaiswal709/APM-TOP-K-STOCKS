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

export interface GttPredictionItem {
    H1_pred: number;
    H2_pred: number;
    H3_pred: number;
    H4_pred: number;
    H5_pred: number;
    input_close: number;
    prediction_time: string;
    timestamp: string;
}

export interface CompanyPredictions {
    symbol?: string;
    company?: string;
    predictions: GttPredictionItem[] | Record<string, PredictionData>;  // Support both formats
    count?: number;
    total_predictions?: number;
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
 * ✅ FIXED: Pass through GTT predictions in native array format
 * NO TRANSFORMATION - Chart expects array format with H1-H5 structure
 */
export function transformGttToChartPredictions(
    gttResponse: GttApiResponse | null
): any | null {
    if (!gttResponse || !gttResponse.predictions || gttResponse.predictions.length === 0) {
        console.warn('⚠️ [transformGttToChartPredictions] No GTT data available');
        return null;
    }

    console.log('🔄 [transformGttToChartPredictions] Passing through native format:', {
        symbol: gttResponse.symbol,
        totalPredictions: gttResponse.total_predictions,
        predictionsArrayLength: gttResponse.predictions.length,
        latestPredictionTime: gttResponse.latest.prediction_time
    });

    // ✅ CRITICAL: Return data in NATIVE format (array) for PlotlyChart
    // PlotlyChart expects: { symbol, latest, predictions: Array, total_predictions }
    return {
        symbol: gttResponse.symbol,
        latest: gttResponse.latest,
        predictions: gttResponse.predictions,  // ✅ Keep as ARRAY
        total_predictions: gttResponse.total_predictions,
        count: gttResponse.total_predictions
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
