// plotly/chartData.ts
import { DataPoint, OHLCPoint, ColorTheme, ShowIndicators, ChartUpdate } from '../../../../../types/chartTypes';
import { 
  calculateSMA, 
  calculateEMA, 
  calculateBollingerBands, 
  calculateVWAP, 
  calculateRSI, 
  calculateStandardDeviation 
} from '../../../../../utils/calculations';

export const createPlotData = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  showIndicators: ShowIndicators,
  colors: ColorTheme
) => {
  if (chartType === 'line') {
    return createPlotDataForLine(historicalData, data, chartUpdates, colors, showIndicators);
  } else {
    return createPlotDataForCandles(ohlcData, colors, showIndicators);
  }
};

export const createPlotDataForLine = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme,
  showIndicators: ShowIndicators
) => {
  const plotData: any[] = [];

  const allData = [...historicalData];
  
  if (chartUpdates && chartUpdates.length > 0) {
    const latestHistoricalTime = historicalData.length > 0 ? 
      historicalData[historicalData.length - 1].timestamp : 0;

    const recentUpdates = chartUpdates
      .filter(update => update.timestamp > latestHistoricalTime)
      .map(update => ({
        ltp: update.price,
        timestamp: update.timestamp,
        volume: update.volume,
        change: update.change,
        changePercent: update.changePercent
      } as DataPoint));

    allData.push(...recentUpdates);
  } else if (data && data.ltp) {
    const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
    if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
      allData.push(data);
    }
  }

  if (allData.length === 0) return plotData;

  const validData = allData.filter(point => 
    point.ltp !== null && 
    point.ltp !== undefined && 
    point.ltp > 0 && 
    !isNaN(point.ltp) &&
    point.timestamp !== null &&
    point.timestamp !== undefined
  );

  if (validData.length === 0) return plotData;

  const sortedData = [...validData].sort((a, b) => a.timestamp - b.timestamp);
  const timeValues = sortedData.map(point => new Date(point.timestamp * 1000));
  const priceValues = sortedData.map(point => Number(point.ltp));

  // Main LTP line
  plotData.push({
    x: timeValues,
    y: priceValues,
    type: 'scatter',
    mode: 'lines',
    name: 'LTP',
    line: {
      color: colors.line || '#3B82F6',
      width: 2,
      shape: 'linear'
    },
    connectgaps: false,
    hovertemplate: '<b>%{fullData.name}</b><br>Time: %{x|%H:%M:%S}<br>Price: ₹%{y:.2f}<br><extra></extra>',
    showlegend: true
  });

  // SMA 20
  if (showIndicators.sma20 && priceValues.length >= 20) {
    const sma20Values = calculateSMA(priceValues, 20);
    if (sma20Values && sma20Values.length > 0) {
      plotData.push({
        x: timeValues.slice(19),
        y: sma20Values,
        type: 'scatter',
        mode: 'lines',
        name: 'SMA 20',
        line: { color: colors.indicator?.sma20 || '#f59e0b', width: 1.5, dash: 'dot' },
        connectgaps: false,
        showlegend: true
      });
    }
  }

  // EMA 9
  if (showIndicators.ema9 && priceValues.length >= 9) {
    const ema9Values = calculateEMA(priceValues, 9);
    if (ema9Values && ema9Values.length > 0) {
      plotData.push({
        x: timeValues,
        y: ema9Values,
        type: 'scatter',
        mode: 'lines',
        name: 'EMA 9',
        line: { color: colors.indicator?.ema9 || '#8b5cf6', width: 1.5, dash: 'dash' },
        connectgaps: false,
        showlegend: true
      });
    }
  }

  // Bollinger Bands
  if (showIndicators.bb && priceValues.length >= 20) {
    const bbData = calculateBollingerBands(priceValues, 20, 2);
    if (bbData && bbData.upper && bbData.middle && bbData.lower) {
      plotData.push(
        {
          x: timeValues.slice(19),
          y: bbData.upper,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Upper',
          line: { color: colors.indicator?.bb || '#64748b', width: 1, dash: 'dashdot' },
          connectgaps: false,
          showlegend: true
        },
        {
          x: timeValues.slice(19),
          y: bbData.middle,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Middle',
          line: { color: colors.indicator?.bb || '#64748b', width: 1 },
          connectgaps: false,
          showlegend: true
        },
        {
          x: timeValues.slice(19),
          y: bbData.lower,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Lower',
          line: { color: colors.indicator?.bb || '#64748b', width: 1, dash: 'dashdot' },
          fill: 'tonexty',
          fillcolor: 'rgba(100, 116, 139, 0.1)',
          connectgaps: false,
          showlegend: true
        }
      );
    }
  }

  // RSI
  if (showIndicators.rsi && priceValues.length >= 15) {
    const rsiValues = calculateRSI(priceValues, 14);
    if (rsiValues && rsiValues.length > 0) {
      plotData.push({
        x: timeValues.slice(14),
        y: rsiValues,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI',
        line: { color: colors.indicator?.rsi || '#ec4899', width: 2 },
        yaxis: 'y2',
        connectgaps: false,
        showlegend: true
      });
    }
  }

  return plotData;
};

export const createPlotDataForCandles = (
  ohlcData: OHLCPoint[],
  colors: ColorTheme,
  showIndicators: ShowIndicators
) => {
  const plotData: any[] = [];
  
  if (!ohlcData || ohlcData.length === 0) return plotData;

  const validOhlcData = ohlcData.filter(candle => 
    candle.open !== null && candle.open !== undefined &&
    candle.high !== null && candle.high !== undefined &&
    candle.low !== null && candle.low !== undefined &&
    candle.close !== null && candle.close !== undefined
  );

  if (validOhlcData.length === 0) return plotData;

  const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);

  const x = sortedData.map(candle => new Date(candle.timestamp * 1000));
  const open = sortedData.map(candle => Number(candle.open));
  const high = sortedData.map(candle => Number(candle.high));
  const low = sortedData.map(candle => Number(candle.low));
  const close = sortedData.map(candle => Number(candle.close));
  const volume = sortedData.map(candle => candle.volume || 0);

  plotData.push({
    x,
    open,
    high,
    low,
    close,
    type: 'candlestick',
    name: 'OHLC',
    increasing: {
      line: { color: colors.upColor || '#10b981', width: 1 },
      fillcolor: colors.upColor || '#10b981'
    },
    decreasing: {
      line: { color: colors.downColor || '#ef4444', width: 1 },
      fillcolor: colors.downColor || '#ef4444'
    },
    xaxis: 'x',
    yaxis: 'y',
    showlegend: true
  });

  // SMA 20
  if (showIndicators.sma20 && close.length >= 20) {
    const sma20Values = calculateSMA(close, 20);
    if (sma20Values && sma20Values.length > 0) {
      plotData.push({
        x: x.slice(19),
        y: sma20Values,
        type: 'scatter',
        mode: 'lines',
        name: 'SMA 20',
        line: { color: colors.indicator?.sma20 || '#f59e0b', width: 1.5, dash: 'dot' },
        connectgaps: false,
        showlegend: true
      });
    }
  }

  // EMA 9
  if (showIndicators.ema9 && close.length >= 9) {
    const ema9Values = calculateEMA(close, 9);
    if (ema9Values && ema9Values.length > 0) {
      plotData.push({
        x,
        y: ema9Values,
        type: 'scatter',
        mode: 'lines',
        name: 'EMA 9',
        line: { color: colors.indicator?.ema9 || '#8b5cf6', width: 1.5, dash: 'dash' },
        connectgaps: false,
        showlegend: true
      });
    }
  }

  // Bollinger Bands
  if (showIndicators.bb && close.length >= 20) {
    const bbData = calculateBollingerBands(close, 20, 2);
    if (bbData && bbData.upper && bbData.middle && bbData.lower) {
      plotData.push(
        {
          x: x.slice(19),
          y: bbData.upper,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Upper',
          line: { color: colors.indicator?.bb || '#64748b', width: 1, dash: 'dashdot' },
          connectgaps: false,
          showlegend: true
        },
        {
          x: x.slice(19),
          y: bbData.middle,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Middle',
          line: { color: colors.indicator?.bb || '#64748b', width: 1 },
          connectgaps: false,
          showlegend: true
        },
        {
          x: x.slice(19),
          y: bbData.lower,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Lower',
          line: { color: colors.indicator?.bb || '#64748b', width: 1, dash: 'dashdot' },
          fill: 'tonexty',
          fillcolor: 'rgba(100, 116, 139, 0.1)',
          connectgaps: false,
          showlegend: true
        }
      );
    }
  }

  // VWAP
  if (showIndicators.vwap && close.length > 0 && volume && volume.length > 0) {
    const vwapValues = calculateVWAP(close, high, low, volume);
    if (vwapValues && vwapValues.length > 0) {
      plotData.push({
        x,
        y: vwapValues,
        type: 'scatter',
        mode: 'lines',
        name: 'VWAP',
        line: { color: colors.indicator?.vwap || '#06b6d4', width: 2, dash: 'solid' },
        connectgaps: false,
        showlegend: true
      });
    }
  }

  // RSI
  if (showIndicators.rsi && close.length >= 15) {
    const rsiValues = calculateRSI(close, 14);
    if (rsiValues && rsiValues.length > 0) {
      plotData.push({
        x: x.slice(14),
        y: rsiValues,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI',
        line: { color: colors.indicator?.rsi || '#ec4899', width: 2 },
        yaxis: 'y2',
        connectgaps: false,
        showlegend: true
      });
    }
  }

  return plotData;
};

// Bid/Ask Data
export const createBidAskData = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  const allData = [...historicalData];
  
  if (chartUpdates && chartUpdates.length > 0) {
    const latestHistoricalTime = historicalData.length > 0 ? 
      historicalData[historicalData.length - 1].timestamp : 0;
    const recentUpdates = chartUpdates
      .filter(update => update.timestamp > latestHistoricalTime)
      .map(update => ({
        ltp: update.price,
        timestamp: update.timestamp,
        volume: update.volume,
        bid: update.price * 0.999,
        ask: update.price * 1.001
      } as DataPoint));
    allData.push(...recentUpdates);
  } else if (data && data.ltp) {
    const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
    if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
      allData.push(data);
    }
  }

  const x = allData.map(point => new Date(point.timestamp * 1000));
  const bid = allData.map(point => point.bid || point.ltp * 0.999);
  const ask = allData.map(point => point.ask || point.ltp * 1.001);

  return [
    {
      x,
      y: bid,
      type: 'scatter',
      mode: 'lines',
      name: 'Bid',
      line: { color: colors.indicator?.bid || '#22c55e', width: 2 },
      connectgaps: false
    },
    {
      x,
      y: ask,
      type: 'scatter',
      mode: 'lines',
      name: 'Ask',
      line: { color: colors.indicator?.ask || '#ef4444', width: 2 },
      connectgaps: false
    }
  ];
};

// Spread Data
export const createSpreadData = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  const allData = [...historicalData];
  
  if (chartUpdates && chartUpdates.length > 0) {
    const latestHistoricalTime = historicalData.length > 0 ? 
      historicalData[historicalData.length - 1].timestamp : 0;
    const recentUpdates = chartUpdates
      .filter(update => update.timestamp > latestHistoricalTime)
      .map(update => ({
        ltp: update.price,
        timestamp: update.timestamp,
        volume: update.volume
      } as DataPoint));
    allData.push(...recentUpdates);
  } else if (data && data.ltp) {
    const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
    if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
      allData.push(data);
    }
  }

  const x = allData.map(point => new Date(point.timestamp * 1000));
  const spread = allData.map(point => {
    const bid = point.bid || point.ltp * 0.999;
    const ask = point.ask || point.ltp * 1.001;
    return ask - bid;
  });

  return [{
    x,
    y: spread,
    type: 'scatter',
    mode: 'lines',
    name: 'Spread',
    line: { color: colors.indicator?.spread || '#3b82f6', width: 2 },
    fill: 'tozeroy',
    fillcolor: 'rgba(59, 130, 246, 0.2)',
    connectgaps: false
  }];
};

// Volume Data
export const createVolumeData = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  let x: Date[] = [];
  let volumes: number[] = [];
  let colorArray: string[] = [];

  if (chartType === 'line') {
    const allData = [...historicalData];
    if (chartUpdates && chartUpdates.length > 0) {
      const latestHistoricalTime = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1].timestamp : 0;
      const recentUpdates = chartUpdates
        .filter(update => update.timestamp > latestHistoricalTime)
        .map(update => ({
          ltp: update.price,
          timestamp: update.timestamp,
          volume: update.volume
        } as DataPoint));
      allData.push(...recentUpdates);
    } else if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    x = allData.map(point => new Date(point.timestamp * 1000));
    volumes = allData.map(point => point.volume || 0);
    colorArray = allData.map((point, i) => {
      if (i === 0) return colors.indicator?.volume || '#64748b';
      return point.ltp >= allData[i - 1].ltp ? colors.upColor : colors.downColor;
    });
  } else {
    x = ohlcData.map(candle => new Date(candle.timestamp * 1000));
    volumes = ohlcData.map(candle => candle.volume || 0);
    colorArray = ohlcData.map(candle => 
      candle.close >= candle.open ? colors.upColor : colors.downColor
    );
  }

  return [{
    x,
    y: volumes,
    type: 'bar',
    name: 'Volume',
    marker: { color: colorArray },
    showlegend: true
  }];
};

// Buy/Sell Line Data
export const createBuySellLineData = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  let x: Date[] = [];
  let buyPrices: number[] = [];
  let sellPrices: number[] = [];

  if (chartType === 'line') {
    const allData = [...historicalData];
    if (chartUpdates && chartUpdates.length > 0) {
      const latestHistoricalTime = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1].timestamp : 0;
      const recentUpdates = chartUpdates
        .filter(update => update.timestamp > latestHistoricalTime)
        .map(update => ({
          ltp: update.price,
          timestamp: update.timestamp,
          volume: update.volume
        } as DataPoint));
      allData.push(...recentUpdates);
    } else if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    x = allData.map(point => new Date(point.timestamp * 1000));
    buyPrices = allData.map(point => point.ltp * 1.001);
    sellPrices = allData.map(point => point.ltp * 0.999);
  } else {
    x = ohlcData.map(candle => new Date(candle.timestamp * 1000));
    buyPrices = ohlcData.map(candle => candle.close * 1.001);
    sellPrices = ohlcData.map(candle => candle.close * 0.999);
  }

  return [
    {
      x,
      y: buyPrices,
      type: 'scatter',
      mode: 'lines',
      name: 'Buy Price',
      line: { color: colors.indicator?.buyPrice || '#10b981', width: 2 },
      connectgaps: false
    },
    {
      x,
      y: sellPrices,
      type: 'scatter',
      mode: 'lines',
      name: 'Sell Price',
      line: { color: colors.indicator?.sellPrice || '#f59e0b', width: 2 },
      connectgaps: false
    }
  ];
};

// Buy/Sell Spread Data
export const createBuySellSpreadData = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  let x: Date[] = [];
  let buySellSpreads: number[] = [];

  if (chartType === 'line') {
    const allData = [...historicalData];
    if (chartUpdates && chartUpdates.length > 0) {
      const latestHistoricalTime = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1].timestamp : 0;
      const recentUpdates = chartUpdates
        .filter(update => update.timestamp > latestHistoricalTime)
        .map(update => ({
          ltp: update.price,
          timestamp: update.timestamp,
          volume: update.volume
        } as DataPoint));
      allData.push(...recentUpdates);
    } else if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    x = allData.map(point => new Date(point.timestamp * 1000));
    buySellSpreads = allData.map(point => (point.ltp * 1.001) - (point.ltp * 0.999));
  } else {
    x = ohlcData.map(candle => new Date(candle.timestamp * 1000));
    buySellSpreads = ohlcData.map(candle => (candle.close * 1.001) - (candle.close * 0.999));
  }

  return [{
    x,
    y: buySellSpreads,
    type: 'scatter',
    mode: 'lines',
    name: 'Buy/Sell Spread',
    line: { color: colors.indicator?.buySellSpread || '#8b5cf6', width: 2 },
    fill: 'tozeroy',
    fillcolor: 'rgba(139, 92, 246, 0.2)',
    connectgaps: false
  }];
};

// Standard Deviation Data
export const createStdData = (
  mainMode: 'none' | 'bidAsk' | 'buySell',
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[],
  colors: ColorTheme
) => {
  let x: Date[] = [];
  let stdValues: number[] = [];

  const windowSize = 20;

  if (mainMode === 'bidAsk') {
    const allData = [...historicalData];
    if (chartUpdates && chartUpdates.length > 0) {
      const latestHistoricalTime = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1].timestamp : 0;
      const recentUpdates = chartUpdates
        .filter(update => update.timestamp > latestHistoricalTime)
        .map(update => ({
          ltp: update.price,
          timestamp: update.timestamp,
          volume: update.volume,
          bid: update.price * 0.999,
          ask: update.price * 1.001
        } as DataPoint));
      allData.push(...recentUpdates);
    } else if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }

    x = allData.map(point => new Date(point.timestamp * 1000));
    const spreads = allData.map(point => {
      const bid = point.bid || point.ltp * 0.999;
      const ask = point.ask || point.ltp * 1.001;
      return ask - bid;
    });

    stdValues = spreads.map((_, i) => {
      const startIndex = Math.max(0, i - windowSize + 1);
      const window = spreads.slice(startIndex, i + 1);
      return window.length > 1 ? calculateStandardDeviation(window) : 0;
    });
  } else if (mainMode === 'buySell') {
    if (chartType === 'line') {
      const allData = [...historicalData];
      if (chartUpdates && chartUpdates.length > 0) {
        const latestHistoricalTime = historicalData.length > 0 ? 
          historicalData[historicalData.length - 1].timestamp : 0;
        const recentUpdates = chartUpdates
          .filter(update => update.timestamp > latestHistoricalTime)
          .map(update => ({
            ltp: update.price,
            timestamp: update.timestamp,
            volume: update.volume
          } as DataPoint));
        allData.push(...recentUpdates);
      } else if (data && data.ltp) {
        const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
        if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
          allData.push(data);
        }
      }
      x = allData.map(point => new Date(point.timestamp * 1000));
      const buySellSpreads = allData.map(point => (point.ltp * 1.001) - (point.ltp * 0.999));
      stdValues = buySellSpreads.map((_, i) => {
        const startIndex = Math.max(0, i - windowSize + 1);
        const window = buySellSpreads.slice(startIndex, i + 1);
        return window.length > 1 ? calculateStandardDeviation(window) : 0;
      });
    } else {
      x = ohlcData.map(candle => new Date(candle.timestamp * 1000));
      const buySellSpreads = ohlcData.map(candle => (candle.close * 1.001) - (candle.close * 0.999));
      stdValues = buySellSpreads.map((_, i) => {
        const startIndex = Math.max(0, i - windowSize + 1);
        const window = buySellSpreads.slice(startIndex, i + 1);
        return window.length > 1 ? calculateStandardDeviation(window) : 0;
      });
    }
  }

  return [{
    x,
    y: stdValues,
    type: 'scatter',
    mode: 'lines',
    name: 'Std Dev',
    line: { color: colors.indicator?.std || '#f97316', width: 2 },
    fill: 'tozeroy',
    fillcolor: 'rgba(249, 115, 22, 0.2)',
    connectgaps: false
  }];
};
