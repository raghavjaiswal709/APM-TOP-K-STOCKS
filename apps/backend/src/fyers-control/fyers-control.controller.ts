import { Controller, Get, Post, Delete, Body, Param, Sse, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FyersControlService } from './fyers-control.service';

@Controller('api/fyers-control')
export class FyersControlController {
  constructor(private readonly svc: FyersControlService) {}

  @Get('users')
  async getUsers() {
    const users = await this.svc.getUserList();
    return { users };
  }

  @Post('users/refresh')
  async refreshUsers() {
    return this.svc.refreshUsers();
  }

  @Post('validate-pin')
  validatePin(@Body() body: { userId: string; pin: string }) {
    if (!body.userId || !body.pin) {
      throw new HttpException('userId and pin are required', HttpStatus.BAD_REQUEST);
    }
    const result = this.svc.validatePin(body.userId, body.pin);
    if (!result.ok) {
      throw new HttpException(
        result.locked
          ? { error: 'Too many failed attempts. Try again in 5 minutes.', locked: true }
          : { error: 'Invalid PIN', attemptsLeft: result.attemptsLeft },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { ok: true };
  }

  @Get('auth-state/:userId')
  getAuthState(@Param('userId') userId: string) {
    return this.svc.getAuthState(userId);
  }

  @Post('reset-auth/:userId')
  resetAuth(@Param('userId') userId: string) {
    this.svc.resetAuth(userId);
    return { ok: true };
  }

  @Post('auth-url')
  async getAuthUrl(@Body() body: { userId: string }) {
    if (!body.userId) throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    try {
      return await this.svc.getAuthUrl(body.userId);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('token')
  async exchangeToken(@Body() body: { userId: string; authCode: string }) {
    if (!body.userId || !body.authCode) {
      throw new HttpException('userId and authCode are required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.svc.exchangeToken(body.userId, body.authCode);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('start')
  async startService(@Body() body: { service: 1 | 2; option?: string }) {
    if (!body.service) throw new HttpException('service is required', HttpStatus.BAD_REQUEST);
    try {
      return await this.svc.startService(body.service, body.option);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('stop')
  async stopServices(@Body() body: { service: 1 | 2 | 3 }) {
    if (!body.service) throw new HttpException('service is required', HttpStatus.BAD_REQUEST);
    try {
      return await this.svc.stopServices(body.service);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('health')
  async getHealth() {
    try {
      return await this.svc.getHealth();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('logs')
  getLogs() {
    return { logs: this.svc.getLogs() };
  }

  @Delete('logs')
  clearLogs() {
    this.svc.clearLogs();
    return { ok: true };
  }

  @Sse('logs/stream')
  streamLogs(): Observable<MessageEvent> {
    return new Observable(subscriber => {
      // Send existing logs first
      for (const entry of this.svc.getLogs()) {
        subscriber.next({ data: JSON.stringify(entry) } as MessageEvent);
      }

      const unsub = this.svc.subscribeToLogs(entry => {
        subscriber.next({ data: JSON.stringify(entry) } as MessageEvent);
      });

      return () => unsub();
    });
  }
}
