// src/admin/admin.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { Observable, Subject } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

export interface ValidationLogEntry {
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'complete';
  message: string;
  timestamp: string;
  exitCode?: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  
  // Path to the Python script - works in both Docker and local environments
  private readonly PYTHON_SCRIPT_PATH = '/app/data/company_validate.py';
  // Fallback for local development (outside Docker)
  private readonly PYTHON_SCRIPT_PATH_LOCAL = `${process.cwd()}/data/company_validate.py`;

  // Track running process
  private runningProcess: ChildProcess | null = null;

  /**
   * Execute the company validation Python script and stream output via SSE
   * @returns Observable that emits log entries as the script runs
   */
  runCompanyValidation(): Observable<ValidationLogEntry> {
    const subject = new Subject<ValidationLogEntry>();

    // Check if a process is already running
    if (this.runningProcess) {
      subject.next({
        type: 'error',
        message: 'A validation process is already running. Please wait for it to complete.',
        timestamp: new Date().toISOString(),
      });
      subject.complete();
      return subject.asObservable();
    }

    // Determine the correct script path (Docker or local)
    let scriptPath = this.PYTHON_SCRIPT_PATH;
    if (!fs.existsSync(scriptPath)) {
      scriptPath = this.PYTHON_SCRIPT_PATH_LOCAL;
    }

    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      subject.next({
        type: 'error',
        message: `Script not found at: ${scriptPath}`,
        timestamp: new Date().toISOString(),
      });
      subject.complete();
      return subject.asObservable();
    }

    this.logger.log(`Starting validation script: ${scriptPath}`);

    // Emit start message
    subject.next({
      type: 'info',
      message: `Starting NSE Stock Series Validation...`,
      timestamp: new Date().toISOString(),
    });

    subject.next({
      type: 'info',
      message: `Script path: ${scriptPath}`,
      timestamp: new Date().toISOString(),
    });

    // Spawn the Python process
    // Use python3 (works in Docker and most systems)
    const pythonCmd = 'python3';
    this.runningProcess = spawn(pythonCmd, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1', // Ensure real-time output
      },
    });

    const process_ref = this.runningProcess;

    // Handle stdout (real-time line by line)
    process_ref.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      lines.forEach((line) => {
        subject.next({
          type: 'stdout',
          message: line,
          timestamp: new Date().toISOString(),
        });
      });
    });

    // Handle stderr (real-time line by line)
    process_ref.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      lines.forEach((line) => {
        subject.next({
          type: 'stderr',
          message: line,
          timestamp: new Date().toISOString(),
        });
      });
    });

    // Handle process completion
    process_ref.on('close', (code) => {
      this.logger.log(`Validation script exited with code: ${code}`);
      
      subject.next({
        type: 'complete',
        message: code === 0 
          ? '✓ Validation completed successfully!' 
          : `✗ Validation failed with exit code: ${code}`,
        timestamp: new Date().toISOString(),
        exitCode: code ?? undefined,
      });

      this.runningProcess = null;
      
      // Keep the stream open for a short period to ensure all data is received
      // Then complete the stream
      setTimeout(() => {
        subject.complete();
      }, 500);
    });

    // Handle process errors
    process_ref.on('error', (error) => {
      this.logger.error(`Validation script error: ${error.message}`);
      
      subject.next({
        type: 'error',
        message: `Process error: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      this.runningProcess = null;
      
      // Keep the stream open for a short period before completing
      setTimeout(() => {
        subject.complete();
      }, 500);
    });

    return subject.asObservable();
  }

  /**
   * Check if a validation process is currently running
   */
  isValidationRunning(): boolean {
    return this.runningProcess !== null;
  }

  /**
   * Attempt to stop the running validation process
   */
  stopValidation(): { success: boolean; message: string } {
    if (!this.runningProcess) {
      return {
        success: false,
        message: 'No validation process is currently running.',
      };
    }

    try {
      this.runningProcess.kill('SIGTERM');
      this.runningProcess = null;
      return {
        success: true,
        message: 'Validation process has been terminated.',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop process: ${error.message}`,
      };
    }
  }
}
