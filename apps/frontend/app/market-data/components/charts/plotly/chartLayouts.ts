// plotly/chartLayouts.ts
import { ColorTheme } from '../types/chartTypes';

export const createLayout = (
  chartType: 'line' | 'candle',
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  preservedAxisRanges: { xaxis?: [Date, Date]; yaxis?: [number, number] },
  colors: ColorTheme,
  tradingHours?: { start: string; end: string; isActive: boolean }
) => {
  return {
    autosize: true,
    margin: { l: 60, r: 60, t: 40, b: 40 },
    title: {
      text: `${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
      font: { size: 16, color: colors.text }
    },
    xaxis: {
      title: 'Time',
      type: 'date',
      range: preservedAxisRanges.xaxis || timeRange,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      rangeslider: { visible: false },
      fixedrange: false
    },
    yaxis: {
      title: 'Price (₹)',
      range: preservedAxisRanges.yaxis || yRange,
      autorange: (preservedAxisRanges.yaxis || yRange) ? false : true,
      fixedrange: false,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      side: 'left',
      domain: [0.25, 1]
    },
    yaxis2: {
      title: 'RSI',
      range: [0, 100],
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      side: 'right',
      domain: [0, 0.20],
      anchor: 'x'
    },
    hovermode: 'closest',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.1,
      font: { color: colors.text },
      bgcolor: 'rgba(0,0,0,0)'
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper,
    font: { family: 'Arial, sans-serif', color: colors.text }
  };
};

export const createBidAskLayout = (
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 200,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Bid/Ask', font: { size: 14, color: colors.text } },
    xaxis: {
      title: '',
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid,
      rangeslider: { visible: false },
      fixedrange: false
    },
    yaxis: {
      title: 'Price',
      range: yRange,
      autorange: !yRange,
      gridcolor: colors.grid,
      tickfont: { color: colors.text }
    },
    hovermode: 'closest',
    showlegend: true,
    legend: { orientation: 'h', y: 1.1, font: { color: colors.text } },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};

export const createSpreadLayout = (
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 180,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Spread', font: { size: 14, color: colors.text } },
    xaxis: {
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid,
      rangeslider: { visible: false }
    },
    yaxis: {
      title: 'Spread',
      range: yRange,
      autorange: !yRange,
      gridcolor: colors.grid
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};

export const createVolumeLayout = (
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 180,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Volume', font: { size: 14, color: colors.text } },
    xaxis: {
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid,
      rangeslider: { visible: false }
    },
    yaxis: {
      title: 'Volume',
      range: yRange,
      autorange: !yRange,
      gridcolor: colors.grid
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};

export const createStdLayout = (
  mainMode: 'none' | 'bidAsk' | 'buySell',
  timeRange: [Date, Date] | undefined,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 180,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Standard Deviation', font: { size: 14, color: colors.text } },
    xaxis: {
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid
    },
    yaxis: {
      title: 'Std Dev',
      gridcolor: colors.grid
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};

export const createBuySellLineLayout = (
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 200,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Buy/Sell', font: { size: 14, color: colors.text } },
    xaxis: {
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid
    },
    yaxis: {
      title: 'Price',
      range: yRange,
      autorange: !yRange,
      gridcolor: colors.grid
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};

export const createBuySellSpreadLayout = (
  timeRange: [Date, Date] | undefined,
  yRange: [number, number] | null,
  colors: ColorTheme
) => {
  return {
    autosize: true,
    height: 180,
    margin: { l: 60, r: 60, t: 30, b: 30 },
    title: { text: 'Buy/Sell Spread', font: { size: 14, color: colors.text } },
    xaxis: {
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid
    },
    yaxis: {
      title: 'Spread',
      range: yRange,
      autorange: !yRange,
      gridcolor: colors.grid
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper
  };
};
