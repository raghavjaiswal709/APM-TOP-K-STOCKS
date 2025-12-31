'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Zap } from 'lucide-react';

export interface PredictionTimerProps {
  timeUntilNextPoll: number; // milliseconds
  nextPollTime: Date | null | undefined;
  isPolling: boolean;
  onTimerEnd?: () => void | Promise<unknown>; // ✅ CRITICAL: Callback when timer reaches 0 (NO DELAY)
}

export const PredictionTimer: React.FC<PredictionTimerProps> = ({
  timeUntilNextPoll,
  nextPollTime,
  isPolling,
  onTimerEnd,
}) => {
  const previousTimeRef = useRef<number>(timeUntilNextPoll);
  const hasTriggeredRef = useRef<boolean>(false);

  // ✅ CRITICAL FIX: Trigger callback IMMEDIATELY when countdown reaches 0
  useEffect(() => {
    const wasPositive = previousTimeRef.current > 0;
    const isZeroOrNegative = timeUntilNextPoll <= 0;

    // When timer transitions from positive to 0 or negative, trigger refresh IMMEDIATELY
    if (wasPositive && isZeroOrNegative && isPolling && onTimerEnd && !hasTriggeredRef.current) {
      console.log('⏰ [TIMER END] Timer hit 0 - triggering refresh NOW');
      hasTriggeredRef.current = true;

      // Execute callback immediately (no delay)
      Promise.resolve(onTimerEnd()).then(() => {
        console.log('✅ [TIMER END] Refresh completed successfully');
        // Reset trigger flag after 2 seconds to allow next cycle
        setTimeout(() => {
          hasTriggeredRef.current = false;
        }, 2000);
      }).catch((err) => {
        console.error('❌ [TIMER END] Refresh failed:', err);
        hasTriggeredRef.current = false;
      });
    }

    previousTimeRef.current = timeUntilNextPoll;
  }, [timeUntilNextPoll, isPolling, onTimerEnd]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress (5 minutes = 300000ms)
  const maxTime = 5 * 60 * 1000; // 5 minutes
  const progress = Math.max(0, Math.min(100, ((maxTime - timeUntilNextPoll) / maxTime) * 100));

  // Calculate stroke dash offset for circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (!isPolling) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Timer Paused</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm h-full flex flex-col items-center justify-center p-6">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-primary transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tighter tabular-nums">
            {formatTime(timeUntilNextPoll)}
          </span>
          <span className="text-xs text-muted-foreground font-medium">MINUTES</span>
        </div>
      </div>

      {/* Next Poll Time */}
      {nextPollTime && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Zap className="h-3 w-3 text-primary" />
          <span>Refresh at {nextPollTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </Card>
  );
};

export default PredictionTimer;
