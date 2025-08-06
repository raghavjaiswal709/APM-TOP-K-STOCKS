'use client';
import React, { useState, useEffect, useMemo } from 'react';
interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}
interface MarketData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: number;
}
interface GridChartProps {
  symbol: string;
  data: MarketData;
  company: Company;
}
const GridChart: React.FC<GridChartProps> = ({ symbol, data, company }) => {
  const [priceHistory, setPriceHistory] = useState<Array<{timestamp: number, price: number}>>([]);
  useEffect(() => {
    if (!data?.ltp) return;
    setPriceHistory(prev => {
      const newPoint = { timestamp: Date.now(), price: data.ltp };
      const updated = [...prev, newPoint];
      return updated.slice(-30);
    });
  }, [data?.ltp]);
  const { pathData, gradientId } = useMemo(() => {
    if (priceHistory.length < 2) {
      return { pathData: '', gradientId: `gradient-${company.company_code}` };
    }
    const width = 280;
    const height = 140;
    const padding = 10;
    const minPrice = Math.min(...priceHistory.map(p => p.price));
    const maxPrice = Math.max(...priceHistory.map(p => p.price));
    const priceRange = maxPrice - minPrice || 1;
    const points = priceHistory.map((point, index) => {
      const x = padding + (index / (priceHistory.length - 1)) * width;
      const y = padding + ((maxPrice - point.price) / priceRange) * height;
      return { x, y };
    });
    const pathData = `M ${points[0].x} ${points[0].y} ` + 
                    points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return { 
      pathData, 
      gradientId: `gradient-${company.company_code}` 
    };
  }, [priceHistory, company.company_code]);
  const isPositive = (data?.change || 0) >= 0;
  const primaryColor = isPositive ? '#2ca499' : '#ee5351';
  const secondaryColor = isPositive ? '#2ca49940' : '#ee535140';
  return (
    <div className="w-full h-full bg-background border rounded overflow-hidden">
      {}
      <div className="p-2 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{company.company_code}</span>
          <span className={`text-xs font-bold ${isPositive ? 'text-[#2ca499]' : 'text-[#ee5351]'}`}>
            ₹{data?.ltp?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>
      {}
      <div className="relative" style={{ height: '140px' }}>
        <svg width="100%" height="340" viewBox="0 0 300 140" className="absolute inset-0">
          {}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
            </linearGradient>
            {}
            <pattern id={`grid-${company.company_code}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
            </pattern>
          </defs>
          {}
          <rect width="100%" height="100%" fill={`url(#grid-${company.company_code})`} />
          {}
          {pathData && (
            <path
              d={`${pathData} L 290 140 L 10 140 Z`}
              fill={`url(#${gradientId})`}
            />
          )}
          {}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke={primaryColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {}
          {priceHistory.length > 0 && priceHistory.map((_, index) => {
            if (priceHistory.length < 2) return null;
            const width = 280;
            const height = 140;
            const padding = 10;
            const minPrice = Math.min(...priceHistory.map(p => p.price));
            const maxPrice = Math.max(...priceHistory.map(p => p.price));
            const priceRange = maxPrice - minPrice || 1;
            const x = padding + (index / (priceHistory.length - 1)) * width;
            const y = padding + ((maxPrice - priceHistory[index].price) / priceRange) * height;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={index === priceHistory.length - 1 ? "3" : "1.5"}
                fill={primaryColor}
                opacity={index === priceHistory.length - 1 ? 1 : 0.6}
              />
            );
          })}
          {}
          {data?.ltp && priceHistory.length > 0 && (
            <text
              x="250"
              y="20"
              fill={primaryColor}
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
            >
              ₹{data.ltp.toFixed(2)}
            </text>
          )}
        </svg>
        {}
        {priceHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-sm">Waiting for data...</div>
              <div className="text-xs mt-1">{company.name}</div>
            </div>
          </div>
        )}
      </div>
      {}
      {}
    </div>
  );
};
export default GridChart;
//
//       // Dynamic import to handle different versions
//
//
//
//
//
//
//
//
//
//       return updated.slice(-20);

