'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi, UTCTimestamp, LineData } from 'lightweight-charts';

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
  const dataPointsRef = useRef<LineData[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [chartHeight] = useState(500);
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
    console.log('MarketChart component mounted');
  }, []);

  // Create dummy data function
  const createDummyData = () => {
    const now = Math.floor(Date.now() / 1000);
    const initialData: LineData[] = [];
    
    // Create multiple data points with different timestamps
    for (let i = 10; i > 0; i--) {
      initialData.push({
        time: (now - i * 60) as UTCTimestamp,
        value: data?.ltp || 100 + Math.random() * 10
      });
    }
    
    return initialData;
  };

  // Initialize chart function - separate from the effect for clarity
  const initializeChart = () => {
    if (!chartContainerRef.current) {
      console.log('Chart container ref is not available');
      return false;
    }

    try {
      // Create dummy data first
      const initialData = createDummyData();
      dataPointsRef.current = initialData;
      
      // First, render a hidden div to ensure the container has dimensions
      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight;
      
      console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
      
      if (containerWidth <= 0 || containerHeight <= 0) {
        console.log('Container has zero dimensions, will retry');
        return false;
      }
      
      // Create chart with explicit dimensions
      chartRef.current = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: chartHeight,
        layout: {
          background: { type: ColorType.Solid, color: 'white' },
          textColor: '#333',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          minBarSpacing: 10,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
          borderVisible: false,
        },
        crosshair: {
          mode: 1,
        },
        handleScroll: true,
        handleScale: true,
      });
      
      // Create series and set data in one step
      seriesRef.current = chartRef.current.addSeries({
        color: '#2962FF',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
        title: symbol,
      });
      
      // Set initial data immediately
      seriesRef.current.setData(initialData);
      
      // Fit content
      chartRef.current.timeScale().fitContent();
      
      setIsChartInitialized(true);
      console.log('Chart initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Error initializing chart:', error);
      
      // Clean up any partial initialization
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.error('Error removing chart during cleanup:', e);
        }
        chartRef.current = null;
        seriesRef.current = null;
      }
      
      return false;
    }
  };

  // Create and initialize chart
  useEffect(() => {
    if (!isClient || !chartContainerRef.current || chartRef.current) return;
    
    // Use requestAnimationFrame to ensure the DOM is ready
    const frameId = requestAnimationFrame(() => {
      // Use a timeout to give the browser a chance to calculate dimensions
      setTimeout(() => {
        const success = initializeChart();
        
        if (!success && initializationAttempt < 5) {
          // Try again if initialization failed
          setInitializationAttempt(prev => prev + 1);
        }
      }, 300); // Longer timeout to ensure DOM is ready
    });
    
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isClient, initializationAttempt]);
  
  // Handle resize
  useEffect(() => {
    if (!isClient) return;
    
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        if (width > 0) {
          chartRef.current.resize(width, chartHeight);
          chartRef.current.timeScale().fitContent();
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isClient, chartHeight]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.error('Error removing chart:', e);
        }
        chartRef.current = null;
        seriesRef.current = null;
        setIsChartInitialized(false);
      }
    };
  }, []);
  
  // Update chart with new data
  useEffect(() => {
    if (
      !isClient || 
      !isChartInitialized ||
      !seriesRef.current ||
      !data ||
      typeof data.ltp !== 'number' ||
      typeof data.timestamp !== 'number'
    ) {
      return;
    }

    try {
      // Ensure timestamp is valid
      const newTime = Math.floor(data.timestamp) as UTCTimestamp;
      const newValue = data.ltp;
      
      // Check if we already have a point with this timestamp
      const existingIndex = dataPointsRef.current.findIndex(p => p.time === newTime);
      
      if (existingIndex >= 0) {
        // Update existing point
        dataPointsRef.current[existingIndex].value = newValue;
        
        // Need to use setData for updates to existing points
        const sortedData = [...dataPointsRef.current].sort((a, b) => 
          (a.time as number) - (b.time as number)
        );
        seriesRef.current.setData(sortedData);
      } else {
        // Add new point
        const newPoint: LineData = { time: newTime, value: newValue };
        dataPointsRef.current.push(newPoint);
        
        // Sort by time to ensure ascending order
        dataPointsRef.current.sort((a, b) => (a.time as number) - (b.time as number));
        
        // Use update for new points
        seriesRef.current.update(newPoint);
      }
      
      // Limit data points to prevent performance issues
      if (dataPointsRef.current.length > 300) {
        dataPointsRef.current = dataPointsRef.current.slice(-300);
      }
      
      // Scroll to latest data
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
      }
    } catch (error) {
      console.error('Error updating chart:', error);
      
      // Recovery attempt
      if (seriesRef.current && dataPointsRef.current.length > 0) {
        try {
          console.log('Attempting recovery by setting all data');
          // Ensure data is properly sorted
          const sortedData = [...dataPointsRef.current].sort((a, b) => 
            (a.time as number) - (b.time as number)
          );
          seriesRef.current.setData(sortedData);
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
        }
      }
    }
  }, [data, isChartInitialized, isClient]);

  // Symbol change effect
  useEffect(() => {
    if (!isClient || !isChartInitialized || !seriesRef.current) return;
    
    console.log(`Symbol changed to ${symbol}. Resetting chart data.`);
    
    try {
      // Reset data points for new symbol
      const initialData = createDummyData();
      dataPointsRef.current = initialData;
      
      // Update series data
      seriesRef.current.setData(initialData);
      
      // Update title
      seriesRef.current.applyOptions({
        title: symbol
      });
      
      // Fit content
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error resetting chart on symbol change:', error);
    }
  }, [symbol, isChartInitialized, isClient]);

  // Show loading during SSR
  if (!isClient) {
    return (
      <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] border border-gray-200 rounded shadow-sm bg-white overflow-hidden">
      {/* Chart title */}
      <div className="absolute top-2 left-2 z-10 text-sm font-medium text-gray-700">
        {symbol} Price Chart
      </div>
      
      {/* Chart container - explicit dimensions are crucial */}
      <div 
        className="w-full h-full" 
        style={{ 
          width: '100%',
          height: '100%',
          minWidth: '300px',
          minHeight: '300px'
        }} 
        ref={chartContainerRef}
      />
      
      {/* Loading overlay */}
      {!isChartInitialized && (
        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
          <div className="text-blue-500">
            {initializationAttempt > 0 
              ? `Initializing chart (attempt ${initializationAttempt}/5)...` 
              : 'Initializing chart...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketChart;
