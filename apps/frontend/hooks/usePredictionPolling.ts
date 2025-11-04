import { useEffect, useRef, useCallback, useState } from 'react';
import { usePredictions, CompanyPredictions } from './usePredictions';

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
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    const updateCountdown = () => {
      const timeLeft = getTimeUntilNextSync();
      setTimeUntilNextPoll(timeLeft);
    };

    updateCountdown(); // Initial update
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
  }, []);

  /**
   * Fetch predictions at synchronized time
   */
  const fetchAtSyncTime = useCallback(async () => {
    if (!enabled || !company) return;

    const now = new Date();
    pollCountRef.current += 1;
    const currentPollCount = pollCountRef.current;
    
    console.log(`🔄 [SYNC] Fetching predictions for ${company} at ${now.toLocaleTimeString()} (Poll #${currentPollCount})`);
    
    // FORCE FRESH FETCH - bypass cache
    const freshData = await refetch();
    if (freshData) {
      setPollCount(currentPollCount);
      lastPollRef.current = now;
      onUpdate?.(freshData);
      
      // Log the latest prediction time from server
      const predictions = Object.values(freshData.predictions);
      if (predictions.length > 0) {
        const latestPrediction = predictions[predictions.length - 1];
        console.log(`✅ [SYNC] Poll #${currentPollCount} successful: ${freshData.count} predictions`);
        console.log(`📊 [SYNC] Latest server prediction time: ${latestPrediction.predictedat}`);
      }
    } else {
      console.error(`❌ [SYNC] Poll #${currentPollCount} failed:`, error);
      onError?.(error || 'Failed to fetch predictions');
    }

    // Schedule next sync
    scheduleNextSync();
  }, [enabled, company, refetch, onUpdate, onError, error]);

  /**
   * Schedule fetch at next 5-minute interval
   */
  const scheduleNextSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const timeUntilNext = getTimeUntilNextSync();
    const nextTime = getNextSyncTime();
    
    setNextPollTime(nextTime);
    
    console.log(`⏰ [SYNC] Next poll scheduled for: ${nextTime.toLocaleTimeString()} (in ${Math.round(timeUntilNext / 1000)}s)`);
    
    syncTimeoutRef.current = setTimeout(() => {
      fetchAtSyncTime();
    }, timeUntilNext);

    // Start countdown timer
    startCountdown();
  }, [fetchAtSyncTime, startCountdown]);

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

    // Clear existing timers
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
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

    pollIntervalRef.current = elapsedInterval as any;

  }, [enabled, company, refetch, onUpdate, onError, scheduleNextSync, error]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (totalDurationRef.current) clearTimeout(totalDurationRef.current);
    
    setIsPolling(false);
    startTimeRef.current = null;
    lastPollRef.current = null;
    setNextPollTime(null);
    setTimeUntilNextPoll(0);
    
    console.log('🛑 [SYNC] Polling stopped');
  }, []);

  const pausePolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (totalDurationRef.current) clearTimeout(totalDurationRef.current);
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
    elapsedTime,
    timeRemaining,
    pollCount,
    progressPercentage,
    nextPollTime,
    timeUntilNextPoll, // NEW: countdown in milliseconds
  };
};
