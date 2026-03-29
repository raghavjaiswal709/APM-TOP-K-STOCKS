'use client';

/**
 * TimeMachineStockChart — Dedicated chart component for the Recommendations / Time Machine page.
 * Clone of the shared LightWeightStockChart wrapper with:
 *  - "Separate View" button hidden (not relevant for historical replay)
 *  - GTT Eye toggle hidden (no live GTT predictions in Time Machine mode)
 */

import React from 'react';
import { LightWeightStockChart } from '@/app/components/charts/LightWeightStockChart';
import type { ComponentProps } from 'react';

type ChartProps = ComponentProps<typeof LightWeightStockChart>;

export const TimeMachineStockChart: React.FC<ChartProps> = (props) => {
  return (
    <LightWeightStockChart
      {...props}
      hideSeparateView={true}
      hideGttEyeToggle={true}
    />
  );
};

export default TimeMachineStockChart;
