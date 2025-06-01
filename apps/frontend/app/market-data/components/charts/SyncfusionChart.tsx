// src/components/charts/SyncfusionChart.tsx
'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ChartComponents = dynamic(
  () => import('./SyncfusionChartComponents'),
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

interface SyncfusionChartProps {
  symbol: string;
  data: MarketData | null | undefined;
  height?: number;
}

const SyncfusionChart: React.FC<SyncfusionChartProps> = ({ 
  symbol, 
  data, 
  height = 500 
}) => {
  const [isClient, setIsClient] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    
    const now = new Date();
    const initialData = Array.from({ length: 10 }, (_, i) => ({
      x: new Date(now.getTime() - (10 - i) * 60000),
      open: data?.ltp || 100 + Math.random() * 10,
      high: (data?.ltp || 100) + Math.random() * 15,
      low: (data?.ltp || 100) - Math.random() * 5,
      close: data?.ltp || 100 + Math.random() * 10,
      volume: Math.floor(Math.random() * 1000)
    }));
    setChartData(initialData);
  }, [data?.ltp]);

  useEffect(() => {
    if (!isClient || !data || typeof data.ltp !== 'number' || typeof data.timestamp !== 'number') {
      return;
    }

    try {
      const date = new Date(data.timestamp * 1000);
      
      setChartData(prevData => {
        const existingIndex = prevData.findIndex(
          point => point.x.getTime() === date.getTime()
        );
        
        if (existingIndex >= 0) {
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
          const prevClose = prevData.length > 0 ? prevData[prevData.length - 1].close : data.ltp;
          
          const newPoint = {
            x: date,
            close: data.ltp,
            open: prevClose,
            high: Math.max(prevClose, data.ltp),
            low: Math.min(prevClose, data.ltp),
            volume: 0
          };
          
          const newData = [...prevData, newPoint];
          
          if (newData.length > 300) {
            return newData.slice(-300);
          }
          
          return newData;
        }
      });
    } catch (error) {
      console.error('Error updating SyncfusionChart:', error);
    }
  }, [data, isClient]);

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

export default SyncfusionChart;
