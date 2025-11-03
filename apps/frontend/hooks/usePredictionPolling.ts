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

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalDurationRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const lastPollRef = useRef<Date | null>(null);

  const startPolling = useCallback(async () => {
    if (!enabled || !company) return;

    setIsPolling(true);
    startTimeRef.current = new Date();
    lastPollRef.current = new Date();
    setPollCount(0);
    setElapsedTime(0);

    // Immediate first fetch
    const data = await refetch();
    if (data) {
      onUpdate?.(data);
    } else if (error) {
      onError?.(error);
    }

    // Set up polling interval - CONTINUOUS POLLING (no total duration limit)
    pollIntervalRef.current = setInterval(async () => {
      if (!startTimeRef.current) return;

      const now = new Date();
      const elapsed = now.getTime() - startTimeRef.current.getTime();

      setElapsedTime(elapsed);
      setNextPollTime(new Date(now.getTime() + pollInterval));

      console.log(`🔄 Polling predictions for ${company} (Poll #${pollCount + 1})`);
      
      const data = await refetch();
      if (data) {
        setPollCount((prev) => prev + 1);
        lastPollRef.current = new Date();
        onUpdate?.(data);
        console.log(`✅ Predictions refreshed: ${data.count} predictions`);
      } else if (error) {
        onError?.(error);
        console.error('❌ Failed to refresh predictions:', error);
      }
    }, pollInterval);

    // ✨ REMOVED: No total duration timeout - polling continues indefinitely
    // This ensures predictions keep refreshing as long as the component is mounted
  }, [enabled, company, pollInterval, refetch, error, pollCount, onUpdate, onError]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (totalDurationRef.current) clearTimeout(totalDurationRef.current);
    setIsPolling(false);
    startTimeRef.current = null;
    lastPollRef.current = null;
    setNextPollTime(null);
  }, []);

  const pausePolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (totalDurationRef.current) clearTimeout(totalDurationRef.current);
    setIsPolling(false);
  }, []);

  const resumePolling = useCallback(() => {
    if (isPolling) return;
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
      startPolling();
    }
  }, [enabled, autoStart, company]);

  const timeRemaining = Math.max(0, totalDuration - elapsedTime);
  const progressPercentage = (elapsedTime / totalDuration) * 100;

  return {
    isPolling,
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
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
  };
};
