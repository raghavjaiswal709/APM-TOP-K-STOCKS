/**
 * Custom wheel handler for LightweightCharts that provides TradingView-style behavior:
 * - Scroll on PRICE AXIS (right side) → vertical price zoom (candles scale up/down)
 * - Scroll on CHART BODY / TIME AXIS → horizontal time zoom (candles expand/contract)
 *
 * The library's native wheel handler only does horizontal time zoom (deltaY → zoomTime).
 * This interceptor adds price-axis-specific vertical zoom by detecting mouse position
 * and using the public priceScale().getVisibleRange() / .setVisibleRange() API.
 */

import type { IChartApi } from 'lightweight-charts';

/**
 * Attaches a custom wheel event handler to a chart container that enables
 * price-axis wheel zoom when scrolling over the price scale area.
 *
 * @param container - The chart's DOM container element
 * @param chartRef - React ref or object with `.current` pointing to the IChartApi
 * @returns A cleanup function to remove the handler
 */
export function attachPriceAxisWheelZoom(
  container: HTMLElement,
  chartRef: { current: IChartApi | null }
): () => void {
  const ZOOM_SPEED = 0.03; // 3% zoom per wheel tick — smooth and controlled

  const wheelHandler = (e: WheelEvent) => {
    const chart = chartRef.current;
    if (!chart) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Get price scale width — the rightmost area of the chart
    let priceScaleWidth = 60;
    try {
      const w = chart.priceScale('right').width();
      if (w > 0) priceScaleWidth = w;
    } catch {
      // fallback
    }

    const chartWidth = rect.width;

    // Is mouse over the price axis? (right side of chart)
    const isOverPriceAxis = mouseX >= (chartWidth - priceScaleWidth);

    if (!isOverPriceAxis) {
      // ═══════════════════════════════════════════════════════
      // CHART BODY / TIME AXIS → let native library handle it
      // (deltaY → horizontal time zoom = TradingView behavior)
      // ═══════════════════════════════════════════════════════
      return;
    }

    // ═══════════════════════════════════════════════════════
    // PRICE AXIS WHEEL → Zoom price vertically
    // ═══════════════════════════════════════════════════════
    e.preventDefault();
    e.stopPropagation();

    const priceScale = chart.priceScale('right');

    // Read the current visible price range via the public API
    const visibleRange = priceScale.getVisibleRange();
    if (!visibleRange || visibleRange.from === visibleRange.to) return;

    const { from: currentMin, to: currentMax } = visibleRange;
    const rangeSize = currentMax - currentMin;

    // Scroll up (negative deltaY) → zoom IN (shrink range = taller candles)
    // Scroll down (positive deltaY) → zoom OUT (expand range = shorter candles)
    const zoomDirection = e.deltaY > 0 ? 1 : -1;
    const scaleFactor = 1 + ZOOM_SPEED * zoomDirection;

    // Compute where the mouse is vertically within the plot area (0 = top, 1 = bottom)
    // In LWC, top of chart = max price, bottom = min price
    let timeScaleHeight = 26;
    try {
      const h = (chart.timeScale() as any).height?.();
      if (h > 0) timeScaleHeight = h;
    } catch {
      // fallback
    }
    const plotHeight = rect.height - timeScaleHeight;
    const mouseRatio = Math.max(0, Math.min(1, mouseY / plotHeight));

    // mouseRatio 0 = top (max price), mouseRatio 1 = bottom (min price)
    // Zoom centered on the price under the mouse cursor
    const priceAtMouse = currentMax - mouseRatio * rangeSize;
    const newRangeSize = rangeSize * scaleFactor;

    // Keep the price under the mouse cursor fixed while zooming
    const newMax = priceAtMouse + mouseRatio * newRangeSize;
    const newMin = priceAtMouse - (1 - mouseRatio) * newRangeSize;

    // setVisibleRange automatically disables autoScale
    priceScale.setVisibleRange({ from: newMin, to: newMax });
  };

  // Use capture phase to intercept BEFORE the library's internal wheel handler
  container.addEventListener('wheel', wheelHandler, { capture: true, passive: false });

  // Store cleanup reference on the container for removePriceAxisWheelZoom()
  (container as any).__removePriceAxisWheelZoom = () => {
    container.removeEventListener('wheel', wheelHandler, { capture: true });
  };

  return () => {
    container.removeEventListener('wheel', wheelHandler, { capture: true });
  };
}

/**
 * Removes the stored price-axis wheel zoom handler from a container.
 */
export function removePriceAxisWheelZoom(container: HTMLElement | null): void {
  if (container && (container as any).__removePriceAxisWheelZoom) {
    (container as any).__removePriceAxisWheelZoom();
    delete (container as any).__removePriceAxisWheelZoom;
  }
}
