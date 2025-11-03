import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { PredictionService } from '../prediction.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/predictions',
  transports: ['websocket', 'polling'],
})
export class PredictionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PredictionGateway.name);
  private predictionPollers: Map<string, NodeJS.Timeout> = new Map();
  private clientSubscriptions: Map<string, Set<string>> = new Map();

  constructor(private predictionService: PredictionService) {}

  afterInit(server: Server) {
    this.logger.log('Prediction WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Prediction client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Prediction client disconnected: ${client.id}`);

    // Clear all pollers for this client
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.forEach((company) => {
        const pollerId = `poller_${client.id}_${company}`;
        if (this.predictionPollers.has(pollerId)) {
          clearInterval(this.predictionPollers.get(pollerId));
          this.predictionPollers.delete(pollerId);
        }
      });
      this.clientSubscriptions.delete(client.id);
    }
  }

  /**
   * Subscribe to real-time predictions for a company
   */
  @SubscribeMessage('subscribe_predictions')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { company: string; interval?: number; exchange?: string }
  ) {
    const { company, interval = 300000, exchange = 'NSE' } = data; // Default 5 minutes

    this.logger.log(`Client ${client.id} subscribed to ${company}`);

    // Track subscription
    const subscriptions = this.clientSubscriptions.get(client.id) || new Set();
    subscriptions.add(company);
    this.clientSubscriptions.set(client.id, subscriptions);

    // Send initial data
    try {
      const predictions = await this.predictionService.getCompanyPredictions(company, {
        exchange,
      });

      client.emit('predictions_update', {
        company,
        exchange,
        data: predictions,
        timestamp: new Date(),
        isInitial: true,
      });
    } catch (error) {
      client.emit('error', { message: error.message, company });
    }

    // Start polling
    const pollerId = `poller_${client.id}_${company}`;
    if (this.predictionPollers.has(pollerId)) {
      clearInterval(this.predictionPollers.get(pollerId));
    }

    const poller = setInterval(async () => {
      try {
        const predictions = await this.predictionService.getCompanyPredictions(company, {
          exchange,
        });

        client.emit('predictions_update', {
          company,
          exchange,
          data: predictions,
          timestamp: new Date(),
          isInitial: false,
        });
      } catch (error) {
        client.emit('error', { message: error.message, company });
      }
    }, interval);

    this.predictionPollers.set(pollerId, poller);

    return { success: true, company, exchange, pollInterval: interval };
  }

  /**
   * Unsubscribe from predictions
   */
  @SubscribeMessage('unsubscribe_predictions')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { company: string }
  ) {
    const { company } = data;
    const pollerId = `poller_${client.id}_${company}`;

    if (this.predictionPollers.has(pollerId)) {
      clearInterval(this.predictionPollers.get(pollerId));
      this.predictionPollers.delete(pollerId);
    }

    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.delete(company);
    }

    this.logger.log(`Client ${client.id} unsubscribed from ${company}`);
    return { success: true, company };
  }

  /**
   * Request single update
   */
  @SubscribeMessage('request_update')
  async handleUpdateRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { company: string; exchange?: string }
  ) {
    const { company, exchange = 'NSE' } = data;

    try {
      const predictions = await this.predictionService.getCompanyPredictions(company, {
        exchange,
      });

      client.emit('predictions_update', {
        company,
        exchange,
        data: predictions,
        timestamp: new Date(),
        isManual: true,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get health status
   */
  @SubscribeMessage('health_status')
  async handleHealthStatus(@ConnectedSocket() client: Socket) {
    try {
      const health = await this.predictionService.checkHealth();
      client.emit('health_status', health);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast health status to all connected clients
   */
  broadcastHealthStatus(status: any): void {
    this.server.emit('health_status_broadcast', status);
  }

  /**
   * Broadcast prediction update to all interested clients
   */
  broadcastPredictionUpdate(company: string, data: any): void {
    this.server.emit('predictions_broadcast', {
      company,
      data,
      timestamp: new Date(),
    });
  }
}
