// src/admin/admin.controller.ts
import { Controller, Get, Post, Delete, Sse, Logger, Body, Query, Param } from '@nestjs/common';
import { Observable, map, catchError, of } from 'rxjs';
import { AdminService, ValidationLogEntry } from './admin.service';

@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) { }

  /**
   * Health check endpoint for admin module
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      module: 'admin',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if a validation is currently running
   */
  @Get('validate/status')
  getValidationStatus() {
    return {
      isRunning: this.adminService.isValidationRunning(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * SSE endpoint to run company validation and stream output
   * Use GET for SSE compatibility
   */
  @Sse('validate/run')
  runValidation(@Query('failedOnly') failedOnly?: string): Observable<MessageEvent> {
    this.logger.log(`Starting company validation SSE stream (failedOnly=${failedOnly})`);

    const isFailedOnly = failedOnly === 'true';

    return this.adminService.runCompanyValidation({ failedOnly: isFailedOnly }).pipe(
      map((logEntry: ValidationLogEntry) => {
        return {
          data: JSON.stringify(logEntry),
        } as MessageEvent;
      }),
      catchError((error) => {
        this.logger.error(`SSE stream error: ${error.message}`);
        return of({
          data: JSON.stringify({
            type: 'error',
            message: `Stream error: ${error.message}`,
            timestamp: new Date().toISOString(),
          }),
        } as MessageEvent);
      }),
    );
  }

  /**
   * Stop a running validation process
   */
  @Post('validate/stop')
  stopValidation() {
    this.logger.log('Stopping company validation');
    return this.adminService.stopValidation();
  }

  /**
   * Get list of failed subscriptions
   */
  @Get('failed-subscriptions')
  async getFailedSubscriptions() {
    const failed = await this.adminService.getFailedSubscriptions();
    return {
      success: true,
      data: failed,
      count: failed.length
    };
  }

  /**
   * Report failed subscriptions
   */
  @Post('failed-subscriptions')
  async reportFailedSubscriptions(@Body() body: { symbols: string[] }) {
    if (!body.symbols || !Array.isArray(body.symbols)) {
      return { success: false, message: 'Invalid payload' };
    }

    const updated = await this.adminService.saveFailedSubscriptions(body.symbols);
    return {
      success: true,
      message: 'Failed subscriptions saved',
      count: updated.length
    };
  }

  /**
   * Fix a subscription
   */
  @Post('fix-subscription')
  async fixSubscription(@Body() body: {
    oldSymbol: string,
    companyCode: string,
    exchange: string,
    marker: string
  }) {
    if (!body.oldSymbol || !body.companyCode) {
      return { success: false, message: 'Missing required fields' };
    }

    return this.adminService.fixSubscription(body.oldSymbol, {
      companyCode: body.companyCode,
      exchange: body.exchange || 'NSE',
      marker: body.marker || 'EQ'
    });
  }

  /**
   * Clear all failed subscriptions
   */
  @Delete('failed-subscriptions')
  async clearFailedSubscriptions() {
    await this.adminService.clearFailedSubscriptions();
    return {
      success: true,
      message: 'Failed subscriptions cleared'
    };
  }

  /**
   * Get list of successfully subscribed companies
   */
  @Get('subscribed-companies')
  async getSubscribedCompanies() {
    const subscribed = await this.adminService.getSubscribedCompanies();
    return {
      success: true,
      data: subscribed,
      count: subscribed.length
    };
  }

  /**
   * Report successfully subscribed companies
   */
  @Post('subscribed-companies')
  async reportSubscribedCompanies(@Body() body: { symbols: string[] }) {
    if (!body.symbols || !Array.isArray(body.symbols)) {
      return { success: false, message: 'Invalid payload' };
    }

    await this.adminService.saveSubscribedCompanies(body.symbols);
    return {
      success: true,
      message: 'Subscribed companies saved',
      count: body.symbols.length
    };
  }

  /**
   * Clear all subscribed companies
   */
  @Delete('subscribed-companies')
  async clearSubscribedCompanies() {
    await this.adminService.clearSubscribedCompanies();
    return {
      success: true,
      message: 'Subscribed companies cleared'
    };
  }

  /**
   * Clear all stopped companies and failed subscriptions
   */
  @Delete('stopped-companies')
  async clearStoppedCompanies() {
    await this.adminService.clearStoppedCompanies();
    return {
      success: true,
      message: 'Stopped companies cleared'
    };
  }

  /**
   * Clear all permanently stopped companies
   */
  @Delete('permanently-stopped')
  async clearPermanentlyStopped() {
    await this.adminService.clearPermanentlyStopped();
    return {
      success: true,
      message: 'Permanently stopped list cleared'
    };
  }


  /**
   * Get list of stopped companies (daily reset)
   */
  @Get('stopped-companies')
  async getStoppedCompanies() {
    const stopped = await this.adminService.getStoppedCompanies();
    return {
      success: true,
      data: stopped,
      count: stopped.length
    };
  }

  /**
   * Get list of permanently stopped companies (never reset)
   */
  @Get('permanently-stopped')
  async getPermanentlyStopped() {
    const permanentlyStopped = await this.adminService.getPermanentlyStopped();
    return {
      success: true,
      data: permanentlyStopped,
      count: permanentlyStopped.length
    };
  }

  /**
   * Add symbols to permanently stopped list
   */
  @Post('permanently-stopped')
  async addToPermanentlyStopped(@Body() body: { symbols: string[] }) {
    if (!body.symbols || !Array.isArray(body.symbols)) {
      return { success: false, message: 'Invalid payload' };
    }

    const updated = await this.adminService.addToPermanentlyStopped(body.symbols);
    return {
      success: true,
      message: 'Symbols added to permanently stopped',
      count: updated.length
    };
  }

  /**
   * Remove a symbol from permanently stopped list
   */
  @Delete('permanently-stopped/:symbol')
  async removeFromPermanentlyStopped(@Param('symbol') symbol: string) {
    if (!symbol) {
      return { success: false, message: 'Symbol required' };
    }

    // URL decode the symbol (e.g., NSE%3AACLGATI-EQ -> NSE:ACLGATI-EQ)
    const decodedSymbol = decodeURIComponent(symbol);

    const updated = await this.adminService.removeFromPermanentlyStopped(decodedSymbol);
    return {
      success: true,
      message: 'Symbol removed from permanently stopped',
      remaining: updated.length
    };
  }

  /**
   * Get all subscription statuses in one call
   */
  @Get('subscription-status')
  async getAllSubscriptionStatuses() {
    const statuses = await this.adminService.getAllSubscriptionStatuses();
    return {
      success: true,
      data: statuses,
      counts: {
        subscribed: statuses.subscribed.length,
        failed: statuses.failed.length,
        stopped: statuses.stopped.length,
        permanentlyStopped: statuses.permanentlyStopped.length
      }
    };
  }
}
