'use client';

import React, { useEffect, useRef } from 'react';

export interface PredictionTimerProps {
  timeUntilNextPoll: number; // milliseconds
  nextPollTime: Date | null | undefined;
  isPolling: boolean;
  onTimerEnd?: () => void | Promise<unknown>; // Callback when timer reaches 0 (called after 3 sec delay)
}

export const PredictionTimer: React.FC<PredictionTimerProps> = ({
  timeUntilNextPoll,
  nextPollTime,
  isPolling,
  onTimerEnd,
}) => {
  const previousTimeRef = useRef<number>(timeUntilNextPoll);

  // Trigger callback when countdown reaches 0 (with 3 second delay)
  useEffect(() => {
    const wasPositive = previousTimeRef.current > 0;
    const isZeroOrNegative = timeUntilNextPoll <= 0;
    
    // When timer transitions from positive to 0 or negative, trigger refresh after 3 seconds
    if (wasPositive && isZeroOrNegative && isPolling && onTimerEnd) {
      console.log('⏰ Timer ended - will refresh in 3 seconds...');
      const timeoutId = setTimeout(() => {
        console.log('🔄 Triggering refresh after 3 second delay');
        onTimerEnd();
      }, 4000); // 3 second delay
      
      return () => clearTimeout(timeoutId);
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
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (!isPolling) {
    return (
      <div className="flex items-center justify-center p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg backdrop-blur-sm">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Polling Stopped</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg backdrop-blur-sm border border-purple-500/20">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)] rounded-lg"></div>
      
      <div className="relative flex flex-col items-center gap-3">
        {/* Circular Timer */}
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="rgba(100, 116, 139, 0.2)"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {formatTime(timeUntilNextPoll)}
            </div>
            <div className="text-xs text-purple-300/70 mt-1">until update</div>
          </div>
        </div>

        {/* Next Poll Time */}
        {nextPollTime && (
          <div className="text-center">
            <p className="text-xs text-purple-300/70 mb-1">Next Update At</p>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-400/20">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-blue-400">
                {nextPollTime.toLocaleTimeString('en-IN', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-purple-300/70">Synced with server schedule</span>
        </div>
      </div>
    </div>
  );
};

export default PredictionTimer;
