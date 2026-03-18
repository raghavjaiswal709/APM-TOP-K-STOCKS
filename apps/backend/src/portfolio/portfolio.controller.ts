import { Controller, Get, Post, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('api/portfolio')
export class PortfolioController {
    private readonly logger = new Logger(PortfolioController.name);

    constructor(private readonly portfolioService: PortfolioService) {}

    @Get()
    getPortfolio() {
        this.logger.debug('GET /api/portfolio');
        return this.portfolioService.getPortfolioState();
    }

    @Post('save')
    savePortfolio(@Body() body: { portfolio: any; trades: any[] }) {
        if (!body || !Array.isArray(body.trades)) {
            throw new HttpException(
                { success: false, error: 'Invalid payload: trades array required' },
                HttpStatus.BAD_REQUEST,
            );
        }
        try {
            this.portfolioService.savePortfolioState(body.portfolio, body.trades);
            this.logger.debug(`Saved portfolio: ${body.trades.length} trades`);
            return { success: true };
        } catch (err) {
            this.logger.error('Save failed:', err);
            throw new HttpException(
                { success: false, error: err.message || 'Failed to save portfolio' },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
