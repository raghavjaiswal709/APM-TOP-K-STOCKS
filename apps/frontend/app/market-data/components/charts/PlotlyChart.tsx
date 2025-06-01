'use client';

import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { 
  ChevronRight, 
  TrendingUp,
  BarChart3,
  LineChart,
  CandlestickChart,
  ArrowLeftRight,
  ShoppingCart,
  TrendingDown
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
  buyVolume?: number;
  sellVolume?: number;
}

interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
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
  const bidAskChartRef = useRef<any>(null);
  const buySellVolumeChartRef = useRef<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [showIndicators, setShowIndicators] = useState<{
    sma20: boolean;
    ema9: boolean;
    rsi: boolean;
    bidAsk: boolean;
    bidAskSpread: boolean;
    buySellVolume: boolean;
  }>({
    sma20: false,
    ema9: false,
    rsi: false,
    bidAsk: true,
    bidAskSpread: true,
    buySellVolume: true
  });

  const calculateBuySellVolume = (dataPoint: DataPoint | OHLCPoint) => {
    let buyVolume = 0;
    let sellVolume = 0;
    const totalVolume = dataPoint.volume || 0;
    
    if ('buyVolume' in dataPoint && 'sellVolume' in dataPoint) {
      buyVolume = dataPoint.buyVolume || 0;
      sellVolume = dataPoint.sellVolume || 0;
    } else {
      // Calculate based on price movement
      let priceChange = 0;
      
      if ('open' in dataPoint && 'close' in dataPoint) {
        priceChange = (dataPoint.close - dataPoint.open) / dataPoint.open;
      } else if ('ltp' in dataPoint) {
        const currentIndex = historicalData.findIndex(p => p.timestamp === dataPoint.timestamp);
        if (currentIndex > 0) {
          const prevPrice = historicalData[currentIndex - 1].ltp;
          priceChange = (dataPoint.ltp - prevPrice) / prevPrice;
        }
      }
      
      const buyRatio = Math.max(0, Math.min(1, 0.5 + priceChange * 2));
      buyVolume = totalVolume * buyRatio;
      sellVolume = totalVolume * (1 - buyRatio);
    }
    
    return { buyVolume, sellVolume };
  };

  const prepareLineChartData = () => {
    const allData = [...historicalData];
    
    if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1] : null;
      
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    
    allData.sort((a, b) => a.timestamp - b.timestamp);
    
    const x = allData.map(point => new Date(point.timestamp * 1000));
    const y = allData.map(point => point.ltp);
    const bid = allData.map(point => point.bid || null);
    const ask = allData.map(point => point.ask || null);
    
    const spread = allData.map(point => {
      if (point.ask && point.bid) {
        return point.ask - point.bid;
      }
      return null;
    });
    
    const sma20 = allData.map(point => point.sma_20 || null);
    const ema9 = allData.map(point => point.ema_9 || null);
    const rsi = allData.map(point => point.rsi_14 || null);
    
    const buyVolumes = allData.map(point => calculateBuySellVolume(point).buyVolume);
    const sellVolumes = allData.map(point => calculateBuySellVolume(point).sellVolume);
    
    return { x, y, allData, sma20, ema9, rsi, bid, ask, spread, buyVolumes, sellVolumes };
  };
  
  const prepareCandlestickData = () => {
    if (!ohlcData || ohlcData.length === 0) {
      return { x: [], open: [], high: [], low: [], close: [], volume: [], buyVolumes: [], sellVolumes: [] };
    }
    
    const validOhlcData = ohlcData.filter(candle => 
      candle.open !== null && candle.open !== undefined &&
      candle.high !== null && candle.high !== undefined &&
      candle.low !== null && candle.low !== undefined &&
      candle.close !== null && candle.close !== undefined &&
      candle.volume !== null && candle.volume !== undefined
    );
    
    if (validOhlcData.length === 0) {
      return { x: [], open: [], high: [], low: [], close: [], volume: [], buyVolumes: [], sellVolumes: [] };
    }
    
    const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);
    
    const buyVolumes = sortedData.map(candle => calculateBuySellVolume(candle).buyVolume);
    const sellVolumes = sortedData.map(candle => calculateBuySellVolume(candle).sellVolume);
    
    return {
      x: sortedData.map(candle => new Date(candle.timestamp * 1000)),
      open: sortedData.map(candle => Number(candle.open)),
      high: sortedData.map(candle => Number(candle.high)),
      low: sortedData.map(candle => Number(candle.low)),
      close: sortedData.map(candle => Number(candle.close)),
      volume: sortedData.map(candle => Number(candle.volume)),
      buyVolumes,
      sellVolumes
    };
  };
  
  const calculateYAxisRange = () => {
    const timeRange = getTimeRange();
    if (!timeRange) return undefined;
    
    const startTime = timeRange[0].getTime() / 1000;
    const endTime = timeRange[1].getTime() / 1000;
    
    if (chartType === 'line') {
      if (historicalData.length === 0) return undefined;
      
      const visibleData = historicalData.filter(
        point => point.timestamp >= startTime && point.timestamp <= endTime
      );
      
      if (visibleData.length === 0) return undefined;
      
      const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
      if (prices.length === 0) return undefined;
      
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    } else {
      if (!ohlcData || ohlcData.length === 0) return undefined;
      
      const visibleCandles = ohlcData.filter(
        candle => candle.timestamp >= startTime && candle.timestamp <= endTime
      );
      
      if (visibleCandles.length === 0) return undefined;
      
      const validCandles = visibleCandles.filter(candle => 
        candle.high !== null && candle.high !== undefined &&
        candle.low !== null && candle.low !== undefined
      );
      
      if (validCandles.length === 0) return undefined;
      
      const highPrices = validCandles.map(candle => Number(candle.high));
      const lowPrices = validCandles.map(candle => Number(candle.low));
      
      const minPrice = Math.min(...lowPrices);
      const maxPrice = Math.max(...highPrices);
      
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    }
  };
  
  const calculateBidAskRange = () => {
    const { bid, ask } = prepareLineChartData();
    
    const validBids = bid.filter(b => b !== null && b !== undefined) as number[];
    const validAsks = ask.filter(a => a !== null && a !== undefined) as number[];
    
    if (validBids.length === 0 || validAsks.length === 0) return undefined;
    
    const minBid = Math.min(...validBids);
    const maxAsk = Math.max(...validAsks);
    
    const padding = (maxAsk - minBid) * 0.05;
    return [minBid - padding, maxAsk + padding];
  };
  
  const calculateSpreadRange = () => {
    const { spread } = prepareLineChartData();
    
    const validSpreads = spread.filter(s => s !== null && s !== undefined) as number[];
    
    if (validSpreads.length === 0) return [0, 1];
    
    const minSpread = Math.min(...validSpreads);
    const maxSpread = Math.max(...validSpreads);
    
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };
  
  const calculateBuySellVolumeRange = () => {
    let buyVolumes: number[] = [];
    let sellVolumes: number[] = [];
    
    if (chartType === 'line') {
      const { buyVolumes: bv, sellVolumes: sv } = prepareLineChartData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    } else {
      const { buyVolumes: bv, sellVolumes: sv } = prepareCandlestickData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    }
    
    if (buyVolumes.length === 0 && sellVolumes.length === 0) return [0, 1000];
    
    const maxBuyVolume = buyVolumes.length > 0 ? Math.max(...buyVolumes) : 0;
    const maxSellVolume = sellVolumes.length > 0 ? Math.max(...sellVolumes) : 0;
    const maxVolume = Math.max(maxBuyVolume, maxSellVolume);
    
    return [0, maxVolume * 1.1];
  };
  
  const getTimeRange = () => {
    const dataToUse = chartType === 'line' ? historicalData : ohlcData;
    if (!dataToUse || dataToUse.length === 0) return undefined;
    
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
        try {
          const tradingStart = new Date(tradingHours.start);
          return [tradingStart, now > new Date(tradingHours.end) ? new Date(tradingHours.end) : now];
        } catch (e) {
          startTime.setHours(now.getHours() - 24);
        }
    }
    
    return [startTime, now];
  };
  
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
        sma20: '#f97316',
        ema9: '#8b5cf6',
        rsi: '#06b6d4',
        bid: '#22c55e',
        ask: '#ef4444',
        spread: '#3b82f6',
        buyVolume: '#22c55e',
        sellVolume: '#ef4444'
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
  
  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    
    if (!chartRef.current) return;
    
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    
    try {
      Plotly.relayout(plotDiv, {
        'xaxis.range': getTimeRange(),
        'xaxis.autorange': false,
        'yaxis.range': calculateYAxisRange(),
        'yaxis.autorange': false
      });
      
      const spreadDiv = document.getElementById('spread-chart');
      if (spreadDiv) {
        Plotly.relayout(spreadDiv, {
          'xaxis.range': getTimeRange(),
          'xaxis.autorange': false
        });
      }
      
      const bidAskDiv = document.getElementById('bid-ask-chart');
      if (bidAskDiv) {
        Plotly.relayout(bidAskDiv, {
          'xaxis.range': getTimeRange(),
          'xaxis.autorange': false
        });
      }
      
      const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
      if (buySellVolumeDiv) {
        Plotly.relayout(buySellVolumeDiv, {
          'xaxis.range': getTimeRange(),
          'xaxis.autorange': false
        });
      }
    } catch (err) {
      console.error('Error updating timeframe:', err);
    }
  };
  
  const toggleChartType = () => {
    setChartType(prev => prev === 'line' ? 'candle' : 'line');
  };
  
  const toggleIndicator = (indicator: 'sma20' | 'ema9' | 'rsi' | 'bidAsk' | 'bidAskSpread' | 'buySellVolume') => {
    setShowIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };
  
  const handleRelayout = (eventData: any) => {
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      const startDate = new Date(eventData['xaxis.range[0]']);
      const endDate = new Date(eventData['xaxis.range[1]']);
      
      const startTime = startDate.getTime() / 1000;
      const endTime = endDate.getTime() / 1000;
      
      let minValue, maxValue;
      
      if (chartType === 'line') {
        const visibleData = historicalData.filter(
          point => point.timestamp >= startTime && point.timestamp <= endTime
        );
        
        if (visibleData.length > 0) {
          const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
          if (prices.length > 0) {
            minValue = Math.min(...prices);
            maxValue = Math.max(...prices);
          }
        }
      } else {
        const visibleData = ohlcData.filter(
          candle => candle.timestamp >= startTime && candle.timestamp <= endTime
        );
        
        if (visibleData.length > 0) {
          const validCandles = visibleData.filter(candle => 
            candle.high !== null && candle.high !== undefined &&
            candle.low !== null && candle.low !== undefined
          );
          
          if (validCandles.length > 0) {
            const highPrices = validCandles.map(candle => Number(candle.high));
            const lowPrices = validCandles.map(candle => Number(candle.low));
            
            minValue = Math.min(...lowPrices);
            maxValue = Math.max(...highPrices);
          }
        }
      }
      
      if (minValue !== undefined && maxValue !== undefined) {
        const padding = (maxValue - minValue) * 0.05;
        const yRange = [minValue - padding, maxValue + padding];
        
        const plotDiv = document.getElementById('plotly-chart');
        if (plotDiv) {
          Plotly.relayout(plotDiv, {
            'yaxis.range': yRange,
            'yaxis.autorange': false
          });
        }
        
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          Plotly.relayout(bidAskDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          Plotly.relayout(spreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          Plotly.relayout(buySellVolumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
      }
    }
  };
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    
    if (!initialized) {
      setInitialized(true);
      return;
    }
    
    try {
      if (chartType === 'line') {
        const { x, y } = prepareLineChartData();
        if (x.length === 0 || y.length === 0) return;
        
        // @ts-ignore - Plotly is available globally
        Plotly.react(plotDiv, createPlotData(), createLayout());
      } else {
        const { x, open, high, low, close } = prepareCandlestickData();
        if (x.length === 0) return;
        
        // @ts-ignore - Plotly is available globally
        Plotly.react(plotDiv, createPlotData(), createLayout());
      }
      
      if (showIndicators.bidAsk) {
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          const { x, bid, ask } = prepareLineChartData();
          
          // @ts-ignore - Plotly is available globally
          Plotly.react(bidAskDiv, createBidAskData(), createBidAskLayout());
        }
      }
      
      if (showIndicators.bidAskSpread) {
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          const { x, spread } = prepareLineChartData();
          
          // @ts-ignore - Plotly is available globally
          Plotly.react(spreadDiv, createSpreadData(), createSpreadLayout());
        }
      }
      
      if (showIndicators.buySellVolume) {
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          // @ts-ignore - Plotly is available globally
          Plotly.react(buySellVolumeDiv, createBuySellVolumeData(), createBuySellVolumeLayout());
        }
      }
    } catch (err) {
      console.error('Error updating chart:', err);
    }
  }, [data, historicalData, ohlcData, initialized, selectedTimeframe, chartType, showIndicators.bidAsk, showIndicators.bidAskSpread, showIndicators.buySellVolume]);


  const createPlotData = () => {
    const colors = getColorTheme();
    const plotData: any[] = [];
    
    if (chartType === 'line') {
      const { x, y, sma20, ema9, rsi } = prepareLineChartData();
      
      if (x.length === 0 || y.length === 0) return plotData;
      
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
      const { x, open, high, low, close, volume } = prepareCandlestickData();
      
      if (x.length === 0) return plotData;
      
      plotData.push({
        x,
        open,
        high,
        low,
        close,
        type: 'candlestick',
        name: symbol,
        increasing: { 
          line: { color: colors.upColor, width: 1 }, 
          fillcolor: colors.upColor 
        },
        decreasing: { 
          line: { color: colors.downColor, width: 1 }, 
          fillcolor: colors.downColor 
        },
        hoverinfo: 'all',
        showlegend: false
      });
      
      if (volume.length > 0) {
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
    }
    
    return plotData;
  };
  

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


  const createBidAskData = () => {
    const colors = getColorTheme();
    const { x, bid, ask } = prepareLineChartData();
    
    return [
      {
        x,
        y: bid,
        type: 'scatter',
        mode: 'lines',
        line: { color: colors.indicator.bid, width: 2 },
        name: 'Bid Price',
        hoverinfo: 'y+name',
      },
      {
        x,
        y: ask,
        type: 'scatter',
        mode: 'lines',
        line: { color: colors.indicator.ask, width: 2 },
        name: 'Ask Price',
        hoverinfo: 'y+name',
      }
    ];
  };


  const createBuySellVolumeData = () => {
    const colors = getColorTheme();
    let x: Date[] = [];
    let buyVolumes: number[] = [];
    let sellVolumes: number[] = [];
    
    if (chartType === 'line') {
      const data = prepareLineChartData();
      x = data.x;
      buyVolumes = data.buyVolumes;
      sellVolumes = data.sellVolumes;
    } else {
      const data = prepareCandlestickData();
      x = data.x;
      buyVolumes = data.buyVolumes;
      sellVolumes = data.sellVolumes;
    }
    
    return [
      {
        x,
        y: buyVolumes,
        type: 'bar',
        name: 'Buy Volume',
        marker: { color: colors.indicator.buyVolume, opacity: 0.8 },
        hoverinfo: 'y+name',
      },
      {
        x,
        y: sellVolumes.map(v => -v), 
        type: 'bar',
        name: 'Sell Volume',
        marker: { color: colors.indicator.sellVolume, opacity: 0.8 },
        hoverinfo: 'y+name',
      }
    ];
  };

  const createLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const yRange = calculateYAxisRange();
    
    const layout: any = {
      autosize: true,
      margin: { l: 50, r: 50, t: 40, b: 40 },
      title: {
        text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
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
        autorange: yRange ? false : true,
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
    
    if (chartType === 'candle') {
      layout.yaxis3 = {
        title: 'Volume',
        titlefont: { color: colors.text },
        tickfont: { color: colors.text },
        domain: [0, 0.1],
        showgrid: false,
      };
      
      layout.yaxis.domain = [0.15, 1];
    }
    
    return layout;
  };
  
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

  const createBidAskLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const bidAskRange = calculateBidAskRange();
    
    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Prices',
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
        title: 'Price (₹)',
        range: bidAskRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
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
  };

  const createBuySellVolumeLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const volumeRange = calculateBuySellVolumeRange();
    
    return {
      autosize: true,
      height: 180,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Buy/Sell Volume Analysis',
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
        title: 'Volume',
        range: [-volumeRange[1], volumeRange[1]],
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        zeroline: true,
        zerolinecolor: colors.grid,
        zerolinewidth: 2,
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
      barmode: 'relative',
    };
  };

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
          <button
            className={`p-1 rounded ${
              chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('line')}
            title="Line Chart (LTP)"
          >
            <LineChart className="h-5 w-5" />
          </button>
          
          <button
            className={`p-1 rounded ${
              chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('candle')}
            title="Candlestick Chart (OHLC)"
          >
            <CandlestickChart className="h-5 w-5" />
          </button>
          
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
              showIndicators.bidAsk ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bidAsk')}
            title="Bid-Ask Lines"
          >
            <span className="text-xs font-bold">B/A</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.bidAskSpread ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bidAskSpread')}
            title="Bid-Ask Spread"
          >
            <span className="text-xs font-bold">SPR</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.buySellVolume ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('buySellVolume')}
            title="Buy/Sell Volume"
          >
            <span className="text-xs font-bold">VOL</span>
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
      
      {showIndicators.buySellVolume && (
        <div className="h-[180px] mb-2">
          <Plot
            id="buy-sell-volume-chart"
            ref={buySellVolumeChartRef}
            data={createBuySellVolumeData()}
            layout={createBuySellVolumeLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
      
      {showIndicators.bidAsk && (
        <div className="h-[200px] mb-2">
          <Plot
            id="bid-ask-chart"
            ref={bidAskChartRef}
            data={createBidAskData()}
            layout={createBidAskLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
      
      {showIndicators.bidAskSpread && (
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
      )}
    </div>
  );
};

export default PlotlyChart;
