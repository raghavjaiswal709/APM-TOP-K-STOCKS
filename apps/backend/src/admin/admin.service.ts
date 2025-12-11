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
  
  // Path to the Python script - use absolute path for reliability
  private readonly PYTHON_SCRIPT_PATH = '/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS/apps/backend/data/company_validate.py';

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

    // Verify script exists
    if (!fs.existsSync(this.PYTHON_SCRIPT_PATH)) {
      subject.next({
        type: 'error',
        message: `Script not found at: ${this.PYTHON_SCRIPT_PATH}`,
        timestamp: new Date().toISOString(),
      });
      subject.complete();
      return subject.asObservable();
    }

    this.logger.log(`Starting validation script: ${this.PYTHON_SCRIPT_PATH}`);

    // Emit start message
    subject.next({
      type: 'info',
      message: `Starting NSE Stock Series Validation...`,
      timestamp: new Date().toISOString(),
    });

    subject.next({
      type: 'info',
      message: `Script path: ${this.PYTHON_SCRIPT_PATH}`,
      timestamp: new Date().toISOString(),
    });

    // Spawn the Python process
    // Use the virtual environment's Python for proper package access
    const venvPythonPath = '/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS/.venv/bin/python';
    this.runningProcess = spawn(venvPythonPath, [this.PYTHON_SCRIPT_PATH], {
      cwd: path.dirname(this.PYTHON_SCRIPT_PATH),
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
      subject.complete();
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
      subject.complete();
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
