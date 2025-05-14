// src/components/charts/FinancialChart.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const ChartComponents = dynamic(
  () => import('./FinancialChartComponents'),
  { ssr: false, loading: () => (
    <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500">Loading chart components...</div>
    </div>
  )}
);

interface MarketData {
  ltp: number;
  timestamp: number;
}

interface FinancialChartProps {
  symbol: string;
  data: MarketData | null | undefined;
  height?: number;
}

const FinancialChart: React.FC<FinancialChartProps> = ({ 
  symbol, 
  data, 
  height = 500 
}) => {
  const [isClient, setIsClient] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
    
    // Initialize with dummy data
    const now = new Date();
    const initialData = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(now.getTime() - (10 - i) * 60000),
      close: data?.ltp || 100 + Math.random() * 10,
      open: data?.ltp || 100 + Math.random() * 10,
      high: (data?.ltp || 100) + Math.random() * 15,
      low: (data?.ltp || 100) - Math.random() * 5,
      volume: Math.floor(Math.random() * 1000)
    }));
    setChartData(initialData);
  }, [data?.ltp]);

  // Update chart data when new data arrives
  useEffect(() => {
    if (!isClient || !data || typeof data.ltp !== 'number' || typeof data.timestamp !== 'number') {
      return;
    }

    try {
      // Convert timestamp to Date object
      const date = new Date(data.timestamp * 1000);
      
      setChartData(prevData => {
        // Check if we already have a point with this timestamp
        const existingIndex = prevData.findIndex(
          point => point.date.getTime() === date.getTime()
        );
        
        if (existingIndex >= 0) {
          // Update existing point
          const newData = [...prevData];
          const prevPoint = newData[existingIndex];
          
          newData[existingIndex] = {
            ...prevPoint,
            close: data.ltp,
            high: Math.max(prevPoint.high, data.ltp),
            low: Math.min(prevPoint.low, data.ltp)
          };
          return newData;
        } else {
          // Add new point
          const prevClose = prevData.length > 0 ? prevData[prevData.length - 1].close : data.ltp;
          
          const newPoint = {
            date,
            close: data.ltp,
            open: prevClose,
            high: Math.max(prevClose, data.ltp),
            low: Math.min(prevClose, data.ltp),
            volume: 0
          };
          
          const newData = [...prevData, newPoint];
          
          // Keep only the last 300 points for performance
          if (newData.length > 300) {
            return newData.slice(-300);
          }
          
          return newData;
        }
      });
    } catch (error) {
      console.error('Error updating FinancialChart:', error);
    }
  }, [data, isClient]);

  // Show loading during SSR
  if (!isClient) {
    return (
      <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full border border-gray-200 rounded shadow-sm bg-white overflow-hidden" style={{ height }}>
      {chartData.length > 0 ? (
        <ChartComponents 
          data={chartData}
          height={height}
          symbol={symbol}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">Waiting for market data...</div>
        </div>
      )}
    </div>
  );
};

export default FinancialChart;
