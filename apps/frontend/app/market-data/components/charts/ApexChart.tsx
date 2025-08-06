
'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
// Import ApexCharts with dynamic loading (no SSR)
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
interface MarketData {
  ltp: number;
  timestamp: number;
}
interface ApexChartProps {
  symbol: string;
  data: MarketData | null | undefined;
  height?: number;
  width?: string;
}
const ApexChart: React.FC<ApexChartProps> = ({ 
  symbol, 
  data, 
  height = 500, 
  width = '100%' 
}) => {
  const [isClient, setIsClient] = useState(false);
  const [chartData, setChartData] = useState<[number, number][]>([]);
  const [options, setOptions] = useState<any>({
    chart: {
      id: 'market-chart',
      type: 'line',
      height: height,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        autoSelected: 'zoom'
      },
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: {
          speed: 1000
        }
      },
      background: 'transparent',
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    colors: ['#2962FF'],
    title: {
      text: `${symbol} Price Chart`,
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333'
      }
    },
    grid: {
      borderColor: '#f1f1f1',
      row: {
        colors: ['transparent', 'transparent'],
        opacity: 0.5
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'HH:mm:ss',
      },
      title: {
        text: 'Time',
        style: {
          fontSize: '12px',
          fontWeight: 'normal'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Price (₹)',
        style: {
          fontSize: '12px',
          fontWeight: 'normal'
        }
      },
      labels: {
        formatter: (value: number) => `₹${value.toFixed(2)}`
      }
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy HH:mm:ss'
      },
      y: {
        formatter: (value: number) => `₹${value.toFixed(2)}`
      },
      theme: 'light'
    },
    markers: {
      size: 0,
      hover: {
        size: 5
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right'
    }
  });
  useEffect(() => {
    setIsClient(true);
    const now = Date.now();
    const initialData: [number, number][] = [];
    for (let i = 10; i > 0; i--) {
      initialData.push([now - i * 60000, data?.ltp || 100 + Math.random() * 10]);
    }
    setChartData(initialData);
    setOptions(prevOptions => ({
      ...prevOptions,
      title: {
        ...prevOptions.title,
        text: `${symbol} Price Chart`
      }
    }));
  }, [symbol, data?.ltp]);
  useEffect(() => {
    if (!isClient || !data || typeof data.ltp !== 'number' || typeof data.timestamp !== 'number') {
      return;
    }
    try {
      const timestamp = data.timestamp * 1000;
      setChartData(prevData => {
        const existingIndex = prevData.findIndex(point => point[0] === timestamp);
        if (existingIndex >= 0) {
          const newData = [...prevData];
          newData[existingIndex] = [timestamp, data.ltp];
          return newData;
        } else {
          const newData = [...prevData, [timestamp, data.ltp]];
          if (newData.length > 300) {
            return newData.slice(-300);
          }
          return newData;
        }
      });
    } catch (error) {
      console.error('Error updating ApexChart:', error);
    }
  }, [data, isClient]);
  if (!isClient) {
    return (
      <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    );
  }
  const series = [{
    name: symbol,
    data: chartData
  }];
  return (
    <div className="relative w-full h-full border border-gray-200 rounded shadow-sm bg-white overflow-hidden">
      {chartData.length > 0 ? (
        <ReactApexChart 
          options={options} 
          series={series} 
          type="line" 
          height={height} 
          width={width}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">Waiting for market data...</div>
        </div>
      )}
    </div>
  );
};
export default ApexChart;

