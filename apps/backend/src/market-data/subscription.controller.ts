import { Controller, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Controller('api/market-data')
export class SubscriptionController {
    private readonly logger = new Logger(SubscriptionController.name);

    constructor(private readonly subscriptionService: SubscriptionService) { }

    @Post('subscribe')
    async subscribeToSymbols(@Body() body: { symbols: string[] }) {
        const { symbols } = body;

        // ✅ Input validation
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            this.logger.error('Invalid request: symbols array is empty or missing');
            throw new HttpException(
                'Symbols list is required and cannot be empty',
                HttpStatus.BAD_REQUEST
            );
        }

        this.logger.log(`📥 Received subscription request for ${symbols.length} symbols`);

        try {
            const result = await this.subscriptionService.subscribeToSymbols(symbols);

            return {
                success: true,
                message: result.message || `Successfully subscribed to ${symbols.length} symbols`,
                count: result.count || symbols.length
            };
        } catch (error) {
            this.logger.error(`❌ Subscription failed: ${error.message}`);
            this.logger.error(error.stack);

            throw new HttpException(
                {
                    success: false,
                    error: error.message || 'Failed to process subscription request',
                    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
