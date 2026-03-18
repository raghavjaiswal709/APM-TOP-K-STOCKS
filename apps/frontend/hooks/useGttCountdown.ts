/**
 * useGttCountdown
 *
 * Counts down to the next GTT prediction cycle.
 * GTT predictions fire every 15 minutes during NSE market hours:
 *   First: 09:15 IST  →  Last: 15:15 IST  (market closes 15:30)
 *
 * Returns a live countdown that updates every second.
 * Returns empty string when outside market hours.
 */
import { useState, useEffect } from 'react';

// Market schedule (minutes since midnight IST)
const MARKET_OPEN_MIN  = 9 * 60 + 15;   // 09:15 = 555
const LAST_PRED_MIN    = 15 * 60 + 15;  // 15:15 = 915 (last prediction fires here)
const PRED_INTERVAL    = 15;             // every 15 minutes

export interface GttCountdown {
    /** MM:SS string, e.g. "04:32" — empty string when outside market hours */
    formatted: string;
    /** Raw seconds remaining to next prediction */
    seconds: number;
    /** True when the current IST time is within the GTT prediction window */
    inMarketHours: boolean;
    /** Next prediction time as "HH:MM" IST, e.g. "09:30" */
    nextPredictionTime: string;
}

/** Returns current time broken down in IST (India Standard Time = UTC+5:30) */
function getISTComponents(): { h: number; m: number; s: number } {
    const now = new Date();
    // IST = UTC + 5h 30m — India does not observe DST so this offset is always fixed
    const utcMs  = now.getTime() + now.getTimezoneOffset() * 60_000;
    const istMs  = utcMs + (5 * 60 + 30) * 60_000;
    const ist    = new Date(istMs);
    return { h: ist.getHours(), m: ist.getMinutes(), s: ist.getSeconds() };
}

function calculateCountdown(): GttCountdown {
    const { h, m, s } = getISTComponents();
    const totalMin = h * 60 + m;

    // Outside the GTT prediction window
    if (totalMin < MARKET_OPEN_MIN || totalMin >= LAST_PRED_MIN) {
        return { formatted: '', seconds: 0, inMarketHours: false, nextPredictionTime: '' };
    }

    // How far into the current 15-minute interval are we?
    const minSinceOpen    = totalMin - MARKET_OPEN_MIN;          // minutes elapsed since 09:15
    const minIntoInterval = minSinceOpen % PRED_INTERVAL;        // 0..14
    const minToNext       = minIntoInterval === 0               // exactly on boundary?
        ? PRED_INTERVAL                                          //   yes → 15:00 until NEXT one
        : PRED_INTERVAL - minIntoInterval;                       //   no  → remaining minutes

    // Raw countdown in seconds
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

export function useGttCountdown(): GttCountdown {
    const [countdown, setCountdown] = useState<GttCountdown>(calculateCountdown);

    useEffect(() => {
        // Tick every second
        const id = setInterval(() => setCountdown(calculateCountdown()), 1_000);
        return () => clearInterval(id);
    }, []);

    return countdown;
}
