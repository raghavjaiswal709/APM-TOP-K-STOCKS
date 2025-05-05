// import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
// import { Logger } from '@nestjs/common';
// import { Server, Socket } from 'socket.io';
// import { spawn } from 'child_process';
// import * as path from 'path';
// import { DefaultEventsMap } from 'socket.io/dist/typed-events';

// @WebSocketGateway(5001, {
//   cors: {
//     origin: '*',
//   },
//   namespace: '/',
// })
// export class PythonBridgeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
//   @WebSocketServer() server: Server;
//   private readonly logger = new Logger(PythonBridgeGateway.name);
//   private pythonProcess: any;
//   private clientToSymbols = new Map<string, Set<string>>();
//   private marketData = new Map<string, any>();
//   private isPythonReady = false;
//   // Fix 1: Properly type the Socket with null
//   private pythonSocket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | null = null;

//   afterInit() {
//     this.startPythonScript();
//   }

//   handleConnection(client: Socket) {
//     this.logger.log(`Client connected: ${client.id}`);
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`Client disconnected: ${client.id}`);
    
//     // Clean up subscriptions
//     if (this.clientToSymbols.has(client.id)) {
//       const symbols = this.clientToSymbols.get(client.id);
//       this.clientToSymbols.delete(client.id);
      
//       // Check if any symbols should be unsubscribed (no other clients subscribed)
//       // Fix 2: Initialize the array and check for undefined
//       if (symbols) {
//         const symbolsToUnsubscribe: string[] = []; // Fix 3: Properly type the array
//         for (const symbol of symbols) {
//           let isSubscribedByOthers = false;
//           for (const [_, otherSymbols] of this.clientToSymbols) {
//             if (otherSymbols.has(symbol)) {
//               isSubscribedByOthers = true;
//               break;
//             }
//           }
          
//           if (!isSubscribedByOthers) {
//             symbolsToUnsubscribe.push(symbol);
//           }
//         }
        
//         // Unsubscribe from symbols no longer needed
//         if (symbolsToUnsubscribe.length > 0 && this.pythonSocket) {
//           this.pythonSocket.emit('unsubscribe', { symbols: symbolsToUnsubscribe });
//         }
//       }
//     }
//   }

//   @SubscribeMessage('subscribe')
//   handleSubscribe(client: Socket, payload: { symbol: string }) {
//     const { symbol } = payload;
//     this.logger.log(`Client ${client.id} subscribing to ${symbol}`);
    
//     // Track client subscriptions
//     if (!this.clientToSymbols.has(client.id)) {
//       this.clientToSymbols.set(client.id, new Set<string>());
//     }
    
//     // Fix 4: Add null check before accessing
//     const clientSymbols = this.clientToSymbols.get(client.id);
//     if (clientSymbols) {
//       clientSymbols.add(symbol);
//     }
    
//     // Send cached data if available
//     if (this.marketData.has(symbol)) {
//       client.emit('marketData', { 
//         symbol, 
//         data: this.marketData.get(symbol) 
//       });
//     }
    
//     // Forward subscription to Python
//     if (this.isPythonReady && this.pythonSocket) {
//       this.pythonSocket.emit('subscribe', { symbols: [symbol] });
//     }
    
//     return { success: true, symbol };
//   }

//   @SubscribeMessage('unsubscribe')
//   handleUnsubscribe(client: Socket, payload: { symbol: string }) {
//     const { symbol } = payload;
//     this.logger.log(`Client ${client.id} unsubscribing from ${symbol}`);
    
//     // Remove from client subscriptions
//     if (this.clientToSymbols.has(client.id)) {
//       // Fix 5: Add null check before accessing
//       const clientSymbols = this.clientToSymbols.get(client.id);
//       if (clientSymbols) {
//         clientSymbols.delete(symbol);
//       }
//     }
    
//     // Check if any other clients are subscribed to this symbol
//     let isSubscribedByOthers = false;
//     for (const [clientId, symbols] of this.clientToSymbols) {
//       if (clientId !== client.id && symbols && symbols.has(symbol)) {
//         isSubscribedByOthers = true;
//         break;
//       }
//     }
    
//     // Unsubscribe from Python if no other clients need this symbol
//     if (!isSubscribedByOthers && this.isPythonReady && this.pythonSocket) {
//       this.pythonSocket.emit('unsubscribe', { symbols: [symbol] });
//     }
    
//     return { success: true, symbol };
//   }

//   private startPythonScript() {
//     try {
//       const scriptPath = path.join(process.cwd(), 'fyers_data.py');
//       this.logger.log(`Starting Python script: ${scriptPath}`);
      
//       this.pythonProcess = spawn('python', [scriptPath], {
//         stdio: ['inherit', 'inherit', 'inherit']
//       });
      
//       this.pythonProcess.on('error', (error) => {
//         this.logger.error(`Failed to start Python script: ${error.message}`);
//       });
      
//       this.pythonProcess.on('close', (code) => {
//         this.logger.log(`Python script exited with code ${code}`);
//         this.isPythonReady = false;
//         // Fix 6: Properly set to null with type
//         this.pythonSocket = null;
//       });
      
//       // Set up event handlers for Python socket connection
//       this.server.on('connection', (socket) => {
//         if (socket.handshake.headers['user-agent']?.includes('python-socketio')) {
//           this.logger.log('Python script connected');
//           this.pythonSocket = socket;
          
//           // Handle market data from Python
//           // Inside the server.on('connection') handler:
// socket.on('marketData', (data) => {
//     // Forward the exact raw data from Python to clients
//     for (const [clientId, symbols] of this.clientToSymbols.entries()) {
//       if (symbols && symbols.has(data.symbol)) {
//         const client = this.server.sockets.sockets.get(clientId);
//         if (client) {
//           // Send the raw data exactly as received from Python
//           client.emit('marketData', data);
//         }
//       }
//     }
    
//     // Also log to console for debugging
//     this.logger.log(`Market data received: ${data.symbol}`);
//   });
  
          
//           // Handle Fyers connection status
//           socket.on('fyersReady', () => {
//             this.logger.log('Fyers connection ready');
//             this.isPythonReady = true;
//           });
          
//           socket.on('fyersConnected', () => {
//             this.logger.log('Fyers WebSocket connected');
//           });
          
//           socket.on('fyersDisconnected', () => {
//             this.logger.log('Fyers WebSocket disconnected');
//           });
          
//           socket.on('error', (error) => {
//             this.logger.error(`Fyers error: ${error.message}`);
//           });
//         }
//       });
      
//     } catch (error) {
//       this.logger.error(`Error starting Python script: ${error.message}`);
//     }
//   }
// }


import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { spawn } from 'child_process';
import * as path from 'path';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

@WebSocketGateway(5001, {
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class PythonBridgeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PythonBridgeGateway.name);
  private pythonProcess: any;
  private clientToSymbols = new Map<string, Set<string>>();
  private marketData = new Map<string, any>();
  private isPythonReady = false;
  private pythonSocket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | null = null;

  afterInit() {
    this.startPythonScript();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up subscriptions
    if (this.clientToSymbols.has(client.id)) {
      const symbols = this.clientToSymbols.get(client.id);
      this.clientToSymbols.delete(client.id);
      
      // Check if any symbols should be unsubscribed (no other clients subscribed)
      if (symbols) {
        const symbolsToUnsubscribe: string[] = [];
        for (const symbol of symbols) {
          let isSubscribedByOthers = false;
          for (const [_, otherSymbols] of this.clientToSymbols) {
            if (otherSymbols && otherSymbols.has(symbol)) {
              isSubscribedByOthers = true;
              break;
            }
          }
          
          if (!isSubscribedByOthers) {
            symbolsToUnsubscribe.push(symbol);
          }
        }
        
        // Unsubscribe from symbols no longer needed
        if (symbolsToUnsubscribe.length > 0 && this.pythonSocket) {
          this.pythonSocket.emit('unsubscribe', { symbols: symbolsToUnsubscribe });
        }
      }
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { symbol: string }) {
    const { symbol } = payload;
    this.logger.log(`Client ${client.id} subscribing to ${symbol}`);
    
    // Track client subscriptions
    if (!this.clientToSymbols.has(client.id)) {
      this.clientToSymbols.set(client.id, new Set<string>());
    }
    
    // Add null check before accessing
    const clientSymbols = this.clientToSymbols.get(client.id);
    if (clientSymbols) {
      clientSymbols.add(symbol);
    }
    
    // Send cached data if available
    if (this.marketData.has(symbol)) {
      client.emit('marketData', this.marketData.get(symbol));
    }
    
    // Forward subscription to Python
    if (this.isPythonReady && this.pythonSocket) {
      this.pythonSocket.emit('subscribe', { symbols: [symbol] });
    }
    
    return { success: true, symbol };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { symbol: string }) {
    const { symbol } = payload;
    this.logger.log(`Client ${client.id} unsubscribing from ${symbol}`);
    
    // Remove from client subscriptions
    if (this.clientToSymbols.has(client.id)) {
      // Add null check before accessing
      const clientSymbols = this.clientToSymbols.get(client.id);
      if (clientSymbols) {
        clientSymbols.delete(symbol);
      }
    }
    
    // Check if any other clients are subscribed to this symbol
    let isSubscribedByOthers = false;
    for (const [clientId, symbols] of this.clientToSymbols) {
      if (clientId !== client.id && symbols && symbols.has(symbol)) {
        isSubscribedByOthers = true;
        break;
      }
    }
    
    // Unsubscribe from Python if no other clients need this symbol
    if (!isSubscribedByOthers && this.isPythonReady && this.pythonSocket) {
      this.pythonSocket.emit('unsubscribe', { symbols: [symbol] });
    }
    
    return { success: true, symbol };
  }

  private startPythonScript() {
    try {
      const scriptPath = path.join(process.cwd(), 'fyers_data.py');
      this.logger.log(`Starting Python script: ${scriptPath}`);
      
      this.pythonProcess = spawn('python', [scriptPath], {
        stdio: ['inherit', 'inherit', 'inherit']
      });
      
      this.pythonProcess.on('error', (error) => {
        this.logger.error(`Failed to start Python script: ${error.message}`);
      });
      
      this.pythonProcess.on('close', (code) => {
        this.logger.log(`Python script exited with code ${code}`);
        this.isPythonReady = false;
        this.pythonSocket = null;
      });
      
      // Set up event handlers for Python socket connection
      this.server.on('connection', (socket) => {
        if (socket.handshake.headers['user-agent']?.includes('python-socketio')) {
          this.logger.log('Python script connected');
          this.pythonSocket = socket;
          
          // Handle market data from Python
          socket.on('marketData', (data) => {
            // Log the raw data received from Python
            this.logger.log(`Raw market data received: ${JSON.stringify(data)}`);
            
            // Broadcast to all clients - this is the key change
            this.server.emit('marketData', data);
            
            // Store the data
            if (data && data.symbol) {
              this.marketData.set(data.symbol, data);
            }
          });
          
          // Handle Fyers messages
          socket.on('fyersMessage', (message) => {
            this.logger.log(`Fyers message: ${JSON.stringify(message)}`);
          });
          
          // Handle Fyers connection status
          socket.on('fyersReady', () => {
            this.logger.log('Fyers connection ready');
            this.isPythonReady = true;
          });
          
          socket.on('fyersConnected', () => {
            this.logger.log('Fyers WebSocket connected');
          });
          
          socket.on('fyersDisconnected', () => {
            this.logger.log('Fyers WebSocket disconnected');
          });
          
          socket.on('error', (error) => {
            this.logger.error(`Fyers error: ${error.message}`);
          });
        }
      });
      
    } catch (error) {
      this.logger.error(`Error starting Python script: ${error.message}`);
    }
  }
}

