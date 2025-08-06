import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// NEW: Dashboard URL utilities
export const createDashboardUrl = (params: {
  company: string;
  exchange: string;
  watchlist?: string;
  interval?: string;
  autoLoad?: boolean;
}) => {
  const searchParams = new URLSearchParams({
    company: params.company,
    exchange: params.exchange,
    watchlist: params.watchlist || 'A',
    interval: params.interval || '1h',
    autoLoad: params.autoLoad ? 'true' : 'false'
  });
  return `/dashboard?${searchParams.toString()}`;
};
export const openDashboardInNewTab = (params: {
  company: string;
  exchange: string;
  watchlist?: string;
  interval?: string;
}) => {
  const url = createDashboardUrl({ ...params, autoLoad: true });
  window.open(url, '_blank');
};
// NEW: URL parameter parsing
export const parseDashboardParams = (searchParams: URLSearchParams) => {
  return {
    company: searchParams.get('company'),
    exchange: searchParams.get('exchange'),
    watchlist: searchParams.get('watchlist') || 'A',
    interval: searchParams.get('interval') || '1h',
    autoLoad: searchParams.get('autoLoad') === 'true'
  };
};

