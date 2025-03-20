import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectIndicators() {
  return (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select Indicator" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Technical Indicators</SelectLabel>
          <SelectItem value="ma">Moving Average (MA)</SelectItem>
          <SelectItem value="macd">Moving Average Convergence Divergence (MACD)</SelectItem>
          <SelectItem value="rsi">Relative Strength Index (RSI)</SelectItem>
          <SelectItem value="obv">On-Balance Volume (OBV)</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Fundamental Indicators</SelectLabel>
          <SelectItem value="eps">Earnings Per Share (EPS)</SelectItem>
          <SelectItem value="pe">Price-to-Earnings Ratio (P/E)</SelectItem>
          <SelectItem value="dividend">Dividend Yield</SelectItem>
          <SelectItem value="bookValue">Book Value</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Economic Indicators</SelectLabel>
          <SelectItem value="cpi">Consumer Price Index (CPI)</SelectItem>
          <SelectItem value="ppi">Producer Price Index (PPI)</SelectItem>
          <SelectItem value="gdp">Gross Domestic Product (GDP)</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
