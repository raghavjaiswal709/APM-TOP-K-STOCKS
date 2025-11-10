import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as csvParser from 'csv-parser';

interface CompanyMasterData {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
}

@Injectable()
export class CompanyMasterService implements OnModuleInit {
  private readonly logger = new Logger(CompanyMasterService.name);
  private companyMasterMap = new Map<string, CompanyMasterData>();
  private readonly csvPath = path.join(__dirname, '../../data/company_master.csv');

  async onModuleInit() {
    await this.loadCompanyMaster();
  }

  private async loadCompanyMaster(): Promise<void> {
    return new Promise((resolve, reject) => {
      const results: CompanyMasterData[] = [];

      this.logger.log(`Loading company master data from: ${this.csvPath}`);

      if (!fs.existsSync(this.csvPath)) {
        this.logger.error(`CSV file not found at: ${this.csvPath}`);
        resolve(); // Don't fail the app startup
        return;
      }

      fs.createReadStream(this.csvPath)
        .pipe(csvParser())
        .on('data', (data) => {
          try {
            const companyCode = String(data.company_code || data.COMPANY_CODE || '').trim().toUpperCase();
            const name = String(data['NAME OF COMPANY'] || data.name || data.NAME || '').trim();
            const exchange = String(data.Exchange || data.exchange || data.EXCHANGE || 'NSE').trim().toUpperCase();
            const marker = String(data.Marker || data.marker || data.MARKER || 'EQ').trim().toUpperCase();

            if (companyCode && name) {
              results.push({
                company_code: companyCode,
                name,
                exchange,
                marker
              });
            }
          } catch (error) {
            this.logger.warn(`Error parsing row: ${JSON.stringify(data)}`, error);
          }
        })
        .on('end', () => {
          // Build the map with company_code as key
          results.forEach(company => {
            // Create composite key with exchange for uniqueness
            const key = `${company.exchange}:${company.company_code}`;
            this.companyMasterMap.set(key, company);
            // Also add without exchange for fallback
            if (!this.companyMasterMap.has(company.company_code)) {
              this.companyMasterMap.set(company.company_code, company);
            }
          });

          this.logger.log(`✅ Loaded ${this.companyMasterMap.size} companies from CSV`);
          resolve();
        })
        .on('error', (error) => {
          this.logger.error('Error reading CSV file:', error);
          reject(error);
        });
    });
  }

  /**
   * Get marker for a company by code and exchange
   */
  getMarker(companyCode: string, exchange?: string): string | undefined {
    if (!companyCode) return undefined;

    const code = companyCode.trim().toUpperCase();
    const ex = exchange?.trim().toUpperCase();

    // Try with exchange first
    if (ex) {
      const key = `${ex}:${code}`;
      const company = this.companyMasterMap.get(key);
      if (company?.marker) {
        return company.marker;
      }
    }

    // Fallback to company code only
    const company = this.companyMasterMap.get(code);
    return company?.marker;
  }

  /**
   * Get full company data by code and exchange
   */
  getCompanyData(companyCode: string, exchange?: string): CompanyMasterData | undefined {
    if (!companyCode) return undefined;

    const code = companyCode.trim().toUpperCase();
    const ex = exchange?.trim().toUpperCase();

    // Try with exchange first
    if (ex) {
      const key = `${ex}:${code}`;
      const company = this.companyMasterMap.get(key);
      if (company) return company;
    }

    // Fallback to company code only
    return this.companyMasterMap.get(code);
  }

  /**
   * Reload company master data (useful for updates)
   */
  async reload(): Promise<void> {
    this.companyMasterMap.clear();
    await this.loadCompanyMaster();
  }
}
