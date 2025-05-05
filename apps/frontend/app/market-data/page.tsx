// 'use client';
// import React, { useEffect, useState } from 'react';
// import { io, Socket } from 'socket.io-client';
// import dynamic from 'next/dynamic';

// // Import chart component with dynamic loading (no SSR)
// const MarketChart = dynamic(() => import('./components/MarketChart'), {
//   ssr: false,
// });

// interface MarketData {
//   ltp: number;
//   change?: number;
//   changePercent?: number;
//   open?: number;
//   high?: number;
//   low?: number;
//   close?: number;
//   volume?: number;
//   timestamp?: number;
//   bid?: number;
//   ask?: number;
//   // Fyers specific fields
//   symbol?: string;
//   ch?: number;
//   chp?: number;
//   open_price?: number;
//   high_price?: number;
//   low_price?: number;
//   prev_close_price?: number;
//   vol_traded_today?: number;
//   last_traded_time?: number;
//   bid_price?: number;
//   ask_price?: number;
//   [key: string]: any;
// }

// const MarketDataPage: React.FC = () => {
//   const [socket, setSocket] = useState<Socket | null>(null);
//   const [selectedSymbol, setSelectedSymbol] = useState<string>('NSE:ADANIENT-EQ');
//   const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
//   const [availableSymbols] = useState<string[]>([
    
//     'NSE:ADANIENT-EQ'
//   ]);

//   useEffect(() => {
//     // Connect to WebSocket server
//     const newSocket = io('http://localhost:5000');
//     setSocket(newSocket);

//     // Set up event listeners
//     newSocket.on('connect', () => {
//       console.log('Connected to WebSocket server');
//     });

//     newSocket.on('disconnect', () => {
//       console.log('Disconnected from WebSocket server');
//     });

//     newSocket.on('marketData', (data: any) => {
//       console.log('Received market data:', data);
//       if (data && data.symbol) {
//         setMarketData(prev => ({
//           ...prev,
//           [data.symbol]: data
//         }));
//       }
//     });

//     // Subscribe to default symbol
//     if (selectedSymbol) {
//       newSocket.emit('subscribe', { symbol: selectedSymbol });
//     }

//     // Cleanup on unmount
//     return () => {
//       if (newSocket) {
//         newSocket.disconnect();
//       }
//     };
//   }, []);

//   // Handle symbol change
//   useEffect(() => {
//     if (socket && selectedSymbol) {
//       // Subscribe to new symbol
//       socket.emit('subscribe', { symbol: selectedSymbol });
      
//       // Unsubscribe from previous symbols (except the selected one)
//       Object.keys(marketData).forEach(symbol => {
//         if (symbol !== selectedSymbol) {
//           socket.emit('unsubscribe', { symbol });
//         }
//       });
//     }
//   }, [selectedSymbol, socket]);

//   const formatPrice = (price?: number) => {
//     return price?.toFixed(2) || '0.00';
//   };

//   const formatChange = (change?: number, percent?: number) => {
//     if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
//     const sign = change >= 0 ? '+' : '';
//     return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
//   };

//   const getChangeClass = (change?: number) => {
//     if (!change && change !== 0) return '';
//     return change >= 0 ? 'text-green-500' : 'text-red-500';
//   };

//   const currentData = marketData[selectedSymbol];
  
//   // Use either standard or Fyers-specific field names
//   const getValue = (data: MarketData | undefined, field: string, fyersField: string) => {
//     if (!data) return undefined;
//     return data[field] !== undefined ? data[field] : data[fyersField];
//   };

//   return (
//     <div className="container mx-auto p-4">
//       <h1 className="text-2xl font-bold mb-4">Live Market Data</h1>
      
//       <div className="mb-4">
//         <label htmlFor="symbol" className="block mb-2">Select Symbol:</label>
//         <select
//           id="symbol"
//           value={selectedSymbol}
//           onChange={(e) => setSelectedSymbol(e.target.value)}
//           className="p-2 border rounded w-full md:w-64"
//         >
//           {availableSymbols.map(symbol => (
//             <option key={symbol} value={symbol}>{symbol}</option>
//           ))}
//         </select>
//       </div>
      
//       {currentData ? (
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//           <div className="bg-white p-4 rounded shadow">
//             <h2 className="text-xl font-semibold mb-2">{selectedSymbol}</h2>
//             <div className="text-3xl font-bold mb-2">₹{formatPrice(currentData.ltp)}</div>
//             <div className={`text-lg ${getChangeClass(getValue(currentData, 'change', 'ch'))}`}>
//               {formatChange(
//                 getValue(currentData, 'change', 'ch'), 
//                 getValue(currentData, 'changePercent', 'chp')
//               )}
//             </div>
            
//             <div className="grid grid-cols-2 gap-2 mt-4">
//               <div>
//                 <div className="text-sm text-gray-500">Open</div>
//                 <div>₹{formatPrice(getValue(currentData, 'open', 'open_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Prev Close</div>
//                 <div>₹{formatPrice(getValue(currentData, 'close', 'prev_close_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">High</div>
//                 <div>₹{formatPrice(getValue(currentData, 'high', 'high_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Low</div>
//                 <div>₹{formatPrice(getValue(currentData, 'low', 'low_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Bid</div>
//                 <div>₹{formatPrice(getValue(currentData, 'bid', 'bid_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Ask</div>
//                 <div>₹{formatPrice(getValue(currentData, 'ask', 'ask_price'))}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Volume</div>
//                 <div>{getValue(currentData, 'volume', 'vol_traded_today')?.toLocaleString() || '0'}</div>
//               </div>
//               <div>
//                 <div className="text-sm text-gray-500">Last Updated</div>
//                 <div>{new Date((getValue(currentData, 'timestamp', 'last_traded_time') || 0) * 1000).toLocaleTimeString()}</div>
//               </div>
//             </div>
//           </div>
          
//           <div className="bg-white p-4 rounded shadow h-80">
//             <MarketChart symbol={selectedSymbol} data={currentData} />
//           </div>
//         </div>
//       ) : (
//         <div className="bg-white p-4 rounded shadow text-center">
//           <p>Loading market data...</p>
//         </div>
//       )}
      
//       {/* Debug section */}
//       <div className="mt-8 p-4 bg-gray-100 rounded">
//         <h3 className="text-lg font-semibold mb-2">Raw Market Data (Debug)</h3>
//         <pre className="text-xs overflow-auto max-h-60">
//           {JSON.stringify(currentData, null, 2)}
//         </pre>
//       </div>
//     </div>
//   );
// };

// export default MarketDataPage;


'use client';
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';

// Import chart component with dynamic loading (no SSR)
const MarketChart = dynamic(() => import('./components/MarketChart'), {
  ssr: false,
});

interface MarketData {
  ltp: number;
  symbol: string;
  ch?: number;
  chp?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  prev_close_price?: number;
  vol_traded_today?: number;
  last_traded_time?: number;
  bid_price?: number;
  ask_price?: number;
  [key: string]: any;
}

const MarketDataPage: React.FC = () => {
  // Use a state to track client-side rendering
  const [isClient, setIsClient] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NSE:ADANIENT-EQ');
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [availableSymbols] = useState<string[]>([
    'NSE:NIFTY50-INDEX',
    'NSE:BANKNIFTY-INDEX',
    'NSE:RELIANCE-EQ',
    'NSE:TCS-EQ',
    'NSE:INFY-EQ',
    'NSE:ADANIENT-EQ'
  ]);
  const [socketStatus, setSocketStatus] = useState<string>('Disconnected');
  const [lastDataReceived, setLastDataReceived] = useState<Date | null>(null);

  // First useEffect to set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
    console.log('Component mounted, isClient set to true');
  }, []);

  // Socket connection useEffect - only runs on client side
  useEffect(() => {
    if (!isClient) return;

    console.log('Attempting to connect to WebSocket server at http://localhost:5000');
    
    // Connect to WebSocket server
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    setSocket(newSocket);

    // Set up event listeners with detailed logging
    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      console.log('Socket ID:', newSocket.id);
      setSocketStatus('Connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setSocketStatus(`Connection error: ${error.message}`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server. Reason:', reason);
      setSocketStatus(`Disconnected: ${reason}`);
    });

    newSocket.on('marketData', (data: any) => {
      console.log('📊 Received market data:', data);
      setLastDataReceived(new Date());
      
      if (data && data.symbol) {
        setMarketData(prev => ({
          ...prev,
          [data.symbol]: data
        }));
      } else {
        console.warn('⚠️ Received market data without symbol property:', data);
      }
    });

    // Subscribe to default symbol with a small delay to ensure connection
    setTimeout(() => {
      console.log('🔔 Subscribing to symbol:', selectedSymbol);
      newSocket.emit('subscribe', { symbol: selectedSymbol });
    }, 1000);

    // Check for data every 5 seconds
    const dataCheckInterval = setInterval(() => {
      const now = new Date();
      const lastReceived = lastDataReceived;
      
      if (!lastReceived || now.getTime() - lastReceived.getTime() > 10000) {
        console.warn('⚠️ No market data received in the last 10 seconds');
      }
    }, 5000);

    // Cleanup on unmount
    return () => {
      console.log('Component unmounting, cleaning up socket connection');
      clearInterval(dataCheckInterval);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isClient, selectedSymbol]);

  // Handle symbol change - only runs on client side
  useEffect(() => {
    if (!isClient || !socket) return;
    
    console.log('🔄 Symbol changed to:', selectedSymbol);
    
    // Subscribe to new symbol
    socket.emit('subscribe', { symbol: selectedSymbol });
    console.log('🔔 Subscribed to:', selectedSymbol);
    
    // Unsubscribe from previous symbols (except the selected one)
    Object.keys(marketData).forEach(symbol => {
      if (symbol !== selectedSymbol) {
        console.log('🔕 Unsubscribing from:', symbol);
        socket.emit('unsubscribe', { symbol });
      }
    });
  }, [selectedSymbol, socket, marketData, isClient]);

  const formatPrice = (price?: number) => {
    return price?.toFixed(2) || '0.00';
  };

  const formatChange = (change?: number, percent?: number) => {
    if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const getChangeClass = (change?: number) => {
    if (!change && change !== 0) return '';
    return change >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const currentData = marketData[selectedSymbol];

  // Return a loading state during server rendering
  if (!isClient) {
    return <div className="container mx-auto p-4">Loading market data...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Live Market Data</h1>
      
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <p><strong>Socket Status:</strong> {socketStatus}</p>
        <p><strong>Last Data Received:</strong> {lastDataReceived ? lastDataReceived.toLocaleTimeString() : 'No data yet'}</p>
        <p><strong>Available Symbols:</strong> {availableSymbols.length}</p>
        <p><strong>Cached Symbols:</strong> {Object.keys(marketData).join(', ') || 'None'}</p>
      </div>
      
      <div className="mb-4">
        <label htmlFor="symbol" className="block mb-2">Select Symbol:</label>
        <select
          id="symbol"
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="p-2 border rounded w-full md:w-64"
        >
          {availableSymbols.map(symbol => (
            <option key={symbol} value={symbol}>{symbol}</option>
          ))}
        </select>
      </div>
      
      {currentData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-2">{selectedSymbol}</h2>
            <div className="text-3xl font-bold mb-2">₹{formatPrice(currentData.ltp)}</div>
            <div className={`text-lg ${getChangeClass(currentData.ch)}`}>
              {formatChange(currentData.ch, currentData.chp)}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div>
                <div className="text-sm text-gray-500">Open</div>
                <div>₹{formatPrice(currentData.open_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Prev Close</div>
                <div>₹{formatPrice(currentData.prev_close_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">High</div>
                <div>₹{formatPrice(currentData.high_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Low</div>
                <div>₹{formatPrice(currentData.low_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Bid</div>
                <div>₹{formatPrice(currentData.bid_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Ask</div>
                <div>₹{formatPrice(currentData.ask_price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Volume</div>
                <div>{currentData.vol_traded_today?.toLocaleString() || '0'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Last Updated</div>
                <div>{new Date((currentData.last_traded_time || 0) * 1000).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded shadow h-80">
            <MarketChart symbol={selectedSymbol} data={{
              ltp: currentData.ltp,
              timestamp: currentData.last_traded_time || Math.floor(Date.now() / 1000)
            }} />
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded shadow text-center">
          <p>No data available for {selectedSymbol}. Waiting for updates...</p>
        </div>
      )}
      
      {/* Debug section */}
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="text-lg font-semibold mb-2">Raw Market Data (Debug)</h3>
        {currentData ? (
          <pre className="text-xs overflow-auto max-h-60">
            {JSON.stringify(currentData, null, 2)}
          </pre>
        ) : (
          <p>No data received yet. Check console for connection details.</p>
        )}
      </div>
    </div>
  );
};

export default MarketDataPage;
