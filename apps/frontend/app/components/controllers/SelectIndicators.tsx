'use client'
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
interface SelectIndicatorsProps {
  onIndicatorsChange?: (indicators: string[]) => void;
}
export function SelectIndicators({ onIndicatorsChange }: SelectIndicatorsProps) {
  const [selectedIndicators, setSelectedIndicators] = React.useState<string[]>([]);
  const handleValueChange = (value: string) => {
    const newIndicators = selectedIndicators.includes(value)
      ? selectedIndicators.filter(i => i !== value)
      : [...selectedIndicators, value];
    setSelectedIndicators(newIndicators);
    if (onIndicatorsChange) {
      onIndicatorsChange(newIndicators);
    }
  };
  return (
    <Select onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={
          selectedIndicators.length 
            ? `${selectedIndicators.length} indicator(s) selected` 
            : "Select Indicators"
        } />
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
      </SelectContent>
    </Select>
  );
}

