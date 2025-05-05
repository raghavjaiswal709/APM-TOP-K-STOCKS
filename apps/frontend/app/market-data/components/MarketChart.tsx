// // 'use client';

// // import React, { useEffect, useRef, useState } from 'react';
// // import {
// //   createChart,
// //   ColorType,
// //   LineSeries,
// //   ISeriesApi,
// //   UTCTimestamp, // Use UTCTimestamp for clarity
// //   Time, // Time type includes UTCTimestamp
// //   LineData, // Type for data points
// //   ChartOptions, // For chart options type safety
// //   DeepPartial,
// // } from 'lightweight-charts';

// // // Interface for the data received from the backend WebSocket
// // interface MarketData {
// //   ltp: number;
// //   change?: number; // Optional fields based on backend
// //   changePercent?: number;
// //   open?: number;
// //   high?: number;
// //   low?: number;
// //   close?: number;
// //   volume?: number;
// //   timestamp: number; // Crucial: Assuming this is UNIX timestamp in SECONDS from Fyers
// //   // Add bid/ask if your backend sends them
// //   bid?: number;
// //   ask?: number;
// // }

// // interface MarketChartProps {
// //   symbol: string; // The currently selected symbol
// //   data: MarketData | null | undefined; // The latest data point for the selected symbol
// // }

// // const MarketChart: React.FC<MarketChartProps> = ({ symbol, data }) => {
// //   const chartContainerRef = useRef<HTMLDivElement>(null);
// //   // Explicitly type chart and series refs for better intellisense and safety
// //   const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
// //   const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
// //   // Local state to track if the chart has been initialized
// //   const [isChartInitialized, setIsChartInitialized] = useState(false);

// //   // --- Chart Initialization Effect ---
// //   useEffect(() => {
// //     if (!chartContainerRef.current || chartRef.current) {
// //       // Don't re-initialize if already created or container not ready
// //       return;
// //     }

// //     const chartOptions: DeepPartial<ChartOptions> = {
// //       layout: {
// //         background: { type: ColorType.Solid, color: 'transparent' },
// //         textColor: 'rgba(255, 255, 255, 0.9)', // Adjust based on your theme
// //       },
// //       grid: {
// //         vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
// //         horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
// //       },
// //       timeScale: {
// //         timeVisible: true, // Show time on the axis
// //         secondsVisible: true, // Show seconds for real-time data clarity
// //         // Fix: Ensure timescale ticks don't overlap excessively on frequent updates
// //         minBarSpacing: 0.1,
// //       },
// //       width: chartContainerRef.current.clientWidth,
// //       height: 300, // Fixed height, adjust as needed
// //       // Improve real-time scrolling behavior
// //       rightPriceScale: {
// //         scaleMargins: {
// //           top: 0.1, // 10% margin above
// //           bottom: 0.1, // 10% margin below
// //         },
// //       },
// //       // Handle zooming and panning
// //       handleScroll: true,
// //       handleScale: true,
// //     };

// //     chartRef.current = createChart(chartContainerRef.current, chartOptions);
// //     seriesRef.current = chartRef.current.addSeries(LineSeries, {
// //       color: '#2962FF', // Blue line color
// //       lineWidth: 2,
// //       // Optional: Improve visual appearance
// //       lastValueVisible: true, // Show last value label on price scale
// //       priceLineVisible: true, // Show horizontal line at the last price
// //     });

// //     setIsChartInitialized(true); // Mark chart as initialized
// //     console.log('Lightweight Chart Initialized');

// //     // --- Resize Handler ---
// //     const handleResize = () => {
// //       if (chartRef.current && chartContainerRef.current) {
// //         chartRef.current.resize(
// //           chartContainerRef.current.clientWidth,
// //           300, // Keep height consistent or read from container
// //         );
// //       }
// //     };

// //     window.addEventListener('resize', handleResize);

// //     // --- Cleanup on Unmount ---
// //     return () => {
// //       window.removeEventListener('resize', handleResize);
// //       if (chartRef.current) {
// //         chartRef.current.remove();
// //         console.log('Lightweight Chart Removed');
// //       }
// //       chartRef.current = null;
// //       seriesRef.current = null;
// //       setIsChartInitialized(false);
// //     };
// //   }, []); // Empty dependency array: Runs only once on mount

// //   // --- Data Update Effect ---
// //   useEffect(() => {
// //     // Exit if chart is not ready or data is invalid/missing
// //     if (
// //       !isChartInitialized ||
// //       !seriesRef.current ||
// //       !data ||
// //       typeof data.ltp !== 'number' ||
// //       typeof data.timestamp !== 'number' // Ensure timestamp exists and is a number
// //     ) {
// //       return;
// //     }

// //     // --- Use Timestamp from Backend (Fyers) ---
// //     // Assuming data.timestamp is UNIX timestamp in SECONDS
// //     const newTime = data.timestamp as UTCTimestamp; // Cast for type safety
// //     const newValue = data.ltp;
// //     const newPoint: LineData = { time: newTime, value: newValue };

// //     try {
// //       // --- Use update() for efficiency and automatic duplicate handling ---
// //       // lightweight-charts v4+ `update` method handles duplicate timestamps
// //       // by updating the existing point's value. No manual check needed!
// //       seriesRef.current.update(newPoint);
// //     } catch (error) {
// //       // Log errors during update, potentially related to data format
// //       console.error(
// //         `Error updating chart series for ${symbol}:`,
// //         error,
// //         'Data point:',
// //         newPoint,
// //       );
// //     }

// //     // Optional: Auto-scroll to the latest bar (might be slightly jittery on very fast updates)
// //     // Consider adding a user toggle for this behavior
// //     // chartRef.current?.timeScale().scrollToRealTime();

// //   }, [data, isChartInitialized]); // Re-run ONLY when `data` or `isChartInitialized` changes

// //   // --- Symbol Change Effect ---
// //   useEffect(() => {
// //     // When the symbol changes, clear the existing series data
// //     if (seriesRef.current && isChartInitialized) {
// //       console.log(`Symbol changed to ${symbol}. Clearing chart data.`);
// //       seriesRef.current.setData([]); // Clear all data points for the new symbol
// //       // History loading could potentially go here if needed
// //     }
// //     // NOTE: Do NOT clear dataPoints.current here, it's managed by the update effect
// //   }, [symbol, isChartInitialized]); // Re-run when `symbol` or `isChartInitialized` changes

// //   // --- Render ---
// //   return (
// //     <div className="w-full h-[300px]" ref={chartContainerRef} />
// //     // Ensure parent container allows this div to have width/height
// //   );
// // };

// // export default MarketChart;


// 'use client';

// import React, { useEffect, useRef, useState } from 'react';
// import { createChart, ColorType, LineSeries, ISeriesApi, UTCTimestamp, Time, LineData, ChartOptions, DeepPartial } from 'lightweight-charts';

// interface MarketData {
//   ltp: number;
//   change?: number;
//   changePercent?: number;
//   open?: number;
//   high?: number;
//   low?: number;
//   close?: number;
//   volume?: number;
//   timestamp: number; // Crucial: Assuming this is UNIX timestamp in SECONDS from Fyers
//   bid?: number;
//   ask?: number;
// }

// interface MarketChartProps {
//   symbol: string;
//   data: MarketData | null | undefined;
// }

// const MarketChart: React.FC<MarketChartProps> = ({ symbol, data }) => {
//   const chartContainerRef = useRef<HTMLDivElement>(null);
//   const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
//   const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
//   const [isChartInitialized, setIsChartInitialized] = useState(false);

//   // Chart Initialization Effect
//   useEffect(() => {
//     if (!chartContainerRef.current || chartRef.current) {
//       return;
//     }

//     const chartOptions: DeepPartial<ChartOptions> = {
//       layout: {
//         background: { type: ColorType.Solid, color: 'transparent' },
//         textColor: 'rgba(255, 255, 255, 0.9)',
//       },
//       grid: {
//         vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
//         horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
//       },
//       timeScale: {
//         timeVisible: true,
//         secondsVisible: true,
//         minBarSpacing: 0.1,
//       },
//       width: chartContainerRef.current.clientWidth,
//       height: 300,
//       rightPriceScale: {
//         scaleMargins: {
//           top: 0.1,
//           bottom: 0.1,
//         },
//       },
//       handleScroll: true,
//       handleScale: true,
//     };

//     chartRef.current = createChart(chartContainerRef.current, chartOptions);
//     seriesRef.current = chartRef.current.addSeries(LineSeries, {
//       color: '#2962FF',
//       lineWidth: 2,
//       lastValueVisible: true,
//       priceLineVisible: true,
//     });

//     setIsChartInitialized(true);
//     console.log('Lightweight Chart Initialized');

//     // Resize Handler
//     const handleResize = () => {
//       if (chartRef.current && chartContainerRef.current) {
//         chartRef.current.resize(
//           chartContainerRef.current.clientWidth,
//           300,
//         );
//       }
//     };

//     window.addEventListener('resize', handleResize);

//     // Cleanup on Unmount
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       if (chartRef.current) {
//         chartRef.current.remove();
//         console.log('Lightweight Chart Removed');
//       }
//       chartRef.current = null;
//       seriesRef.current = null;
//       setIsChartInitialized(false);
//     };
//   }, []);

//   // Data Update Effect
//   useEffect(() => {
//     if (
//       !isChartInitialized ||
//       !seriesRef.current ||
//       !data ||
//       typeof data.ltp !== 'number' ||
//       typeof data.timestamp !== 'number'
//     ) {
//       return;
//     }

//     // Use Timestamp from Backend (Fyers)
//     const newTime = data.timestamp as UTCTimestamp;
//     const newValue = data.ltp;
//     const newPoint: LineData = { time: newTime, value: newValue };

//     try {
//       // Use update() for efficiency and automatic duplicate handling
//       seriesRef.current.update(newPoint);
//     } catch (error) {
//       console.error(
//         `Error updating chart series for ${symbol}:`,
//         error,
//         'Data point:',
//         newPoint,
//       );
//     }
//   }, [data, isChartInitialized, symbol]);

//   // Symbol Change Effect
//   useEffect(() => {
//     if (seriesRef.current && isChartInitialized) {
//       console.log(`Symbol changed to ${symbol}. Clearing chart data.`);
//       seriesRef.current.setData([]);
//     }
//   }, [symbol, isChartInitialized]);

//   return (
//     <div className="w-full h-[300px]" ref={chartContainerRef} />
//   );
// };

// export default MarketChart;

'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineSeries, ISeriesApi, UTCTimestamp, LineData, ChartOptions, DeepPartial } from 'lightweight-charts';

interface MarketData {
  ltp: number;
  timestamp: number;
}

interface MarketChartProps {
  symbol: string;
  data: MarketData | null | undefined;
}

const MarketChart: React.FC<MarketChartProps> = ({ symbol, data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [isChartInitialized, setIsChartInitialized] = useState(false);
  const dataPointsRef = useRef<Map<number, number>>(new Map());
  // Add this state to track client-side rendering
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Chart Initialization Effect - only run on client
  useEffect(() => {
    if (!isClient || !chartContainerRef.current || chartRef.current) {
      return;
    }

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        minBarSpacing: 0.1,
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      handleScroll: true,
      handleScale: true,
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    seriesRef.current = chartRef.current.addSeries({
      color: '#2962FF',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    setIsChartInitialized(true);
    console.log('Lightweight Chart Initialized');

    // Resize Handler
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.resize(
          chartContainerRef.current.clientWidth,
          300,
        );
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on Unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        console.log('Lightweight Chart Removed');
      }
      chartRef.current = null;
      seriesRef.current = null;
      setIsChartInitialized(false);
    };
  }, [isClient]); // Add isClient as a dependency

  // Data Update Effect
  useEffect(() => {
    if (
      !isClient || // Only run on client
      !isChartInitialized ||
      !seriesRef.current ||
      !data ||
      typeof data.ltp !== 'number' ||
      typeof data.timestamp !== 'number'
    ) {
      return;
    }

    // Use Timestamp from Backend (Fyers)
    const newTime = data.timestamp as UTCTimestamp;
    const newValue = data.ltp;
    
    // Store the data point
    dataPointsRef.current.set(newTime, newValue);
    
    // Create a new point
    const newPoint: LineData = { time: newTime, value: newValue };

    try {
      // Update the chart
      seriesRef.current.update(newPoint);
    } catch (error) {
      console.error(
        `Error updating chart series for ${symbol}:`,
        error,
        'Data point:',
        newPoint,
      );
    }
  }, [data, isChartInitialized, symbol, isClient]); // Add isClient as a dependency

  // Symbol Change Effect
  useEffect(() => {
    if (!isClient) return; // Only run on client
    
    if (seriesRef.current && isChartInitialized) {
      console.log(`Symbol changed to ${symbol}. Clearing chart data.`);
      seriesRef.current.setData([]);
      dataPointsRef.current.clear();
    }
  }, [symbol, isChartInitialized, isClient]); // Add isClient as a dependency

  // Show a placeholder during server-side rendering
  if (!isClient) {
    return <div className="w-full h-[300px] bg-gray-100 flex items-center justify-center">Loading chart...</div>;
  }

  return (
    <div className="w-full h-[300px]" ref={chartContainerRef} />
  );
};

export default MarketChart;
