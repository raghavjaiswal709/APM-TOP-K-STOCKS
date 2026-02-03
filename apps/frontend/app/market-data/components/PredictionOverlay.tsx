// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { CompanyPredictions } from '@/hooks/usePredictions';
import {
  getConfidenceLevel,
  formatDataAge,
  getPredictionStats,
  aggregatePredictions,
} from '@/lib/predictionUtils';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PredictionOverlayProps {
  predictions: CompanyPredictions | null;
  company: string;
  dataAge: number;
  isStale: boolean;
}

export const PredictionOverlay: React.FC<PredictionOverlayProps> = ({
  predictions,
  company,
  dataAge,
  isStale,
}) => {
  const stats = useMemo(() => {
    if (!predictions) return null;
    return getPredictionStats(predictions);
  }, [predictions]);

  const aggregated = useMemo(() => {
    if (!predictions) return null;
    return aggregatePredictions(predictions);
  }, [predictions]);

  const latestPrediction = useMemo(() => {
    if (!predictions || predictions.count === 0) return null;

    const entries = Object.entries(predictions.predictions);
    if (entries.length === 0) return null;

    const [timestamp, data] = entries[entries.length - 1];
    return { timestamp, ...data };
  }, [predictions]);

  if (!predictions || !stats) {
    return (
      <Card className="border-blue-400/20 bg-gradient-to-br from-blue-500/5 via-card/50 to-blue-600/5 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-8 text-blue-400/60">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50 text-blue-400" />
          <p>No prediction data available</p>
        </CardContent>
      </Card>
    );
  }

  const priceChange = aggregated!.priceChangeFromStart;
  const isPositive = priceChange >= 0;

  return (
    <Card className="h-full overflow-hidden border-blue-400/30 bg-gradient-to-br from-blue-500/5 via-card/50 to-blue-600/5 backdrop-blur-md shadow-lg shadow-blue-500/10">
      <CardHeader className="pb-3 space-y-1 border-b border-blue-400/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight text-blue-400">
              {company} Predictions
            </CardTitle>
            <CardDescription className="text-xs flex items-center gap-2 text-blue-300/70">
              <Activity className="h-3 w-3 text-blue-400" />
              {predictions.count} data points
              <Separator orientation="vertical" className="h-3 bg-blue-400/30" />
              <Clock className="h-3 w-3 text-blue-400" />
              Updated {formatDataAge(dataAge)}
            </CardDescription>
          </div>
          {isStale && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Stale Data
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Latest Prediction Highlight */}
        {latestPrediction && (
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 rounded-lg p-4 border border-blue-400/20 shadow-inner">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-medium text-blue-300/70 mb-1">Latest Forecast</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-blue-400">
                    ₹{latestPrediction.close.toFixed(2)}
                  </span>
                  <span className="text-xs text-blue-300/60">
                    @ {(() => {
                      const d = new Date(latestPrediction.predictedat);
                      return isNaN(d.getTime())
                        ? '--:--'
                        : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    })()}
                  </span>
                </div>
              </div>

              <div className={`flex flex-col items-end ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                <div className="flex items-center gap-1 font-semibold">
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? '+' : ''}₹{Math.abs(priceChange).toFixed(2)}
                </div>
                <span className="text-xs font-medium opacity-80">
                  ({((Math.abs(priceChange) / aggregated!.earliestPrice) * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 p-2 rounded-md bg-blue-400/5 border border-blue-400/10">
            <p className="text-xs font-medium text-blue-300/70">Average</p>
            <p className="text-lg font-semibold tabular-nums text-blue-400">₹{stats.avgPrice}</p>
          </div>
          <div className="space-y-1 p-2 rounded-md bg-green-400/5 border border-green-400/10">
            <p className="text-xs font-medium text-green-300/70">High</p>
            <p className="text-lg font-semibold tabular-nums text-green-400">₹{stats.highPrice}</p>
          </div>
          <div className="space-y-1 p-2 rounded-md bg-red-400/5 border border-red-400/10">
            <p className="text-xs font-medium text-red-300/70">Low</p>
            <p className="text-lg font-semibold tabular-nums text-red-400">₹{stats.lowPrice}</p>
          </div>
          <div className="space-y-1 p-2 rounded-md bg-blue-400/5 border border-blue-400/10">
            <p className="text-xs font-medium text-blue-300/70">Range</p>
            <p className="text-lg font-semibold tabular-nums text-blue-400">₹{stats.priceRange}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionOverlay;
