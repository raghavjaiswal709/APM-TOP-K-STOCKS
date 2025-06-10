import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface RadioGroupDemoProps {
  value: string;
  onChange: (value: string) => void;
}

export const RadioGroupDemo = React.memo(({ value, onChange }: RadioGroupDemoProps) => {
  return (
    <RadioGroup className="flex" value={value} onValueChange={onChange}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="A" id="r1" />
        <Label htmlFor="r1">A</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="B" id="r2" />
        <Label htmlFor="r2">B</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="C" id="r3" />
        <Label htmlFor="r3">C</Label>
      </div>
    </RadioGroup>
  );
});

RadioGroupDemo.displayName = 'RadioGroupDemo';
