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

export function SelectInterval() {
  return (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select Interval" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Common Intervals</SelectLabel>
          <SelectItem value="1m">1 Minute</SelectItem>
          <SelectItem value="5m">5 Minutes</SelectItem>
          <SelectItem value="15m">15 Minutes</SelectItem>
          <SelectItem value="30m">30 Minutes</SelectItem>
          <SelectItem value="1h">1 Hour</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Daily Intervals</SelectLabel>
          <SelectItem value="1d">1 Day</SelectItem>
          <SelectItem value="1w">1 Week</SelectItem>
          <SelectItem value="1mo">1 Month</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Custom</SelectLabel>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
