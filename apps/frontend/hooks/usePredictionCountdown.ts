/**
 * usePredictionCountdown
 *
 * Counts down to the next regular-prediction fetch cycle.
 * Regular predictions are fetched every 5 minutes, aligned to standard
 * 5-minute clock boundaries during NSE market hours:
 *   9:15, 9:20, 9:25, 9:30 … 15:25, 15:30 IST
 *
 * Returns a live countdown that updates every second.
 * Returns empty string when outside market hours.
 *
 * This hook is intentionally independent of showPredictions / enabled state
 * so the timer shows in the button whether predictions are ON or OFF.
 */
import { useState, useEffect } from 'react';

// Market schedule (minutes since midnight IST)
const MARKET_OPEN_MIN  = 9 * 60 + 15;   // 09:15 = 555
const MARKET_CLOSE_MIN = 15 * 60 + 30;  // 15:30 = 930
const PRED_INTERVAL    = 5;              // every 5 minutes, aligned to clock (9:15, 9:20, …)

export interface PredictionCountdown {
    /** MM:SS string, e.g. "03:47" — empty string when outside market hours */
    formatted: string;
    /** Raw seconds remaining to next prediction fetch */
    seconds: number;
    /** True when the current IST time is within the prediction window */
    inMarketHours: boolean;
    /** Next prediction time as "HH:MM" IST, e.g. "09:20" */
    nextPredictionTime: string;
}

/** Returns current time components in IST (UTC+5:30 — India has no DST) */
function getISTComponents(): { h: number; m: number; s: number } {
    const now   = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    const istMs = utcMs + (5 * 60 + 30) * 60_000;
    const ist   = new Date(istMs);
    return { h: ist.getHours(), m: ist.getMinutes(), s: ist.getSeconds() };
}

function calculateCountdown(): PredictionCountdown {
    const { h, m, s } = getISTComponents();
    const totalMin = h * 60 + m;

    // Outside prediction window
    if (totalMin < MARKET_OPEN_MIN || totalMin >= MARKET_CLOSE_MIN) {
        return { formatted: '', seconds: 0, inMarketHours: false, nextPredictionTime: '' };
    }

    // Next 5-minute clock boundary — predictions align to minutes divisible by 5
    // e.g. 09:17 → next at 09:20 (3 min); 09:20 → next at 09:25 (5 min)
    const minIntoInterval = m % PRED_INTERVAL;                             // 0..4
    const minToNext       = minIntoInterval === 0 ? PRED_INTERVAL         // exactly on boundary → 5 min
                                                  : PRED_INTERVAL - minIntoInterval;

    const rawSeconds = minToNext * 60 - s;
    const secToNext  = Math.max(0, rawSeconds);

    // Build next-prediction label "HH:MM"
    const nextTotalMin = totalMin + minToNext;
    const nh = Math.floor(nextTotalMin / 60);
    const nm = nextTotalMin % 60;
    const nextPredictionTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;

    // Format MM:SS
    const mm      = String(Math.floor(secToNext / 60)).padStart(2, '0');
    const ss      = String(secToNext % 60).padStart(2, '0');
    const formatted = `${mm}:${ss}`;

    return { formatted, seconds: secToNext, inMarketHours: true, nextPredictionTime };
}

export function usePredictionCountdown(): PredictionCountdown {
    const [countdown, setCountdown] = useState<PredictionCountdown>(calculateCountdown);

    useEffect(() => {
        const id = setInterval(() => setCountdown(calculateCountdown()), 1_000);
        return () => clearInterval(id);
    }, []);

    return countdown;
}
