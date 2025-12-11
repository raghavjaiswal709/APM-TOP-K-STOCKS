// src/admin/admin.controller.ts
import { Controller, Get, Post, Sse, Logger } from '@nestjs/common';
import { Observable, map, catchError, of } from 'rxjs';
import { AdminService, ValidationLogEntry } from './admin.service';

@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

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
  runValidation(): Observable<MessageEvent> {
    this.logger.log('Starting company validation SSE stream');

    return this.adminService.runCompanyValidation().pipe(
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
}
