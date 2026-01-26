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

  runCompanyValidation(options: { failedOnly?: boolean } = {}): Observable<ValidationLogEntry> {
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
      message: `Starting NSE Stock Series Validation...${options.failedOnly ? ' (Failed Subscriptions Only)' : ''}`,
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

    // Construct arguments
    const args = [scriptPath];
    if (options.failedOnly) {
      args.push('--failed-only');
      args.push('--update-master');
    }

    this.logger.log(`Spawn arguments: ${args.join(' ')}`);

    this.runningProcess = spawn(pythonCmd, args, {
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

  // Path to data directory
  private readonly DATA_DIR = '/app/data';
  private readonly DATA_DIR_LOCAL = `${process.cwd()}/data`;

  private getDataDir(): string {
    return fs.existsSync(this.DATA_DIR) ? this.DATA_DIR : this.DATA_DIR_LOCAL;
  }

  private getFailedSubscriptionsPath(): string {
    return path.join(this.getDataDir(), 'failed_subscriptions.json');
  }

  private getSubscribedCompaniesPath(): string {
    return path.join(this.getDataDir(), 'subscribed_companies.json');
  }

  private getStoppedCompaniesPath(): string {
    return path.join(this.getDataDir(), 'stopped_companies.json');
  }

  private getPermanentlyStoppedPath(): string {
    return path.join(this.getDataDir(), 'permanently_stopped.json');
  }

  private getCompanyMasterPath(): string {
    return path.join(this.getDataDir(), 'company_master.csv');
  }

  /**
   * Get list of failed subscriptions
   */
  async getFailedSubscriptions(): Promise<string[]> {
    const filePath = this.getFailedSubscriptionsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Error reading failed subscriptions: ${error.message}`);
      return [];
    }
  }

  /**
   * Save failed subscriptions (merge with existing)
   */
  async saveFailedSubscriptions(newFailed: string[]): Promise<string[]> {
    const filePath = this.getFailedSubscriptionsPath();
    let existing: string[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        existing = JSON.parse(content);
      } catch (error) {
        this.logger.error(`Error reading existing failed subscriptions: ${error.message}`);
      }
    }

    // Merge and deduplicate
    const merged = [...new Set([...existing, ...newFailed])];

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(merged, null, 2));
      return merged;
    } catch (error) {
      this.logger.error(`Error writing failed subscriptions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a symbol from failed subscriptions list
   */
  async removeFailedSubscription(symbol: string): Promise<string[]> {
    const filePath = this.getFailedSubscriptionsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      let existing: string[] = JSON.parse(content);

      existing = existing.filter(s => s !== symbol);

      await fs.promises.writeFile(filePath, JSON.stringify(existing, null, 2));
      return existing;
    } catch (error) {
      this.logger.error(`Error updating failed subscriptions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear all failed subscriptions
   */
  async clearFailedSubscriptions(): Promise<void> {
    const filePath = this.getFailedSubscriptionsPath();
    try {
      await fs.promises.writeFile(filePath, JSON.stringify([], null, 2));
      this.logger.log('Cleared all failed subscriptions');
    } catch (error) {
      this.logger.error(`Error clearing failed subscriptions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of successfully subscribed companies
   */
  async getSubscribedCompanies(): Promise<string[]> {
    const filePath = this.getSubscribedCompaniesPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Error reading subscribed companies: ${error.message}`);
      return [];
    }
  }

  /**
   * Save successfully subscribed companies
   */
  async saveSubscribedCompanies(symbols: string[]): Promise<void> {
    const filePath = this.getSubscribedCompaniesPath();
    try {
      // Get existing subscribed companies
      let existing: string[] = [];
      if (fs.existsSync(filePath)) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        existing = JSON.parse(content);
      }

      // Add new symbols (avoid duplicates)
      const updated = [...new Set([...existing, ...symbols])];
      await fs.promises.writeFile(filePath, JSON.stringify(updated, null, 2));
      this.logger.log(`Saved ${symbols.length} subscribed companies (total: ${updated.length})`);
    } catch (error) {
      this.logger.error(`Error saving subscribed companies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear all subscribed companies
   */
  async clearSubscribedCompanies(): Promise<void> {
    const filePath = this.getSubscribedCompaniesPath();
    try {
      await fs.promises.writeFile(filePath, JSON.stringify([], null, 2));
      this.logger.log('Cleared all subscribed companies');
    } catch (error) {
      this.logger.error(`Error clearing subscribed companies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of stopped companies (daily reset)
   */
  async getStoppedCompanies(): Promise<string[]> {
    const filePath = this.getStoppedCompaniesPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Error reading stopped companies: ${error.message}`);
      return [];
    }
  }

  /**
   * Get list of permanently stopped companies (never reset)
   */
  async getPermanentlyStopped(): Promise<string[]> {
    const filePath = this.getPermanentlyStoppedPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Error reading permanently stopped companies: ${error.message}`);
      return [];
    }
  }

  /**
   * Add symbols to permanently stopped list
   */
  async addToPermanentlyStopped(symbols: string[]): Promise<string[]> {
    const filePath = this.getPermanentlyStoppedPath();
    let existing: string[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        existing = JSON.parse(content);
      } catch (error) {
        this.logger.error(`Error reading permanently stopped: ${error.message}`);
      }
    }

    // Merge and deduplicate
    const merged = [...new Set([...existing, ...symbols])];

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(merged, null, 2));
      this.logger.log(`Added ${symbols.length} to permanently stopped (total: ${merged.length})`);
      return merged;
    } catch (error) {
      this.logger.error(`Error writing permanently stopped: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove symbol from permanently stopped list
   */
  async removeFromPermanentlyStopped(symbol: string): Promise<string[]> {
    const filePath = this.getPermanentlyStoppedPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      let existing: string[] = JSON.parse(content);

      existing = existing.filter(s => s !== symbol);

      await fs.promises.writeFile(filePath, JSON.stringify(existing, null, 2));
      this.logger.log(`Removed ${symbol} from permanently stopped`);
      return existing;
    } catch (error) {
      this.logger.error(`Error updating permanently stopped: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all subscription statuses in one call
   */
  async getAllSubscriptionStatuses(): Promise<{
    subscribed: string[];
    failed: string[];
    stopped: string[];
    permanentlyStopped: string[];
  }> {
    const [subscribed, failed, stopped, permanentlyStopped] = await Promise.all([
      this.getSubscribedCompanies(),
      this.getFailedSubscriptions(),
      this.getStoppedCompanies(),
      this.getPermanentlyStopped()
    ]);

    return { subscribed, failed, stopped, permanentlyStopped };
  }

  /**
   * Fix a subscription by updating company_master.csv and removing from failed list
   */
  async fixSubscription(oldSymbol: string, correctData: {
    companyCode: string,
    exchange: string,
    marker: string
  }): Promise<{ success: boolean; message: string }> {
    const csvPath = this.getCompanyMasterPath();

    if (!fs.existsSync(csvPath)) {
      return { success: false, message: 'Company master CSV not found' };
    }

    try {
      // 1. Read CSV
      const content = await fs.promises.readFile(csvPath, 'utf-8');
      const lines = content.split('\n');
      const header = lines[0];

      // Parse header to find column indices
      const headers = header.split(',').map(h => h.trim());
      const codeIdx = headers.indexOf('company_code');
      const exchangeIdx = headers.indexOf('Exchange');
      const markerIdx = headers.indexOf('Marker');

      if (codeIdx === -1 || exchangeIdx === -1 || markerIdx === -1) {
        return { success: false, message: 'Invalid CSV format: Missing required columns' };
      }

      // 2. Find and update the line
      let updated = false;
      const newLines = lines.map(line => {
        if (!line.trim()) return line;

        const cols = line.split(','); // Assuming simple CSV without quoted commas for now

        // Check if this line matches the problematic symbol
        // The oldSymbol might be in format "EXCHANGE:CODE-MARKER" or just "CODE"
        // We'll check the company_code column
        if (cols[codeIdx] && oldSymbol.includes(cols[codeIdx])) {
          // Found it! Update values
          cols[codeIdx] = correctData.companyCode;
          cols[exchangeIdx] = correctData.exchange;
          cols[markerIdx] = correctData.marker;
          updated = true;
          return cols.join(',');
        }

        // Also check exact match with the invalid symbol if it was stored as just code
        if (cols[codeIdx] === oldSymbol) {
          cols[codeIdx] = correctData.companyCode;
          cols[exchangeIdx] = correctData.exchange;
          cols[markerIdx] = correctData.marker;
          updated = true;
          return cols.join(',');
        }

        return line;
      });

      if (!updated) {
        return { success: false, message: 'Symbol not found in master CSV' };
      }

      // 3. Write back to CSV
      await fs.promises.writeFile(csvPath, newLines.join('\n'));

      // 4. Remove from failed list
      await this.removeFailedSubscription(oldSymbol);

      return { success: true, message: 'Successfully updated master sheet' };

    } catch (error) {
      this.logger.error(`Error fixing subscription: ${error.message}`);
      return { success: false, message: `Failed to update CSV: ${error.message}` };
    }
  }
}
