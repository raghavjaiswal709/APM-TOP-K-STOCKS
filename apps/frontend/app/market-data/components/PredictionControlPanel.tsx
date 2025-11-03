'use client';

import React, { useCallback } from 'react';
import { PlayCircle, PauseCircle, RotateCcw, Download } from 'lucide-react';

export interface PredictionControlPanelProps {
  isPolling: boolean;
  elapsedTime: number;
  timeRemaining: number;
  progressPercentage: number;
  pollCount: number;
  nextPollTime?: Date;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onDownload?: () => void;
  disabled?: boolean;
}

export const PredictionControlPanel: React.FC<PredictionControlPanelProps> = ({
  isPolling,
  elapsedTime,
  timeRemaining,
  progressPercentage,
  pollCount,
  nextPollTime,
  onStart,
  onPause,
  onStop,
  onRefresh,
  onDownload,
  disabled = false,
}) => {
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg backdrop-blur-sm p-4 space-y-4">
      {/* Status */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between bg-blue-500/10 p-4 rounded-lg border border-blue-400/20 hover:bg-blue-500/15 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-purple-300/70">Status</span>
          </div>
          <span className="text-lg font-bold text-blue-400">
            {isPolling ? 'Active' : 'Stopped'}
          </span>
        </div>
        
        <div className="flex items-center justify-between bg-purple-500/10 p-4 rounded-lg border border-purple-400/20 hover:bg-purple-500/15 transition-colors">
          <span className="text-sm font-medium text-purple-300/70">Updates</span>
          <span className="text-lg font-bold text-purple-400">{pollCount}</span>
        </div>
        
        <div className="flex items-center justify-between bg-green-500/10 p-4 rounded-lg border border-green-400/20 hover:bg-green-500/15 transition-colors">
          <span className="text-sm font-medium text-purple-300/70">Elapsed</span>
          <span className="text-lg font-bold text-green-400">{formatTime(elapsedTime)}</span>
        </div>
        
        <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-lg border border-amber-400/20 hover:bg-amber-500/15 transition-colors">
          <span className="text-sm font-medium text-purple-300/70">Remaining</span>
          <span className="text-lg font-bold text-amber-400">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-purple-200">Collection Progress</p>
          <p className="text-sm text-purple-300">{Math.round(progressPercentage)}%</p>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Next Poll Time */}
      {nextPollTime && isPolling && (
        <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-400/20">
          <p className="text-sm text-purple-200">
            <span className="font-semibold">Next update:</span>{' '}
            {nextPollTime.toLocaleTimeString('en-IN')}
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        {!isPolling ? (
          <button
            onClick={onStart}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Start Collection
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
          >
            <PauseCircle className="w-4 h-4" />
            Pause
          </button>
        )}

        <button
          onClick={onStop}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={onRefresh}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Refresh Now
        </button>

        {onDownload && (
          <button
            onClick={onDownload}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>
    </div>
  );
};

export default PredictionControlPanel;
