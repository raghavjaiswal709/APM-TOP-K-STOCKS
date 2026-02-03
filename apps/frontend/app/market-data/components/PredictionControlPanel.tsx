'use client';

import React, { useCallback } from 'react';
import { PlayCircle, PauseCircle, RotateCcw, Download, Clock, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export interface PredictionControlPanelProps {
  isPolling: boolean;
  elapsedTime: number;
  timeRemaining: number;
  progressPercentage: number;
  pollCount: number;
  nextPollTime?: Date | null;
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
    <Card className="h-full border-blue-400/30 bg-gradient-to-br from-blue-500/5 via-card/50 to-blue-600/5 backdrop-blur-sm shadow-lg shadow-blue-500/10">
      <CardHeader className="pb-3 border-b border-blue-400/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Control Panel
          </CardTitle>
          <Badge variant={isPolling ? "default" : "secondary"} className={isPolling ? "bg-green-600 hover:bg-green-700" : "bg-zinc-700/50 border border-zinc-600 text-zinc-400"}>
            {isPolling ? (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Active
              </span>
            ) : (
              'Stopped'
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1 p-2 rounded-md bg-blue-400/5 border border-blue-400/10">
            <span className="text-xs font-medium text-blue-300/70">Updates</span>
            <p className="text-lg font-bold tracking-tight text-blue-400">{pollCount}</p>
          </div>

          <div className="space-y-1 p-2 rounded-md bg-blue-400/5 border border-blue-400/10">
            <span className="text-xs font-medium text-blue-300/70">Elapsed</span>
            <p className="text-lg font-bold tracking-tight font-mono text-blue-400">
              {formatTime(elapsedTime)}
            </p>
          </div>

          <div className="space-y-1 p-2 rounded-md bg-blue-400/5 border border-blue-400/10">
            <span className="text-xs font-medium text-blue-300/70">Remaining</span>
            <p className="text-lg font-bold tracking-tight font-mono text-blue-300/70">
              {formatTime(timeRemaining)}
            </p>
          </div>
        </div>

        <Separator className="bg-blue-400/20" />

        {/* Next Poll Indicator */}
        {nextPollTime && isPolling && (
          <div className="text-xs text-center text-blue-300/70 bg-blue-500/10 py-2 rounded-md border border-blue-400/20 flex items-center justify-center gap-2">
            <Clock className="h-3 w-3 text-blue-400" />
            Next update at <span className="font-medium text-blue-400">
              {isNaN(nextPollTime.getTime()) ? '--:--' : nextPollTime.toLocaleTimeString('en-IN')}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {!isPolling ? (
              <Button
                onClick={onStart}
                disabled={disabled}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="h-4 w-4" />
                Start
              </Button>
            ) : (
              <Button
                onClick={onPause}
                disabled={disabled}
                variant="secondary"
                className="w-full gap-2"
              >
                <PauseCircle className="h-4 w-4" />
                Pause
              </Button>
            )}

            <Button
              onClick={onStop}
              disabled={disabled}
              variant="destructive"
              className="w-full gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onRefresh}
              disabled={disabled}
              variant="outline"
              className="flex-1 gap-2 border-blue-400 text-blue-400 hover:bg-blue-400/10"
            >
              <Loader2 className={`h-4 w-4 ${disabled ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {onDownload && (
              <Button
                onClick={onDownload}
                disabled={disabled}
                variant="outline"
                className="flex-1 gap-2 border-blue-400 text-blue-400 hover:bg-blue-400/10"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionControlPanel;
