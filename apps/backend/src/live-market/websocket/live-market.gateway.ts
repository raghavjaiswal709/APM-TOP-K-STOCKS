import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LiveMarketService } from '../live-market.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/live-market',
})
export class LiveMarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(LiveMarketGateway.name);
  private clients = new Map<string, Socket>();

  constructor(private readonly liveMarketService: LiveMarketService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Live market client connected: ${client.id}`);
    this.clients.set(client.id, client);
    
    // Send initial data
    this.sendAvailableCompanies(client);
    this.sendMarketStatus(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Live market client disconnected: ${client.id}`);
    this.clients.delete(client.id);
  }

  @SubscribeMessage('subscribe-companies')
  handleSubscribeCompanies(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyCodes: string[] }
  ) {
    this.logger.log(`Client ${client.id} subscribing to companies: ${data.companyCodes}`);
    
    // Forward to Python service via WebSocket or HTTP
    // This is a bridge between NestJS and your Python service
    
    return {
      success: true,
      message: `Subscription request forwarded for ${data.companyCodes.length} companies`,
      companyCodes: data.companyCodes
    };
  }

  @SubscribeMessage('unsubscribe-all')
  handleUnsubscribeAll(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from all companies`);
    
    return {
      success: true,
      message: 'Unsubscribed from all companies'
    };
  }

  @SubscribeMessage('get-market-status')
  handleGetMarketStatus(@ConnectedSocket() client: Socket) {
    const status = this.liveMarketService.getMarketStatus();
    client.emit('market-status', status);
    return status;
  }

  private async sendAvailableCompanies(client: Socket) {
    try {
      const companies = await this.liveMarketService.getAvailableCompanies();
      client.emit('available-companies', companies);
    } catch (error) {
      this.logger.error(`Error sending available companies: ${error.message}`);
    }
  }

  private sendMarketStatus(client: Socket) {
    const status = this.liveMarketService.getMarketStatus();
    client.emit('market-status', status);
  }

  // Method to broadcast market data to all connected clients
  broadcastMarketData(data: any) {
    this.server.emit('market-data', data);
  }

  // Method to send data to specific clients
  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      client.emit(event, data);
    }
  }
}
