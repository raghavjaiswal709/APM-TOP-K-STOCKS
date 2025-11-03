'use client';

import React, { useMemo } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { CompanyPredictions } from '@/hooks/usePredictions';
import {
  getConfidenceLevel,
  formatDataAge,
  getPredictionStats,
  aggregatePredictions,
} from '@/lib/predictionUtils';

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

  const confidence = useMemo(() => {
    if (!latestPrediction) return null;
    return getConfidenceLevel(latestPrediction.predictedat);
  }, [latestPrediction]);

  if (!predictions || !stats) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg p-4 border border-purple-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f08_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f08_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        <p className="relative text-center text-purple-300/70">No prediction data available</p>
      </div>
    );
  }

  const priceChange = aggregated!.priceChangeFromStart;
  const isPositive = priceChange >= 0;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg p-4 border border-purple-500/20 shadow-2xl">
      {/* AI Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.08),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f08_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f08_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      {/* Animated Glow Effects */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-4000"></div>
      
      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {/* <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse animation-delay-200"></div>
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse animation-delay-400"></div>
              </div>
              <span className="text-xs font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI POWERED
              </span>
            </div> */}
            <h3 className="font-bold text-white text-lg">
              {company} Predictions
            </h3>
            <p className="text-xs text-purple-300/70">
              {predictions.count} predictions | Updated {formatDataAge(dataAge)}
            </p>
          </div>
          {isStale && (
            <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold border border-yellow-500/30">
              <AlertCircle className="w-3 h-3" />
              Stale
            </div>
          )}
        </div>

        {/* Latest Prediction */}
        {latestPrediction && (
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-400/30 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300/70">Latest Prediction</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  ₹{latestPrediction.close.toFixed(2)}
                </p>
                <p className="text-xs text-purple-300/50">
                  {new Date(latestPrediction.predictedat).toLocaleTimeString('en-IN')}
                </p>
              </div>
              {/* <div className="text-right">
                <p className="text-xs text-purple-300/70">Confidence</p>
                <div className={`text-xl font-bold ${confidence?.level === 'high' ? 'text-green-400' : confidence?.level === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                  {confidence?.percentage.toFixed(0)}%
                </div>
                <p className="text-xs text-purple-300/50">{confidence?.label}</p>
              </div> */}
            </div>
          </div>
        )}

        {/* Price Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-purple-500/10 rounded p-2 border border-purple-400/20 backdrop-blur-sm">
            <p className="text-xs text-purple-300/70">Average</p>
            <p className="font-bold text-white">₹{stats.avgPrice}</p>
          </div>
          <div className="bg-green-500/10 rounded p-2 border border-green-400/20 backdrop-blur-sm">
            <p className="text-xs text-green-300/70">High</p>
            <p className="font-bold text-green-400">₹{stats.highPrice}</p>
          </div>
          <div className="bg-red-500/10 rounded p-2 border border-red-400/20 backdrop-blur-sm">
            <p className="text-xs text-red-300/70">Low</p>
            <p className="font-bold text-red-400">₹{stats.lowPrice}</p>
          </div>
          <div className="bg-pink-500/10 rounded p-2 border border-pink-400/20 backdrop-blur-sm">
            <p className="text-xs text-pink-300/70">Range</p>
            <p className="font-bold text-pink-400">₹{stats.priceRange}</p>
          </div>
        </div>

        {/* Price Change */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg p-3 border border-purple-400/20 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-purple-200">Price Change Forecast</span>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'} font-bold`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}₹{Math.abs(priceChange).toFixed(2)}
              <span className="text-xs">
                ({((Math.abs(priceChange) / aggregated!.earliestPrice) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Data Quality */}
        {/* <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 rounded-lg p-3 border border-purple-400/20 backdrop-blur-sm text-xs">
          <p className="font-semibold text-purple-200 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Data Quality
          </p>
          <div className="space-y-1 text-purple-300/70">
            <p>✓ Avg prediction age: {stats.avgAgeMins} minutes</p>
            <p>✓ Max age: {stats.maxAgeMins} minutes</p>
            <p>✓ Min age: {stats.minAgeMins} minutes</p>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default PredictionOverlay;
