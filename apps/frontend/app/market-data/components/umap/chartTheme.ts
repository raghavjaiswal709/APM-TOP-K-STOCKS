// Shared chart color theme for UMAP Plotly charts
// Supports both dark and light modes

export interface ChartColors {
  bg: string;
  grid: string;
  text: string;
  textBright: string;
  line: string;
  legendBg: string;
  legendBorder: string;
}

export const CHART_DARK: ChartColors = {
  bg: '#18181b',
  grid: '#27272a',
  text: '#a1a1aa',
  textBright: '#e4e4e7',
  line: '#3f3f46',
  legendBg: 'rgba(39,39,42,0.85)',
  legendBorder: '#52525b',
};

export const CHART_LIGHT: ChartColors = {
  bg: '#ffffff',
  grid: '#e5e7eb',
  text: '#6b7280',
  textBright: '#111827',
  line: '#d1d5db',
  legendBg: 'rgba(255,255,255,0.95)',
  legendBorder: '#d1d5db',
};

export function getChartTheme(isDark: boolean): ChartColors {
  return isDark ? CHART_DARK : CHART_LIGHT;
}
