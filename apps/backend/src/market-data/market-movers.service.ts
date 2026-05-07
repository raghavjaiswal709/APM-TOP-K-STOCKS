import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

type TileColor = 'blue' | 'green' | 'yellow' | 'red' | 'grey';

@Injectable()
export class MarketMoversService {
  private readonly logger = new Logger(MarketMoversService.name);
  // dist/market-data/market-movers.service.js → ../../data = apps/backend/data/
  private readonly dataDir = path.join(__dirname, '..', '..', 'data');
  private readonly colorsFile = path.join(this.dataDir, 'market_movers_locked_colors.json');

  getLockedColors(): Record<string, TileColor> {
    try {
      if (!fs.existsSync(this.colorsFile)) return {};
      const raw = fs.readFileSync(this.colorsFile, 'utf8');
      const parsed = JSON.parse(raw) as { date?: string; colors?: Record<string, TileColor> };
      // Only return colors saved today (IST date)
      const todayIST = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
      if (parsed.date !== todayIST) return {};
      return parsed.colors ?? {};
    } catch (e) {
      this.logger.warn('Failed to read locked colors file: ' + e);
      return {};
    }
  }

  saveLockedColors(colors: Record<string, TileColor>): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const todayIST = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
      fs.writeFileSync(
        this.colorsFile,
        JSON.stringify({ date: todayIST, colors }, null, 2),
        'utf8',
      );
    } catch (e) {
      this.logger.error('Failed to write locked colors file: ' + e);
    }
  }
}
