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

  // Update price history
  useEffect(() => {
    if (!data?.ltp) return;

    setPriceHistory(prev => {
      const newPoint = { timestamp: Date.now(), price: data.ltp };
      const updated = [...prev, newPoint];
      return updated.slice(-30); // Keep last 30 points
    });
  }, [data?.ltp]);

  // Generate SVG path
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
  const primaryColor = isPositive ? '#10B981' : '#EF4444';
  const secondaryColor = isPositive ? '#10B98140' : '#EF444440';

  return (
    <div className="w-full h-full bg-background border rounded overflow-hidden">
      {/* Header */}
      <div className="p-2 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{company.company_code}</span>
          <span className={`text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            ₹{data?.ltp?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative" style={{ height: '140px' }}>
        <svg width="100%" height="140" viewBox="0 0 300 140" className="absolute inset-0">
          {/* Gradient Definition */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
            </linearGradient>
            
            {/* Grid Pattern */}
            <pattern id={`grid-${company.company_code}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill={`url(#grid-${company.company_code})`} />

          {/* Area under curve */}
          {pathData && (
            <path
              d={`${pathData} L 290 140 L 10 140 Z`}
              fill={`url(#${gradientId})`}
            />
          )}

          {/* Price line */}
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

          {/* Data points */}
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

          {/* Current price indicator */}
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

        {/* No data state */}
        {priceHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-sm">Waiting for data...</div>
              <div className="text-xs mt-1">{company.name}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with OHLC data */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-muted/20 border-t text-xs">
        <div className="text-center">
          <div className="text-muted-foreground">Open</div>
          <div className="font-medium">₹{data?.open?.toFixed(2) || '--'}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">High</div>
          <div className="font-medium text-green-600">₹{data?.high?.toFixed(2) || '--'}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Low</div>
          <div className="font-medium text-red-600">₹{data?.low?.toFixed(2) || '--'}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Vol</div>
          <div className="font-medium">{data?.volume ? (data.volume / 1000).toFixed(0) + 'K' : '--'}</div>
        </div>
      </div>
    </div>
  );
};

export default GridChart;



//other
// 'use client';
// import React, { useEffect, useRef, useState } from 'react';

// interface Company {
//   company_code: string;
//   name: string;
//   exchange: string;
//   marker: string;
//   symbol: string;
// }

// interface MarketData {
//   symbol: string;
//   ltp: number;
//   change?: number;
//   changePercent?: number;
//   open?: number;
//   high?: number;
//   low?: number;
//   close?: number;
//   volume?: number;
//   timestamp: number;
// }

// interface GridChartProps {
//   symbol: string;
//   data: MarketData;
//   company: Company;
// }

// const GridChart: React.FC<GridChartProps> = ({ symbol, data, company }) => {
//   const chartContainerRef = useRef<HTMLDivElement>(null);
//   const chartRef = useRef<any>(null);
//   const seriesRef = useRef<any>(null);
//   const [isChartReady, setIsChartReady] = useState(false);
//   const [hasError, setHasError] = useState(false);
//   const dataPointsRef = useRef<any[]>([]);

//   // Initialize chart with proper error handling
//   useEffect(() => {
//     if (!chartContainerRef.current) return;

//     try {
//       // Dynamic import to handle different versions
//       import('lightweight-charts').then((LightweightCharts) => {
//         try {
//           const chart = LightweightCharts.createChart(chartContainerRef.current!, {
//             width: chartContainerRef.current!.clientWidth,
//             height: 192,
//             layout: {
//               background: { type: LightweightCharts.ColorType.Solid, color: 'transparent' },
//               textColor: '#6B7280',
//               fontSize: 11,
//             },
//             grid: {
//               vertLines: { color: '#E5E7EB' },
//               horzLines: { color: '#E5E7EB' },
//             },
//             timeScale: {
//               timeVisible: true,
//               secondsVisible: false,
//               borderColor: '#E5E7EB',
//             },
//             rightPriceScale: {
//               borderColor: '#E5E7EB',
//               scaleMargins: { top: 0.1, bottom: 0.1 },
//             },
//             crosshair: { mode: 1 },
//             handleScroll: { mouseWheel: false, pressedMouseMove: false },
//             handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false },
//           });

//           // Try different API syntaxes
//           let lineSeries;
//           try {
//             // Method 1: Modern API
//             lineSeries = chart.addSeries('Line', {
//               color: data?.change && data.change >= 0 ? '#10B981' : '#EF4444',
//               lineWidth: 2,
//             });
//           } catch (e1) {
//             try {
//               // Method 2: Legacy API
//               lineSeries = chart.addLineSeries({
//                 color: data?.change && data.change >= 0 ? '#10B981' : '#EF4444',
//                 lineWidth: 2,
//               });
//             } catch (e2) {
//               try {
//                 // Method 3: Alternative syntax
//                 lineSeries = chart.addSeries(LightweightCharts.SeriesType.Line, {
//                   color: data?.change && data.change >= 0 ? '#10B981' : '#EF4444',
//                   lineWidth: 2,
//                 });
//               } catch (e3) {
//                 console.error('All chart creation methods failed:', e1, e2, e3);
//                 setHasError(true);
//                 return;
//               }
//             }
//           }

//           chartRef.current = chart;
//           seriesRef.current = lineSeries;
//           setIsChartReady(true);
//           setHasError(false);

//         } catch (error) {
//           console.error('Error creating chart:', error);
//           setHasError(true);
//         }
//       }).catch((error) => {
//         console.error('Error importing lightweight-charts:', error);
//         setHasError(true);
//       });

//     } catch (error) {
//       console.error('Error in chart initialization:', error);
//       setHasError(true);
//     }

//     return () => {
//       if (chartRef.current) {
//         try {
//           chartRef.current.remove();
//         } catch (e) {
//           console.warn('Error removing chart:', e);
//         }
//         chartRef.current = null;
//         seriesRef.current = null;
//         setIsChartReady(false);
//       }
//     };
//   }, []);

//   // Update chart data
//   useEffect(() => {
//     if (!isChartReady || !seriesRef.current || !data || hasError) return;

//     try {
//       const timestamp = Math.floor(data.timestamp);
//       const newPoint = {
//         time: timestamp,
//         value: data.ltp,
//       };

//       // Simple data update
//       if (dataPointsRef.current.length > 50) {
//         dataPointsRef.current = dataPointsRef.current.slice(-49);
//       }
      
//       dataPointsRef.current.push(newPoint);
//       seriesRef.current.setData(dataPointsRef.current);

//       if (chartRef.current) {
//         chartRef.current.timeScale().fitContent();
//       }

//     } catch (error) {
//       console.error('Error updating chart data:', error);
//       setHasError(true);
//     }
//   }, [data, isChartReady, hasError]);

//   // Handle resize
//   useEffect(() => {
//     const handleResize = () => {
//       if (chartRef.current && chartContainerRef.current && !hasError) {
//         try {
//           chartRef.current.applyOptions({
//             width: chartContainerRef.current.clientWidth,
//             height: 192
//           });
//         } catch (error) {
//           console.warn('Error resizing chart:', error);
//         }
//       }
//     };

//     window.addEventListener('resize', handleResize);
//     return () => window.removeEventListener('resize', handleResize);
//   }, [hasError]);

//   // Fallback to SVG if lightweight-charts fails
//   if (hasError) {
//     return <SVGChart data={data} company={company} />;
//   }

//   return (
//     <div className="relative w-full h-full">
//       <div 
//         ref={chartContainerRef} 
//         className="w-full h-full"
//         style={{ minHeight: '192px' }}
//       />
      
//       {!isChartReady && !hasError && (
//         <div className="absolute inset-0 flex items-center justify-center bg-background/80">
//           <div className="text-sm text-muted-foreground">Loading chart...</div>
//         </div>
//       )}
//     </div>
//   );
// };

// // **SVG Fallback Component** (Always works)
// const SVGChart: React.FC<{ data: MarketData; company: Company }> = ({ data, company }) => {
//   const [dataPoints, setDataPoints] = useState<Array<{x: number, y: number, price: number}>>([]);

//   useEffect(() => {
//     if (!data?.ltp) return;

//     const newPoint = {
//       x: Date.now(),
//       y: data.ltp,
//       price: data.ltp
//     };

//     setDataPoints(prev => {
//       const updated = [...prev, newPoint];
//       return updated.slice(-20); // Keep last 20 points
//     });
//   }, [data?.ltp]);

//   const svgPoints = dataPoints.map((point, index) => ({
//     x: (index / Math.max(dataPoints.length - 1, 1)) * 280 + 10,
//     y: 150 - ((point.price - Math.min(...dataPoints.map(p => p.price))) / 
//          (Math.max(...dataPoints.map(p => p.price)) - Math.min(...dataPoints.map(p => p.price)) || 1)) * 120
//   }));

//   const pathData = svgPoints.length > 0 ? 
//     `M ${svgPoints[0].x} ${svgPoints[0].y} ` + 
//     svgPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') : '';

//   const isPositive = (data?.change || 0) >= 0;
//   const color = isPositive ? '#10B981' : '#EF4444';

//   return (
//     <div className="w-full h-full bg-background border rounded">
//       <svg width="100%" height="192" viewBox="0 0 300 192" className="w-full h-full">
//         {/* Grid */}
//         <defs>
//           <pattern id={`grid-${company.company_code}`} width="30" height="20" patternUnits="userSpaceOnUse">
//             <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
//           </pattern>
//         </defs>
//         <rect width="100%" height="100%" fill={`url(#grid-${company.company_code})`} />
        
//         {/* Price line */}
//         {pathData && (
//           <path
//             d={pathData}
//             fill="none"
//             stroke={color}
//             strokeWidth="2"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//           />
//         )}
        
//         {/* Price points */}
//         {svgPoints.map((point, index) => (
//           <circle
//             key={index}
//             cx={point.x}
//             cy={point.y}
//             r={index === svgPoints.length - 1 ? "4" : "2"}
//             fill={color}
//             opacity={index === svgPoints.length - 1 ? 1 : 0.7}
//           />
//         ))}
        
//         {/* Current price label */}
//         {data?.ltp && svgPoints.length > 0 && (
//           <text
//             x={svgPoints[svgPoints.length - 1]?.x + 5}
//             y={svgPoints[svgPoints.length - 1]?.y - 5}
//             fill={color}
//             fontSize="11"
//             fontWeight="600"
//           >
//             ₹{data.ltp.toFixed(2)}
//           </text>
//         )}
//       </svg>
      
//       {/* OHLC Footer */}
//       <div className="flex justify-between text-xs p-2 bg-muted/20 border-t">
//         <span>O: ₹{data?.open?.toFixed(2) || '--'}</span>
//         <span className="text-green-600">H: ₹{data?.high?.toFixed(2) || '--'}</span>
//         <span className="text-red-600">L: ₹{data?.low?.toFixed(2) || '--'}</span>
//         <span>V: {data?.volume?.toLocaleString() || '0'}</span>
//       </div>
//     </div>
//   );
// };

// export default GridChart;
