import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// import { RadioGroupDemo } from "./controllers/RadioGroup"
// import { SelectScrollable } from "./WatchlistSelector/SelectScrollable"
import { SelectInterval } from "./controllers/SelectInterval"
import { SelectIndicators } from "./controllers/SelectIndicators"
import { CalendarForm } from "./controllers/CalendarForm"

// import { RadioGroupDemo } from "./WatchlistSelector/RadioGroup"
import { WatchlistSelector } from "./WatchlistSelector/WatchlistSelector"


export function CardWithForm() {
  return (
    <Card className="w-full border border-opacity-30 border-gray-300">
      <CardContent className="p-6">
        <div className="flex justify-between gap-4 ">
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            
            <WatchlistSelector />
          </div>
          
          {/* Section 2 */}
          {/* <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectScrollable />
          </div> */}
          
          {/* Section 3 */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectInterval />
          </div>
          
          {/* Section 4 */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectIndicators />
          </div>
          
          {/* Section 5 */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <CalendarForm />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
