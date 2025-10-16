'use client'
import * as React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface RadioGroupDemoProps {
  value: string;
  onChange: (value: string) => void;
}

export function RadioGroupDemo({ value, onChange }: RadioGroupDemoProps) {
  return (
    <RadioGroup 
      value={value} 
      onValueChange={onChange}
      className="flex gap-4"
    >
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="A" id="watchlist-a" />
        <Label htmlFor="watchlist-a" className="cursor-pointer">
          Watchlist A
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="B" id="watchlist-b" />
        <Label htmlFor="watchlist-b" className="cursor-pointer">
          Watchlist B
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="C" id="watchlist-c" />
        <Label htmlFor="watchlist-c" className="cursor-pointer">
          Watchlist C
        </Label>
      </div>
    </RadioGroup>
  );
}
