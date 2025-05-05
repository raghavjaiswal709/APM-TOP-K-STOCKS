// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   ConnectedSocket,
//   MessageBody,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Logger } from '@nestjs/common';
// import { MarketDataService } from '../market-data.service';
// import { SubscriptionDto } from '../dto/market-data.dto';
// import { io } from 'socket.io-client';

// @WebSocketGateway({
//   cors: {
//     origin: '*',
//   },
// })
// export class MarketDataGateway {
//   @WebSocketServer()
//   server: Server;
  
//   private readonly logger = new Logger(MarketDataGateway.name);
//   private clients = new Map<string, Socket>();
//   private pythonClient: any;
//   private symbolToClients = new Map<string, Set<string>>();
  
//   constructor(private readonly marketDataService: MarketDataService) {
//     // Connect to the Python bridge
//     this.pythonClient = io('http://localhost:5001');
    
//     this.pythonClient.on('connect', () => {
//       this.logger.log('Connected to Python bridge');
//     });
    
//     this.pythonClient.on('disconnect', () => {
//       this.logger.log('Disconnected from Python bridge');
//     });
    
//     this.pythonClient.on('marketData', (data) => {
//       // Forward the exact data to all connected clients
//       this.clients.forEach(client => {
//         if (this.symbolToClients.get(data.symbol)?.has(client.id)) {
//           client.emit('marketData', data);
//         }
//       });
      
//       // Log the data for debugging
//       console.log("Response:", data);
//     });
    
//   }

//   handleConnection(client: Socket) {
//     this.logger.log(`Client connected: ${client.id}`);
//     this.clients.set(client.id, client);
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`Client disconnected: ${client.id}`);
//     this.clients.delete(client.id);
//   }

//   @SubscribeMessage('subscribe')
//   handleSubscribe(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: SubscriptionDto
//   ) {
//     const symbol = data.symbol;
//     this.logger.log(`Client ${client.id} subscribing to ${symbol}`);
    
//     // Forward subscription to Python bridge
//     this.pythonClient.emit('subscribe', { symbol });
    
//     // Send current data if available
//     const currentData = this.marketDataService.getMarketData(symbol);
//     if (currentData) {
//       client.emit('marketData', { symbol, data: currentData });
//     }
    
//     return { success: true, symbol };
//   }

//   @SubscribeMessage('unsubscribe')
//   handleUnsubscribe(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() data: SubscriptionDto
//   ) {
//     const symbol = data.symbol;
//     this.logger.log(`Client ${client.id} unsubscribing from ${symbol}`);
    
//     // Forward unsubscription to Python bridge
//     this.pythonClient.emit('unsubscribe', { symbol });
    
//     return { success: true, symbol };
//   }
// }


import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data.service';
import { SubscriptionDto } from '../dto/market-data.dto';
import { io } from 'socket.io-client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MarketDataGateway {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(MarketDataGateway.name);
  private clients = new Map<string, Socket>();
  private pythonClient: any;
  private symbolToClients = new Map<string, Set<string>>();
  
  constructor(private readonly marketDataService: MarketDataService) {
    // Connect to the Python bridge
    this.pythonClient = io('http://localhost:5001');
    
    this.pythonClient.on('connect', () => {
      this.logger.log('Connected to Python bridge');
    });
    
    this.pythonClient.on('disconnect', () => {
      this.logger.log('Disconnected from Python bridge');
    });
    
    this.pythonClient.on('marketData', (data) => {
      // Log the raw data received from Python bridge
      this.logger.log(`Market data received from Python: ${JSON.stringify(data)}`);
      
      // Store the data in the service
      if (data && data.symbol) {
        this.marketDataService.updateMarketData(data.symbol, data);
        
        // Forward to all connected clients
        this.clients.forEach(client => {
          client.emit('marketData', data);
        });
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clients.set(client.id, client);
    
    // Initialize empty set for this client's subscriptions
    this.symbolToClients.set(client.id, new Set<string>());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up subscriptions
    this.symbolToClients.delete(client.id);
    this.clients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscriptionDto
  ) {
    const symbol = data.symbol;
    this.logger.log(`Client ${client.id} subscribing to ${symbol}`);
    
    // Add to client's subscriptions
    const clientSymbols = this.symbolToClients.get(client.id);
    if (clientSymbols) {
      clientSymbols.add(symbol);
    } else {
      this.symbolToClients.set(client.id, new Set([symbol]));
    }
    
    // Forward subscription to Python bridge
    this.pythonClient.emit('subscribe', { symbols: [symbol] });
    
    // Send current data if available
    const currentData = this.marketDataService.getMarketData(symbol);
    if (currentData) {
      client.emit('marketData', currentData);
    }
    
    return { success: true, symbol };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscriptionDto
  ) {
    const symbol = data.symbol;
    this.logger.log(`Client ${client.id} unsubscribing from ${symbol}`);
    
    // Remove from client's subscriptions
    const clientSymbols = this.symbolToClients.get(client.id);
    if (clientSymbols) {
      clientSymbols.delete(symbol);
    }
    
    // Forward unsubscription to Python bridge
    this.pythonClient.emit('unsubscribe', { symbols: [symbol] });
    
    return { success: true, symbol };
  }
}
