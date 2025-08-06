
'use client';
import React from 'react';
import { 
  ChartComponent, 
  SeriesCollectionDirective, 
  SeriesDirective,
  Inject,
  DateTime,
  Tooltip,
  Crosshair,
  LineSeries,
  Zoom,
  Legend,
  DataLabel
} from '@syncfusion/ej2-react-charts';
interface SyncfusionChartComponentsProps {
  data: any[];
  height: number;
  symbol: string;
}
const SyncfusionChartComponents: React.FC<SyncfusionChartComponentsProps> = ({ 
  data, 
  height, 
  symbol 
}) => {
  const primaryXAxis = {
    valueType: 'DateTime',
    labelFormat: 'HH:mm:ss',
    majorGridLines: { width: 0 },
    intervalType: 'Minutes',
    edgeLabelPlacement: 'Shift',
    labelStyle: {
      fontFamily: 'Segoe UI',
      size: '12px',
      color: '#333'
    }
  };
  const primaryYAxis = {
    labelFormat: '₹{value}',
    rangePadding: 'None',
    minimum: Math.min(...data.map(item => item.low)) * 0.99,
    maximum: Math.max(...data.map(item => item.high)) * 1.01,
    interval: 5,
    lineStyle: { width: 0 },
    majorTickLines: { width: 0 },
    minorTickLines: { width: 0 },
    labelStyle: {
      fontFamily: 'Segoe UI',
      size: '12px',
      color: '#333'
    }
  };
  const title = `${symbol} Price Chart`;
  const tooltip = {
    enable: true,
    shared: true,
    format: '${series.name} : ₹${point.y}',
    header: '${point.x}'
  };
  const crosshair = {
    enable: true,
    lineType: 'Vertical',
    line: {
      width: 1,
      color: 'rgba(0, 0, 0, 0.3)'
    }
  };
  const marker = {
    visible: true,
    height: 7,
    width: 7,
    shape: 'Circle',
    fill: '#2962FF'
  };
  const chartArea = {
    border: {
      width: 0
    }
  };
  const legendSettings = {
    visible: true,
    position: 'Top',
    alignment: 'Far'
  };
  const zoomSettings = {
    enableMouseWheelZooming: true,
    enablePinchZooming: true,
    enableSelectionZooming: true,
    mode: 'X',
    enableScrollbar: true
  };
  return (
    <ChartComponent 
      id="syncfusion-chart"
      style={{ width: '100%', height: '100%' }}
      primaryXAxis={primaryXAxis}
      primaryYAxis={primaryYAxis}
      title={title}
      titleStyle={{ fontFamily: 'Segoe UI', size: '16px', fontWeight: 'bold', color: '#333' }}
      tooltip={tooltip}
      crosshair={crosshair}
      chartArea={chartArea}
      legendSettings={legendSettings}
      zoomSettings={zoomSettings}
      width="100%"
      height={`${height}px`}
    >
      <Inject services={[
        LineSeries, 
        DateTime, 
        Tooltip, 
        Crosshair, 
        Zoom, 
        Legend, 
        DataLabel
      ]} />
      <SeriesCollectionDirective>
        <SeriesDirective 
          dataSource={data} 
          xName="x" 
          yName="close" 
          name={symbol}
          type="Line"
          width={2}
          marker={marker}
          fill="#2962FF"
        />
      </SeriesCollectionDirective>
    </ChartComponent>
  );
};
export default SyncfusionChartComponents;

