import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PortfolioService {
    private readonly logger = new Logger(PortfolioService.name);
    // Use __dirname so the data path is always relative to THIS compiled file
    // (dist/portfolio/portfolio.service.js → ../../data = apps/backend/data/)
    // This is robust regardless of the working directory NestJS is launched from.
    private readonly dataDir = path.join(__dirname, '..', '..', 'data');
    private readonly portfolioFile = path.join(this.dataDir, 'portfolio.json');
    private readonly tradesFile = path.join(this.dataDir, 'portfolio_trades.json');

    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    getPortfolioState(): { portfolio: any | null; trades: any[] } {
        try {
            const portfolio = fs.existsSync(this.portfolioFile)
                ? JSON.parse(fs.readFileSync(this.portfolioFile, 'utf8'))
                : null;
            const trades = fs.existsSync(this.tradesFile)
                ? JSON.parse(fs.readFileSync(this.tradesFile, 'utf8'))
                : [];
            return { portfolio, trades };
        } catch (err) {
            this.logger.error('Failed to read portfolio data from disk:', err);
            return { portfolio: null, trades: [] };
        }
    }

    savePortfolioState(portfolio: any, trades: any[]): void {
        this.ensureDataDir();
        try {
            fs.writeFileSync(this.portfolioFile, JSON.stringify(portfolio, null, 2), 'utf8');
            fs.writeFileSync(this.tradesFile, JSON.stringify(trades, null, 2), 'utf8');
            this.logger.debug(`Portfolio saved: ${trades.length} trades`);
        } catch (err) {
            this.logger.error('Failed to write portfolio data to disk:', err);
            throw err;
        }
    }
}
