// // src/components/charts/FinancialChartComponents.tsx
// 'use client';
// import React from 'react';
// import { format } from "d3-format";
// import { timeFormat } from "d3-time-format";
// import {
//   ChartCanvas,
//   Chart,
//   LineSeries,
//   CandlestickSeries,
//   XAxis,
//   YAxis,
//   CrossHairCursor,
//   EdgeIndicator,
//   MouseCoordinateX,
//   MouseCoordinateY,
//   OHLCTooltip,
//   ZoomButtons,
//   withSize,
//   withDeviceRatio
// } from "react-financial-charts";

// interface FinancialChartComponentsProps {
//   data: any[];
//   height: number;
//   width?: number;
//   ratio?: number;
//   symbol: string;
// }

// const FinancialChartComponents: React.FC<FinancialChartComponentsProps> = ({ 
//   data, 
//   height, 
//   width = 800, 
//   ratio = 1,
//   symbol
// }) => {
//   const margin = { left: 50, right: 50, top: 30, bottom: 30 };
//   const priceDisplayFormat = format(".2f");
//   const timeDisplayFormat = timeFormat("%H:%M:%S");
  
//   const xAccessor = (d: any) => d.date;
//   const xExtents = [
//     xAccessor(data[0]),
//     xAccessor(data[data.length - 1])
//   ];
  
//   return (
//     <ChartCanvas
//       height={height}
//       ratio={ratio}
//       width={width}
//       margin={margin}
//       seriesName={symbol}
//       data={data}
//       xAccessor={xAccessor}
//       xScale={d3.scaleTime()}
//       xExtents={xExtents}
//       disableZoom={false}
//     >
//       <Chart id={1} yExtents={(d: any) => [d.high, d.low]}>
//         <XAxis 
//           axisAt="bottom" 
//           orient="bottom" 
//           ticks={6} 
//           tickFormat={timeDisplayFormat}
//           stroke="#333"
//           tickStroke="#333"
//           opacity={0.5}
//         />
//         <YAxis 
//           axisAt="right" 
//           orient="right" 
//           ticks={5} 
//           tickFormat={priceDisplayFormat}
//           stroke="#333"
//           tickStroke="#333"
//           opacity={0.5}
//         />
        
//         <LineSeries 
//           yAccessor={(d: any) => d.close} 
//           strokeWidth={2}
//           stroke="#2962FF"
//           strokeOpacity={1}
//         />
        
//         <MouseCoordinateX
//           at="bottom"
//           orient="bottom"
//           displayFormat={timeDisplayFormat}
//           rectRadius={5}
//           fill="#2962FF"
//           opacity={0.8}
//           textFill="#FFFFFF"
//         />
//         <MouseCoordinateY
//           at="right"
//           orient="right"
//           displayFormat={priceDisplayFormat}
//           rectRadius={5}
//           fill="#2962FF"
//           opacity={0.8}
//           textFill="#FFFFFF"
//         />
        
//         <EdgeIndicator
//           itemType="last"
//           orient="right"
//           edgeAt="right"
//           yAccessor={(d: any) => d.close}
//           fill={(d: any) => d.close > d.open ? "#26a69a" : "#ef5350"}
//           lineStroke={(d: any) => d.close > d.open ? "#26a69a" : "#ef5350"}
//           strokeWidth={2}
//           textFill="#FFFFFF"
//           fontSize={12}
//         />
        
//         <OHLCTooltip 
//           origin={[0, 0]} 
//           textFill="#333333"
//           labelFill="#2962FF"
//           fontSize={12}
//         />
//         <ZoomButtons />
//       </Chart>
//       <CrossHairCursor stroke="#888888" />
//     </ChartCanvas>
//   );
// };

// // Wrap component with size and device ratio HOCs
// const ResponsiveChart = withSize({ style: { minHeight: 500, width: "100%" } })(
//   withDeviceRatio()(FinancialChartComponents)
// );

// export default FinancialChartComponents;
