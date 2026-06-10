'use client';

// Lazy, client-only wrapper around react-plotly.js.
//
// plotly.js is ~3.5 MB minified and references `window`/`document` at module-eval time,
// so it must never sit in a synchronous bundle or run during SSR. Every chart that needs
// Plotly imports `Plot` from HERE instead of directly from 'react-plotly.js'. That way the
// entire plotly bundle is code-split into its own chunk and only fetched on demand when a
// Plotly chart actually mounts — navigating to pages that don't show a Plotly chart never
// pays for it.
import dynamic from 'next/dynamic';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center text-xs text-muted-foreground animate-pulse">
      Loading chart…
    </div>
  ),
});

export default Plot;
