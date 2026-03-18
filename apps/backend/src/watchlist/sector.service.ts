import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SectorService implements OnModuleInit {
    private readonly logger = new Logger(SectorService.name);
    private sectorMap: Record<string, string> = {};
    private readonly jsonPath = path.join(__dirname, '../../data/sector_mapping.json');

    onModuleInit() {
        this.loadSectorMap();
    }

    private loadSectorMap(): void {
        try {
            if (!fs.existsSync(this.jsonPath)) {
                this.logger.warn(`sector_mapping.json not found at: ${this.jsonPath}`);
                return;
            }
            const raw = fs.readFileSync(this.jsonPath, 'utf8');
            const parsed = JSON.parse(raw);
            // Normalise keys to UPPERCASE for consistent lookups
            for (const [key, val] of Object.entries(parsed)) {
                this.sectorMap[key.toUpperCase()] = val as string;
            }
            this.logger.log(`✅ Loaded sector data for ${Object.keys(this.sectorMap).length} symbols`);
        } catch (err) {
            this.logger.error('Failed to load sector_mapping.json:', err);
        }
    }

    /** Returns the full map { SYMBOL: sector } */
    getAllSectors(): Record<string, string> {
        return { ...this.sectorMap };
    }

    /** Returns sector for a single symbol, or null if unknown */
    getSector(symbol: string): string | null {
        return this.sectorMap[symbol?.toUpperCase()] ?? null;
    }
}
