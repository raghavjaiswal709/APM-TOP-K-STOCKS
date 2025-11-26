import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';

export interface GttPrediction {
    prediction_time: string;
    input_close: number;
    H1_pred: number;
    H2_pred: number;
    H3_pred: number;
    H4_pred: number;
    H5_pred: number;
    timestamp: string;
}

export interface GttStockResponse {
    symbol: string;
    total_predictions: number;
    predictions: GttPrediction[];
    latest: GttPrediction;
}

@Injectable()
export class GttPredictionService {
    private readonly logger = new Logger(GttPredictionService.name);
    // private readonly GTT_ENGINE_URL = 'http://localhost:5113';
    private readonly GTT_ENGINE_URL = 'http://100.93.172.21:5113';

    constructor(private readonly httpService: HttpService) { }

    async getHistory(symbol: string): Promise<GttStockResponse | null> {
        const url = `${this.GTT_ENGINE_URL}/api/predictions/stock/${symbol}`;
        try {
            const { data } = await firstValueFrom(
                this.httpService.get<GttStockResponse>(url).pipe(
                    catchError((error: AxiosError) => {
                        this.logger.error(`Failed to fetch GTT history for ${symbol}: ${error.message}`);
                        throw error;
                    }),
                ),
            );
            return data;
        } catch (error) {
            // Return null or throw depending on desired resilience. 
            // User asked: "If GTT is down, return a standard error object; do not crash the main application."
            // We'll return null here and handle it in the controller or return a safe error structure.
            this.logger.warn(`Returning null for ${symbol} due to GTT error.`);
            return null;
        }
    }

    async getLatest(): Promise<any> {
        const url = `${this.GTT_ENGINE_URL}/api/predictions/latest`;
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(url).pipe(
                    catchError((error: AxiosError) => {
                        this.logger.error(`Failed to fetch latest GTT predictions: ${error.message}`);
                        throw error;
                    }),
                ),
            );
            return data;
        } catch (error) {
            this.logger.warn(`Returning null for latest predictions due to GTT error.`);
            return null;
        }
    }
}
