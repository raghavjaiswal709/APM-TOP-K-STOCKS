// utils/chartConfig.ts
import { ColorTheme } from '../types/chartTypes';

export const getColorTheme = (lineColor: string): ColorTheme => {
  return {
    bg: '#18181b',
    paper: '#18181b',
    text: '#e4e4e7',
    grid: '#27272a',
    line: lineColor,
    upColor: '#22c55e',
    downColor: '#ef4444',
    button: {
      bg: '#27272a',
      bgActive: '#3b82f6',
      text: '#e4e4e7'
    },
    indicator: {
      sma20: '#f97316',
      ema9: '#8b5cf6',
      rsi: '#06b6d4',
      macd: '#3b82f6',
      bb: '#64748b',
      vwap: '#06b6d4',
      bid: '#22c55e',
      ask: '#ef4444',
      spread: '#3b82f6',
      buyVolume: '#22c55e',
      sellVolume: '#ef4444',
      buyPrice: '#10b981',
      sellPrice: '#f59e0b',
      buySellSpread: '#8b5cf6',
      volume: '#64748b',
      std: '#f97316'
    }
  };
};

export const getLineColor = (prices: number[]) => {
  if (prices.length < 2) return '#22d3ee';
  const lastPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  return lastPrice >= prevPrice ? '#22c55e' : '#ef4444';
};

export const timeframeButtons = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
  { label: '6H', value: '6H' },
  { label: '12H', value: '12H' },
  { label: '1D', value: '1D' },
];
