// app/market-data/components/charts/PlotlyChart.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { 
  ChevronRight, 
  type LucideIcon,
  ArrowTrendingUpIcon,
  BarChartIcon,
  LineChart ,
  CandlestickChart,
  ArrowsRightLeftIcon
} from "lucide-react";

interface DataPoint {
  ltp: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
  bid?: number;
  ask?: number;
}

interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
  tradingHours: {
    start: string;
    end: string;
    current: string;
    isActive: boolean;
  };
}

const PlotlyChart: React.FC<PlotlyChartProps> = ({ 
  symbol, 
  data, 
  historicalData,
  ohlcData = [],
  tradingHours,
}) => {
  const chartRef = useRef<any>(null);
  const spreadChartRef = useRef<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [showIndicators, setShowIndicators] = useState<{
    sma20: boolean;
    ema9: boolean;
    rsi: boolean;
    bidAsk: boolean;
  }>({
    sma20: false,
    ema9: false,
    rsi: false,
    bidAsk: true // Enable bid-ask by default
  });
  
  // Prepare line chart data
  const prepareLineChartData = () => {
    // Combine historical data with current data
    const allData = [...historicalData];
    
    // Add current data point if it's not already in historical data
    if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1] : null;
      
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    
    // Sort by timestamp
    allData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Extract x and y values
    const x = allData.map(point => new Date(point.timestamp * 1000));
    const y = allData.map(point => point.ltp);
    
    // Extract bid and ask data
    const bid = allData.map(point => point.bid || null);
    const ask = allData.map(point => point.ask || null);
    
    // Calculate spread where both bid and ask exist
    const spread = allData.map(point => {
      if (point.ask && point.bid) {
        return point.ask - point.bid;
      }
      return null;
    });
    
    // Extract indicator data if available
    const sma20 = allData.map(point => point.sma_20 || null);
    const ema9 = allData.map(point => point.ema_9 || null);
    const rsi = allData.map(point => point.rsi_14 || null);
    
    return { x, y, allData, sma20, ema9, rsi, bid, ask, spread };
  };
  
  // Prepare candlestick data
  const prepareCandlestickData = () => {
    if (!ohlcData || ohlcData.length === 0) return { x: [], open: [], high: [], low: [], close: [], volume: [] };
    
    const sortedData = [...ohlcData].sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      x: sortedData.map(candle => new Date(candle.timestamp * 1000)),
      open: sortedData.map(candle => candle.open),
      high: sortedData.map(candle => candle.high),
      low: sortedData.map(candle => candle.low),
      close: sortedData.map(candle => candle.close),
      volume: sortedData.map(candle => candle.volume)
    };
  };
  
  // Calculate y-axis range based on visible data
  const calculateYAxisRange = () => {
    const timeRange = getTimeRange();
    if (!timeRange || historicalData.length === 0) return undefined;
    
    const startTime = timeRange[0].getTime() / 1000;
    const endTime = timeRange[1].getTime() / 1000;
    
    // Filter data points within the visible time range
    const visibleData = historicalData.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );
    
    if (visibleData.length === 0) return undefined;
    
    // For line chart
    if (chartType === 'line') {
      const prices = visibleData.map(point => point.ltp);
      const minPrice = Math.min(...prices.filter(p => p !== null && p !== undefined));
      const maxPrice = Math.max(...prices.filter(p => p !== null && p !== undefined));
      
      // Add padding (5% of the range)
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    }
    
    // For candlestick chart
    if (chartType === 'candle' && ohlcData.length > 0) {
      const visibleCandles = ohlcData.filter(
        candle => candle.timestamp >= startTime && candle.timestamp <= endTime
      );
      
      if (visibleCandles.length === 0) return undefined;
      
      const highPrices = visibleCandles.map(candle => candle.high);
      const lowPrices = visibleCandles.map(candle => candle.low);
      
      const minPrice = Math.min(...lowPrices);
      const maxPrice = Math.max(...highPrices);
      
      // Add padding (5% of the range)
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    }
    
    return undefined;
  };
  
  // Calculate bid-ask y-axis range
  const calculateBidAskRange = () => {
    const { bid, ask } = prepareLineChartData();
    
    const validBids = bid.filter(b => b !== null && b !== undefined) as number[];
    const validAsks = ask.filter(a => a !== null && a !== undefined) as number[];
    
    if (validBids.length === 0 || validAsks.length === 0) return undefined;
    
    const minBid = Math.min(...validBids);
    const maxAsk = Math.max(...validAsks);
    
    // Add padding (5% of the range)
    const padding = (maxAsk - minBid) * 0.05;
    return [minBid - padding, maxAsk + padding];
  };
  
  // Calculate spread y-axis range
  const calculateSpreadRange = () => {
    const { spread } = prepareLineChartData();
    
    const validSpreads = spread.filter(s => s !== null && s !== undefined) as number[];
    
    if (validSpreads.length === 0) return [0, 1]; // Default range if no valid spreads
    
    const minSpread = Math.min(...validSpreads);
    const maxSpread = Math.max(...validSpreads);
    
    // Add padding (10% of the range)
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };
  
  // Calculate time range based on selected timeframe
  const getTimeRange = () => {
    if (historicalData.length === 0) return undefined;
    
    const now = data?.timestamp 
      ? new Date(data.timestamp * 1000) 
      : new Date();
    
    let startTime = new Date(now);
    
    switch (selectedTimeframe) {
      case '1m':
        startTime.setMinutes(now.getMinutes() - 1);
        break;
      case '5m':
        startTime.setMinutes(now.getMinutes() - 5);
        break;
      case '10m':
        startTime.setMinutes(now.getMinutes() - 10);
        break;
      case '30m':
        startTime.setMinutes(now.getMinutes() - 30);
        break;
      case '1H':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6H':
        startTime.setHours(now.getHours() - 6);
        break;
      case '12H':
        startTime.setHours(now.getHours() - 12);
        break;
      case '1D':
      default:
        // For 1D, show the entire trading day (9:30 AM to 3:15 PM)
        try {
          const tradingStart = new Date(tradingHours.start);
          return [tradingStart, now > new Date(tradingHours.end) ? new Date(tradingHours.end) : now];
        } catch (e) {
          // Fallback to 24 hours if trading hours are not available
          startTime.setHours(now.getHours() - 24);
        }
    }
    
    return [startTime, now];
  };
  
  // Get color theme (dark mode)
  const getColorTheme = () => {
    return {
      bg: '#18181b',
      paper: '#18181b',
      text: '#e4e4e7',
      grid: '#27272a',
      line: getLineColor(),
      upColor: '#22c55e',
      downColor: '#ef4444',
      button: {
        bg: '#27272a',
        bgActive: '#3b82f6',
        text: '#e4e4e7'
      },
      indicator: {
        sma20: '#f97316',  // Orange
        ema9: '#8b5cf6',   // Purple
        rsi: '#06b6d4',    // Cyan
        bid: '#22c55e',    // Green
        ask: '#ef4444',    // Red
        spread: '#3b82f6'  // Blue
      }
    };
  };
  
  const getLineColor = () => {
    const { y } = prepareLineChartData();
    if (y.length < 2) return '#22d3ee';
    
    const lastPrice = y[y.length - 1];
    const prevPrice = y[y.length - 2];
    
    return lastPrice >= prevPrice ? '#22c55e' : '#ef4444';
  };
  
  // Handle timeframe button click
  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    
    if (!chartRef.current) return;
    
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    
    try {
      // Update x-axis range based on selected timeframe
      // @ts-ignore - Plotly is available globally
      Plotly.relayout(plotDiv, {
        'xaxis.range': getTimeRange(),
        'xaxis.autorange': false,
        'yaxis.range': calculateYAxisRange(),
        'yaxis.autorange': false
      });
      
      // Update spread chart if it exists
      const spreadDiv = document.getElementById('spread-chart');
      if (spreadDiv) {
        // @ts-ignore - Plotly is available globally
        Plotly.relayout(spreadDiv, {
          'xaxis.range': getTimeRange(),
          'xaxis.autorange': false
        });
      }
    } catch (err) {
      console.error('Error updating timeframe:', err);
    }
  };
  
  // Toggle chart type between line and candlestick
  const toggleChartType = () => {
    setChartType(prev => prev === 'line' ? 'candle' : 'line');
  };
  
  // Toggle indicators
  const toggleIndicator = (indicator: 'sma20' | 'ema9' | 'rsi' | 'bidAsk') => {
    setShowIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };
  
  // Handle chart relayout (zoom, pan, etc.)
  const handleRelayout = (eventData: any) => {
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      // User has zoomed or panned - calculate new y-axis range
      const startDate = new Date(eventData['xaxis.range[0]']);
      const endDate = new Date(eventData['xaxis.range[1]']);
      
      const startTime = startDate.getTime() / 1000;
      const endTime = endDate.getTime() / 1000;
      
      // Filter data points within the visible time range
      let visibleData;
      let minValue, maxValue;
      
      if (chartType === 'line') {
        visibleData = historicalData.filter(
          point => point.timestamp >= startTime && point.timestamp <= endTime
        );
        
        if (visibleData.length > 0) {
          const prices = visibleData.map(point => point.ltp);
          minValue = Math.min(...prices.filter(p => p !== null && p !== undefined));
          maxValue = Math.max(...prices.filter(p => p !== null && p !== undefined));
        }
      } else {
        visibleData = ohlcData.filter(
          candle => candle.timestamp >= startTime && candle.timestamp <= endTime
        );
        
        if (visibleData.length > 0) {
          const highPrices = visibleData.map(candle => candle.high);
          const lowPrices = visibleData.map(candle => candle.low);
          
          minValue = Math.min(...lowPrices);
          maxValue = Math.max(...highPrices);
        }
      }
      
      if (minValue !== undefined && maxValue !== undefined) {
        // Add padding (5% of the range)
        const padding = (maxValue - minValue) * 0.05;
        const yRange = [minValue - padding, maxValue + padding];
        
        const plotDiv = document.getElementById('plotly-chart');
        if (plotDiv) {
          // @ts-ignore - Plotly is available globally
          Plotly.relayout(plotDiv, {
            'yaxis.range': yRange,
            'yaxis.autorange': false
          });
        }
      }
      
      // Also update the spread chart with the same x-axis range
      const spreadDiv = document.getElementById('spread-chart');
      if (spreadDiv) {
        // @ts-ignore - Plotly is available globally
        Plotly.relayout(spreadDiv, {
          'xaxis.range': [startDate, endDate],
          'xaxis.autorange': false
        });
      }
    }
  };
  
  // Update chart when data changes
  useEffect(() => {
    if (!chartRef.current) return;
    
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    
    // If chart is not initialized yet, skip update
    if (!initialized) {
      setInitialized(true);
      return;
    }
    
    try {
      if (chartType === 'line') {
        const { x, y } = prepareLineChartData();
        
        if (x.length === 0 || y.length === 0) return;
        
        // Update the line chart data
        // @ts-ignore - Plotly is available globally
        Plotly.update(plotDiv, {
          x: [x],
          y: [y]
        }, {
          'xaxis.range': getTimeRange(),
          'yaxis.range': calculateYAxisRange(),
          'yaxis.autorange': false
        });
      } else {
        const { x, open, high, low, close } = prepareCandlestickData();
        
        if (x.length === 0) return;
        
        // Update the candlestick chart data
        // @ts-ignore - Plotly is available globally
        Plotly.update(plotDiv, {
          x: [x],
          open: [open],
          high: [high],
          low: [low],
          close: [close]
        }, {
          'xaxis.range': getTimeRange(),
          'yaxis.range': calculateYAxisRange(),
          'yaxis.autorange': false
        });
      }
      
      // Update bid-ask data if enabled
      if (showIndicators.bidAsk) {
        const { x, bid, ask } = prepareLineChartData();
        
        // @ts-ignore - Plotly is available globally
        Plotly.update(plotDiv, {
          x: [x, x],
          y: [bid, ask]
        }, {}, [1, 2]);
      }
      
      // Update spread chart if it exists
      const spreadDiv = document.getElementById('spread-chart');
      if (spreadDiv) {
        const { x, spread } = prepareLineChartData();
        
        // @ts-ignore - Plotly is available globally
        Plotly.update(spreadDiv, {
          x: [x],
          y: [spread]
        }, {
          'xaxis.range': getTimeRange(),
          'yaxis.range': calculateSpreadRange(),
          'yaxis.autorange': false
        });
      }
    } catch (err) {
      console.error('Error updating chart:', err);
    }
  }, [data, historicalData, ohlcData, initialized, selectedTimeframe, chartType, showIndicators.bidAsk]);
  
  // Create plot data based on chart type
  const createPlotData = () => {
    const colors = getColorTheme();
    const plotData: any[] = [];
    
    if (chartType === 'line') {
      const { x, y, sma20, ema9, rsi, bid, ask } = prepareLineChartData();
      
      // Main price line
      plotData.push({
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        line: { color: colors.line, width: 2 },
        name: `${symbol} Price`,
        hoverinfo: 'y+text',
        text: x.map(date => date.toLocaleTimeString()),
      });
      
      // Add bid and ask lines if enabled
      if (showIndicators.bidAsk) {
        plotData.push({
          x,
          y: bid,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.bid, width: 1.5, dash: 'dot' },
          name: 'Bid Price',
          yaxis: 'y',
          hoverinfo: 'y+name',
        });
        
        plotData.push({
          x,
          y: ask,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.ask, width: 1.5, dash: 'dot' },
          name: 'Ask Price',
          yaxis: 'y',
          hoverinfo: 'y+name',
        });
      }
      
      // Add indicators if enabled
      if (showIndicators.sma20) {
        plotData.push({
          x,
          y: sma20,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.sma20, width: 1.5, dash: 'solid' },
          name: 'SMA 20',
          hoverinfo: 'y+name',
        });
      }
      
      if (showIndicators.ema9) {
        plotData.push({
          x,
          y: ema9,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.ema9, width: 1.5, dash: 'dash' },
          name: 'EMA 9',
          hoverinfo: 'y+name',
        });
      }
      
      if (showIndicators.rsi) {
        // Add RSI in a separate subplot
        plotData.push({
          x,
          y: rsi,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.rsi, width: 1.5 },
          name: 'RSI (14)',
          yaxis: 'y2',
          hoverinfo: 'y+name',
        });
      }
    } else {
      // Candlestick chart
      const { x, open, high, low, close, volume } = prepareCandlestickData();
      const { bid, ask } = prepareLineChartData();
      
      plotData.push({
        x,
        open,
        high,
        low,
        close,
        type: 'candlestick',
        name: symbol,
        increasing: { line: { color: colors.upColor, width: 1 }, fillcolor: colors.upColor },
        decreasing: { line: { color: colors.downColor, width: 1 }, fillcolor: colors.downColor },
        hoverinfo: 'all',
        showlegend: false
      });
      
      // Add bid and ask lines if enabled
      if (showIndicators.bidAsk) {
        const { x: lineX, bid, ask } = prepareLineChartData();
        
        plotData.push({
          x: lineX,
          y: bid,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.bid, width: 1.5, dash: 'dot' },
          name: 'Bid Price',
          yaxis: 'y',
          hoverinfo: 'y+name',
        });
        
        plotData.push({
          x: lineX,
          y: ask,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.ask, width: 1.5, dash: 'dot' },
          name: 'Ask Price',
          yaxis: 'y',
          hoverinfo: 'y+name',
        });
      }
      
      // Add volume as a bar chart in a separate subplot
      plotData.push({
        x,
        y: volume,
        type: 'bar',
        name: 'Volume',
        marker: {
          color: volume.map((_, i) => (close[i] >= open[i] ? colors.upColor : colors.downColor)),
          opacity: 0.5
        },
        yaxis: 'y3',
        hoverinfo: 'y+name',
      });
    }
    
    return plotData;
  };
  
  // Create spread chart data
  const createSpreadData = () => {
    const colors = getColorTheme();
    const { x, spread } = prepareLineChartData();
    
    return [{
      x,
      y: spread,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      line: { color: colors.indicator.spread, width: 1.5 },
      name: 'Bid-Ask Spread',
      hoverinfo: 'y+name',
    }];
  };
  
  // Create layout based on chart type and indicators
  const createLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const yRange = calculateYAxisRange();
    const bidAskRange = calculateBidAskRange();
    
    // Base layout
    const layout: any = {
      autosize: true,
      margin: { l: 50, r: 50, t: 40, b: 40 },
      title: {
        text: `${symbol} Price Chart`,
        font: { size: 16, color: colors.text },
      },
      xaxis: {
        title: 'Time',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Price (₹)',
        range: yRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        side: 'left',
        domain: showIndicators.rsi ? [0.3, 1] : (chartType === 'candle' ? [0.15, 1] : [0, 1]),
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
    
    // Add RSI subplot if enabled
    if (showIndicators.rsi) {
      layout.yaxis2 = {
        title: 'RSI',
        titlefont: { color: colors.indicator.rsi },
        tickfont: { color: colors.indicator.rsi },
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        domain: [0, 0.25],
        showgrid: false,
      };
    }
    
    // Add volume subplot for candlestick chart
    if (chartType === 'candle') {
      layout.yaxis3 = {
        title: 'Volume',
        titlefont: { color: colors.text },
        tickfont: { color: colors.text },
        domain: [0, 0.1],
        showgrid: false,
      };
      
      // Adjust main chart domain
      layout.yaxis.domain = [0.15, 1];
    }
    
    return layout;
  };
  
  // Create spread chart layout
  const createSpreadLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const spreadRange = calculateSpreadRange();
    
    return {
      autosize: true,
      height: 150,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Spread',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Spread (₹)',
        range: spreadRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: false,
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };
  
  // Create timeframe selector buttons
  const timeframeButtons = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1H' },
    { label: '6H', value: '6H' },
    { label: '12H', value: '12H' },
    { label: '1D', value: '1D' },
  ];
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between mb-2">
        <div className="flex space-x-1">
          {timeframeButtons.map((button) => (
            <button
              key={button.value}
              className={`px-2 py-1 text-xs rounded ${
                selectedTimeframe === button.value
                  ? `bg-blue-600 text-white`
                  : `bg-zinc-800 text-zinc-300 hover:bg-zinc-700`
              }`}
              onClick={() => handleTimeframeChange(button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>
        
        <div className="flex space-x-2">
          {/* Chart type toggle */}
          <button
            className={`p-1 rounded ${
              chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('line')}
            title="Line Chart"
          >
            <LineChart  className="h-5 w-5" />
          </button>
          
          <button
            className={`p-1 rounded ${
              chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('candle')}
            title="Candlestick Chart"
          >
            <CandlestickChart className="h-5 w-5" />
          </button>
          
          {/* Indicator toggles */}
          <button
            className={`p-1 rounded ${
              showIndicators.sma20 ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('sma20')}
            title="SMA 20"
          >
            <span className="text-xs font-bold">SMA</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.ema9 ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('ema9')}
            title="EMA 9"
          >
            <span className="text-xs font-bold">EMA</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.rsi ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('rsi')}
            title="RSI 14"
          >
            <span className="text-xs font-bold">RSI</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.bidAsk ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bidAsk')}
            title="Bid-Ask"
          >
            <span className="text-xs font-bold">B/A</span>
          </button>
        </div>
      </div>
      
      <div className="flex-grow mb-2">
        <Plot
          id="plotly-chart"
          ref={chartRef}
          data={createPlotData()}
          layout={createLayout()}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: [
              'select2d',
              'lasso2d',
              'autoScale2d',
              'toggleSpikelines',
            ],
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          onRelayout={handleRelayout}
        />
      </div>
      
      {/* Spread Chart */}
      <div className="h-[150px]">
        <Plot
          id="spread-chart"
          ref={spreadChartRef}
          data={createSpreadData()}
          layout={createSpreadLayout()}
          config={{
            responsive: true,
            displayModeBar: false,
            displaylogo: false,
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>
    </div>
  );
};

export default PlotlyChart;
