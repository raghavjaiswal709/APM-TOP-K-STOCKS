import { useEffect, useRef, useCallback, useState } from 'react';
import { usePredictions, CompanyPredictions, predictionCache } from './usePredictions';

export interface PollingConfig {
  company: string;
  pollInterval?: number; // milliseconds (default: 5 * 60 * 1000 = 5 minutes)
  totalDuration?: number; // milliseconds (default: 25 * 60 * 1000 = 25 minutes)
  enabled?: boolean;
  onUpdate?: (data: CompanyPredictions) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  autoStart?: boolean;
}

/**
 * Calculate the next sync time based on 5-minute intervals
 * Server generates predictions at: 09:15, 09:20, 09:25, 09:30, etc.
 */
const getNextSyncTime = (): Date => {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  // Round up to next 5-minute interval
  const nextMinute = Math.ceil((minutes + 1) / 5) * 5;

  const next = new Date(now);
  next.setMinutes(nextMinute);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // If we've passed into the next hour, adjust
  if (nextMinute >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(nextMinute % 60);
  }

  return next;
};

/**
 * Calculate milliseconds until next sync time
 */
const getTimeUntilNextSync = (): number => {
  const now = new Date();
  const next = getNextSyncTime();
  return next.getTime() - now.getTime();
};

export const usePredictionPolling = (config: PollingConfig) => {
  const {
    company,
    pollInterval = 5 * 60 * 1000, // 5 minutes
    totalDuration = 25 * 60 * 1000, // 25 minutes
    enabled = true,
    onUpdate,
    onError,
    onComplete,
    autoStart = true,
  } = config;

  const {
    predictions,
    refetch,
    loading,
    error,
    lastUpdated,
    dataAge,
    updateTrigger, // Get update trigger
  } = usePredictions({ company, enabled });

  const [isPolling, setIsPolling] = useState(autoStart && enabled);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [nextPollTime, setNextPollTime] = useState<Date | null>(null);
  const [timeUntilNextPoll, setTimeUntilNextPoll] = useState<number>(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalDurationRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const lastPollRef = useRef<Date | null>(null);
  const pollCountRef = useRef<number>(0);

  /**
   * Update countdown timer every second
   */
  const startCountdown = useCallback(() => {
    // Clear existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const updateCountdown = () => {
      const timeLeft = getTimeUntilNextSync();
      setTimeUntilNextPoll(timeLeft);
    };

    updateCountdown(); // Initial update
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
  }, []);

  // Use refs to avoid stale closures
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);
  const errorRef = useRef(error);
  const fetchAtSyncTimeRef = useRef<() => Promise<void>>(async () => { });

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
    errorRef.current = error;
  }, [onUpdate, onError, error]);

  /**
   * Schedule fetch at next 5-minute interval
   */
  const scheduleNextSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null; // Explicitly null out
    }

    const timeUntilNext = getTimeUntilNextSync();
    const nextTime = getNextSyncTime();

    setNextPollTime(nextTime);

    console.log(`⏰ [SYNC] Next poll scheduled for: ${nextTime.toLocaleTimeString()} (in ${Math.round(timeUntilNext / 1000)}s)`);

    syncTimeoutRef.current = setTimeout(() => {
      fetchAtSyncTimeRef.current?.();
    }, timeUntilNext);

    // Start countdown timer
    startCountdown();
  }, [startCountdown]);

  /**
   * Fetch predictions at synchronized time with stability optimization
   */
  const fetchAtSyncTime = useCallback(async () => {
    if (!enabled || !company) return;

    const now = new Date();
    pollCountRef.current += 1;
    const currentPollCount = pollCountRef.current;

    console.log(`🔄 [SYNC] Fetching predictions for ${company} at ${now.toLocaleTimeString()} (Poll #${currentPollCount})`);

    // Show cached data immediately for stable UI
    const cachedData = predictionCache.get(`predictions_${company}`);
    if (cachedData && currentPollCount > 1) {
      // Keep showing cached while fetching fresh (prevents flicker)
      console.log(`📦 Showing cached predictions during fetch (${cachedData.count} predictions)`);
    }

    // Fetch fresh data
    const freshData = await refetch();
    if (freshData) {
      // Compare metadata instead of JSON.stringify
      const dataChanged = !cachedData ||
        cachedData.count !== freshData.count ||
        cachedData.starttime !== freshData.starttime ||
        cachedData.endtime !== freshData.endtime;

      // ALWAYS update poll metadata
      setPollCount(currentPollCount);
      lastPollRef.current = now;

      if (dataChanged) {
        onUpdateRef.current?.(freshData);

        const predictions = Object.values(freshData.predictions);
        if (predictions.length > 0) {
          const latestPrediction = predictions[predictions.length - 1];
          console.log(`✅ [SYNC] Poll #${currentPollCount} - NEW DATA: ${freshData.count} predictions`);
          console.log(`📊 [SYNC] Latest prediction: ${latestPrediction.predictedat}`);
        }
      } else {
        // Data identical BUT still notify (chart might need to update timer, etc.)
        console.log(`ℹ️ [SYNC] Poll #${currentPollCount} - Data unchanged but poll count updated`);
        onUpdateRef.current?.(freshData); // Call onUpdate even if data unchanged
      }
    } else {
      console.error(`❌ [SYNC] Poll #${currentPollCount} failed:`, errorRef.current);
      onErrorRef.current?.(errorRef.current || 'Failed to fetch predictions');
    }

    // Schedule next sync
    scheduleNextSync();
  }, [enabled, company, refetch, scheduleNextSync]);

  // Update ref when callback changes
  useEffect(() => {
    fetchAtSyncTimeRef.current = fetchAtSyncTime;
  }, [fetchAtSyncTime]);

  const startPolling = useCallback(async () => {
    if (!enabled || !company) {
      console.warn('⚠️ Cannot start polling: enabled =', enabled, 'company =', company);
      return;
    }

    console.log(`� [SYNC] Starting synchronized prediction polling for ${company}`);

    setIsPolling(true);
    startTimeRef.current = new Date();
    lastPollRef.current = new Date();
    pollCountRef.current = 0;
    setPollCount(0);
    setElapsedTime(0);

    // Clear all existing timers
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (totalDurationRef.current) {
      clearTimeout(totalDurationRef.current);
      totalDurationRef.current = null;
    }

    // Immediate first fetch
    console.log(`🔄 [SYNC] Initial fetch for ${company}...`);
    const data = await refetch();
    if (data) {
      pollCountRef.current = 1;
      setPollCount(1);
      onUpdate?.(data);
      console.log(`✅ [SYNC] Initial fetch successful: ${data.count} predictions`);

      // Log current server time from data
      const predictions = Object.values(data.predictions);
      if (predictions.length > 0) {
        const latestPrediction = predictions[predictions.length - 1];
        console.log(`📊 [SYNC] Current server prediction time: ${latestPrediction.predictedat}`);
      }
    } else {
      console.error('❌ [SYNC] Initial fetch failed:', error);
      onError?.(error || 'Failed to fetch initial predictions');
    }

    // Schedule first synchronized fetch
    scheduleNextSync();

    // Track elapsed time
    const elapsedInterval = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current.getTime();
        setElapsedTime(elapsed);
      }
    }, 1000);

    pollIntervalRef.current = elapsedInterval;

  }, [enabled, company, refetch, onUpdate, onError, scheduleNextSync, error]);

  const stopPolling = useCallback(() => {
    // Clear all timers
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (totalDurationRef.current) {
      clearTimeout(totalDurationRef.current);
      totalDurationRef.current = null;
    }

    setIsPolling(false);
    startTimeRef.current = null;
    lastPollRef.current = null;
    setNextPollTime(null);
    setTimeUntilNextPoll(0);

    console.log('🛑 [SYNC] Polling stopped');
  }, []);

  const pausePolling = useCallback(() => {
    // Clear all timers
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (totalDurationRef.current) {
      clearTimeout(totalDurationRef.current);
      totalDurationRef.current = null;
    }
    setIsPolling(false);

    console.log('⏸️ [SYNC] Polling paused');
  }, []);

  const resumePolling = useCallback(() => {
    if (isPolling) return;
    console.log('▶️ [SYNC] Resuming polling');
    startPolling();
  }, [isPolling, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Auto-start if enabled
  useEffect(() => {
    if (enabled && autoStart && !isPolling && company) {
      console.log(`🚀 [SYNC] Auto-starting synchronized polling for ${company}`);
      startPolling();
    }
  }, [enabled, autoStart, company, isPolling, startPolling]);

  const timeRemaining = Math.max(0, totalDuration - elapsedTime);
  const progressPercentage = (elapsedTime / totalDuration) * 100;

  return {
    isPolling,
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
    refetch, // Expose refetch for manual refresh
    predictions,
    loading,
    error,
    lastUpdated,
    dataAge,
    updateTrigger, // Pass through update trigger
    elapsedTime,
    timeRemaining,
    pollCount,
    progressPercentage,
    nextPollTime,
    timeUntilNextPoll,
  };
};
