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

  useEffect(() => {
    setIsClient(true);
    console.log('MarketChart component mounted');
  }, []);

  const createDummyData = () => {
    const now = Math.floor(Date.now() / 1000);
    const initialData: LineData[] = [];
    
    for (let i = 10; i > 0; i--) {
      initialData.push({
        time: (now - i * 60) as UTCTimestamp,
        value: data?.ltp || 100 + Math.random() * 10
      });
    }
    
    return initialData;
  };

  const initializeChart = () => {
    if (!chartContainerRef.current) {
      console.log('Chart container ref is not available');
      return false;
    }

    try {
      const initialData = createDummyData();
      dataPointsRef.current = initialData;
      
      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight;
      
      console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
      
      if (containerWidth <= 0 || containerHeight <= 0) {
        console.log('Container has zero dimensions, will retry');
        return false;
      }
      
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
      
      seriesRef.current = chartRef.current.addSeries({
        color: '#2962FF',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
        title: symbol,
      });
      
      seriesRef.current.setData(initialData);
      
      chartRef.current.timeScale().fitContent();
      
      setIsChartInitialized(true);
      console.log('Chart initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Error initializing chart:', error);
      
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

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || chartRef.current) return;
    
    const frameId = requestAnimationFrame(() => {
      setTimeout(() => {
        const success = initializeChart();
        
        if (!success && initializationAttempt < 5) {
          setInitializationAttempt(prev => prev + 1);
        }
      }, 300); 
    });
    
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isClient, initializationAttempt]);
  
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
      const newTime = Math.floor(data.timestamp) as UTCTimestamp;
      const newValue = data.ltp;
      
      const existingIndex = dataPointsRef.current.findIndex(p => p.time === newTime);
      
      if (existingIndex >= 0) {
        dataPointsRef.current[existingIndex].value = newValue;
        
        const sortedData = [...dataPointsRef.current].sort((a, b) => 
          (a.time as number) - (b.time as number)
        );
        seriesRef.current.setData(sortedData);
      } else {
        const newPoint: LineData = { time: newTime, value: newValue };
        dataPointsRef.current.push(newPoint);
        
        dataPointsRef.current.sort((a, b) => (a.time as number) - (b.time as number));
        
        seriesRef.current.update(newPoint);
      }
      
      if (dataPointsRef.current.length > 300) {
        dataPointsRef.current = dataPointsRef.current.slice(-300);
      }
      
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
      }
    } catch (error) {
      console.error('Error updating chart:', error);
      
      if (seriesRef.current && dataPointsRef.current.length > 0) {
        try {
          console.log('Attempting recovery by setting all data');
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

  useEffect(() => {
    if (!isClient || !isChartInitialized || !seriesRef.current) return;
    
    console.log(`Symbol changed to ${symbol}. Resetting chart data.`);
    
    try {
      const initialData = createDummyData();
      dataPointsRef.current = initialData;
      
      seriesRef.current.setData(initialData);
      
      seriesRef.current.applyOptions({
        title: symbol
      });
      
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error resetting chart on symbol change:', error);
    }
  }, [symbol, isChartInitialized, isClient]);

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
