# 🚀 GTT Refactor Implementation Guide

This guide provides the **exact steps** to manually update your code. I have already created the necessary service files (`gttService.ts` and `useGttPredictions.ts`) for you.

## ✅ Step 1: Create Environment File

Create a file named `.env.local` in `apps/frontend/` (if it doesn't exist) and add:

```bash
NEXT_PUBLIC_GTT_API_URL=http://localhost:5113
```

---

## ✅ Step 2: Modify `apps/frontend/app/market-data/page.tsx`

**Goal:** Remove the redundant GTT toggle and state.

### 1. Remove State Variable
**Search for:**
```typescript
const [isGttEnabled, setIsGttEnabled] = useState(false); // New GTT State
```
**Action:** DELETE this line completely.

### 2. Remove Toggle Button
**Search for:**
```tsx
{/* GTT Toggle Button */}
<button
  onClick={() => setIsGttEnabled(!isGttEnabled)}
  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${isGttEnabled
    ? 'bg-purple-600 text-white hover:bg-purple-700'
    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
>
  {isGttEnabled ? '⚡ GTT ON' : '⚡ GTT OFF'}
</button>
```
*(Note: The exact code might vary slightly, look for the button with "GTT ON" / "GTT OFF" text near the "Predictions" button)*
**Action:** DELETE this entire button block.

### 3. Update `PlotlyChart` Props
**Search for:**
```tsx
<PlotlyChart
  data={symbolHistory}
  ohlcData={symbolOhlc}
  symbol={selectedSymbol}
  predictions={predictions}
  showPredictions={showPredictions}
  predictionRevision={predictionRevision}
  isGttEnabled={isGttEnabled} // <--- LOOK FOR THIS
/>
```
**Action:** REMOVE the `isGttEnabled={isGttEnabled}` prop. The component should look like this:

```tsx
<PlotlyChart
  data={symbolHistory}
  ohlcData={symbolOhlc}
  symbol={selectedSymbol}
  predictions={predictions}
  showPredictions={showPredictions}
  predictionRevision={predictionRevision}
/>
```

---

## ✅ Step 3: Modify `apps/frontend/app/market-data/components/charts/PlotlyChart.tsx`

**Goal:** Integrate GTT logic directly into the chart component.

### 1. Add Imports
**Add these imports at the top:**
```typescript
import { useGttPredictions } from '@/hooks/useGttPredictions';
import { calculatePriceChange } from '@/app/services/gttService';
import { Zap } from 'lucide-react'; // Add Zap icon
```

### 2. Update Interface
**Search for:**
```typescript
interface PlotlyChartProps {
```
**Action:** Remove `isGttEnabled` and `onToggleGtt` from the interface if they exist.

### 3. Update Component Logic
**Inside `PlotlyChart` component, add this state and hook:**

```typescript
  // ✅ GTT Mode Toggle (Internal to Chart Component)
  const [isGttMode, setIsGttMode] = useState(false);

  // ============ GTT PREDICTIONS INTEGRATION ============
  const {
    predictions: gttPredictions,
    latest: gttLatest,
    loading: gttLoading,
    error: gttError,
    isSupported: isGttSupported,
    refetch: refetchGtt
  } = useGttPredictions({
    symbol,
    enabled: isGttMode && !!symbol,
    pollInterval: 60000, // 1 minute
    autoStart: true
  });
```

### 4. Add GTT Traces Logic
**Add this `useMemo` block before the `return` statement:**

```typescript
  // ✅ GTT Prediction Traces
  const gttTraces = useMemo(() => {
    if (!isGttMode || !gttLatest || !isGttSupported) return [];

    const traces = [];
    const baseTime = new Date(gttLatest.prediction_time).getTime();

    const horizons = [
      { key: 'H1_pred', offset: 15, color: '#10b981', name: 'H1 (+15m)' },
      { key: 'H2_pred', offset: 30, color: '#3b82f6', name: 'H2 (+30m)' },
      { key: 'H3_pred', offset: 45, color: '#8b5cf6', name: 'H3 (+45m)' },
      { key: 'H4_pred', offset: 60, color: '#f59e0b', name: 'H4 (+60m)' },
      { key: 'H5_pred', offset: 75, color: '#ef4444', name: 'H5 (+75m)' },
    ];

    horizons.forEach(horizon => {
      const predTime = baseTime + horizon.offset * 60 * 1000;
      const predPrice = gttLatest[horizon.key as keyof typeof gttLatest] as number;

      if (predPrice) {
        traces.push({
          x: [new Date(predTime)],
          y: [predPrice],
          mode: 'markers',
          type: 'scatter',
          name: horizon.name,
          marker: {
            color: horizon.color,
            size: 10,
            symbol: 'diamond',
            line: { width: 2, color: '#ffffff' }
          },
          hovertemplate: `<b>${horizon.name}</b><br>Price: ₹%{y:.2f}<extra></extra>`,
        });
      }
    });

    return traces;
  }, [isGttMode, gttLatest, isGttSupported]);
```

### 5. Update `Plot` Data
**Search for the `<Plot>` component's `data` prop.**
**Action:** Add `...gttTraces` to the data array.

```tsx
<Plot
  data={[
    // ... existing traces ...
    ...gttTraces // <--- ADD THIS
  ]}
  // ... rest of props
/>
```

### 6. Add GTT Toggle Button
**In the controls bar (where timeframe selectors are), add:**

```tsx
{/* ✅ GTT Toggle */}
<Button
  variant={isGttMode ? 'default' : 'outline'}
  size="sm"
  onClick={() => setIsGttMode(!isGttMode)}
  disabled={!isGttSupported}
  className={`${isGttMode ? 'bg-purple-600 hover:bg-purple-700' : ''} ml-2`}
  title={!isGttSupported ? 'GTT only supports banking stocks' : 'Toggle GTT Mode'}
>
  <Zap className="w-4 h-4 mr-1" />
  {isGttMode ? 'GTT ON' : 'GTT OFF'}
</Button>
```

### 7. Add GTT Status & Details Panel
**Add this JSX below the controls bar or above the chart:**

```tsx
{/* ✅ GTT Status Indicator */}
{isGttMode && (
  <div className="mb-2 p-2 bg-purple-900/30 border border-purple-500/50 rounded flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Zap className="w-4 h-4 text-purple-400" />
      <span className="text-sm text-purple-300">
        {gttLoading ? 'Loading GTT predictions...' : 
         gttError ? '⚠️ GTT service unavailable' :
         gttLatest ? `Latest: ${gttLatest.prediction_time}` :
         'No predictions available'}
      </span>
    </div>
  </div>
)}

{/* ✅ GTT Prediction Details Panel (Optional - place below chart) */}
{isGttMode && gttLatest && (
  <div className="mt-4 grid grid-cols-5 gap-2">
    {['H1', 'H2', 'H3', 'H4', 'H5'].map((horizon, idx) => {
      const predKey = `${horizon}_pred` as keyof typeof gttLatest;
      const predValue = gttLatest[predKey] as number;
      const change = calculatePriceChange(gttLatest.input_close, predValue);

      return (
        <div key={horizon} className="p-2 bg-zinc-800 rounded text-center">
          <div className="text-xs text-zinc-400">{horizon} (+{(idx + 1) * 15}m)</div>
          <div className="text-lg font-bold text-white">₹{predValue?.toFixed(2)}</div>
          <div className={`text-xs ${change.direction === 'up' ? 'text-green-400' : change.direction === 'down' ? 'text-red-400' : 'text-zinc-400'}`}>
            {change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→'} {change.percent.toFixed(2)}%
          </div>
        </div>
      );
    })}
  </div>
)}
```

---

## 🚀 Verification
1. Start your frontend: `npm run dev`
2. Ensure your GTT backend is running on port **5113**.
3. Open a banking stock (e.g., **SBIN**).
4. Toggle **GTT ON** in the chart controls.
5. Verify that chart options (timeframe, etc.) do **NOT** reset when toggling GTT.
