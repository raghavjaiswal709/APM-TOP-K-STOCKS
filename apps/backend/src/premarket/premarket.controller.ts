import { Controller, Get, Post, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PremarketService } from './premarket.service';

@Controller('api/premarket')
export class PremarketController {
  constructor(private readonly premarketService: PremarketService) {}

  /**
   * Health check
   * GET /api/premarket/health
   */
  @Get('health')
  async healthCheck(@Res() res: Response) {
    try {
      const data = await this.premarketService.proxyGet('/health');
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'Pre-market API unavailable',
        message: error.message,
      });
    }
  }

  /**
   * Get status
   * GET /api/premarket/status
   */
  @Get('status')
  async getStatus(@Res() res: Response) {
    try {
      const data = await this.premarketService.proxyGet('/api/premarket/status');
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch status',
        message: error.message,
      });
    }
  }

  /**
   * Generate predictions
   * POST /api/premarket/generate
   */
  @Post('generate')
  async generatePredictions(@Res() res: Response) {
    try {
      const data = await this.premarketService.proxyPost('/api/premarket/generate', {});
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate predictions',
        message: error.message,
      });
    }
  }

  /**
   * Get all predictions
   * GET /api/premarket/predictions
   */
  @Get('predictions')
  async getAllPredictions(@Res() res: Response) {
    try {
      const data = await this.premarketService.proxyGet('/api/premarket/predictions');
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch predictions',
        message: error.message,
      });
    }
  }

  /**
   * Get prediction for specific stock
   * GET /api/premarket/predictions/:stockCode
   */
  @Get('predictions/:stockCode')
  async getPrediction(@Param('stockCode') stockCode: string, @Res() res: Response) {
    try {
      const data = await this.premarketService.proxyGet(`/api/premarket/predictions/${stockCode}`);
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: `Failed to fetch prediction for ${stockCode}`,
        message: error.message,
      });
    }
  }

  /**
   * Get cached headlines for specific stock
   * GET /api/premarket/headlines/:stockCode/cached
   */
  @Get('headlines/:stockCode/cached')
  async getCachedHeadlines(@Param('stockCode') stockCode: string, @Res() res: Response) {
    try {
      const data = await this.premarketService.proxyGet(`/api/premarket/headlines/${stockCode}/cached`);
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: `Failed to fetch headlines for ${stockCode}`,
        message: error.message,
      });
    }
  }

  /**
   * List charts for specific stock
   * GET /api/premarket/charts/:stockCode
   */
  @Get('charts/:stockCode')
  async listCharts(
    @Param('stockCode') stockCode: string,
    @Query('date') date: string,
    @Res() res: Response
  ) {
    try {
      const queryParam = date ? `?date=${date}` : '';
      const data = await this.premarketService.proxyGet(`/api/premarket/charts/${stockCode}${queryParam}`);
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: `Failed to list charts for ${stockCode}`,
        message: error.message,
      });
    }
  }

  /**
   * Get chart image
   * GET /api/premarket/charts/:stockCode/:date/:filename
   */
  @Get('charts/:stockCode/:date/:filename')
  async getChartImage(
    @Param('stockCode') stockCode: string,
    @Param('date') date: string,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    try {
      const imageBuffer = await this.premarketService.proxyGetImage(
        `/api/premarket/charts/${stockCode}/${date}/${filename}`
      );
      
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      });
      
      return res.send(imageBuffer);
    } catch (error) {
      return res.status(error.status || HttpStatus.NOT_FOUND).json({
        error: 'Chart not found',
        message: error.message,
      });
    }
  }

  /**
   * Generate charts for specific stock
   * POST /api/premarket/charts/:stockCode/generate
   */
  @Post('charts/:stockCode/generate')
  async generateCharts(@Param('stockCode') stockCode: string, @Res() res: Response) {
    try {
      const data = await this.premarketService.proxyPost(`/api/premarket/charts/${stockCode}/generate`, {});
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: `Failed to generate charts for ${stockCode}`,
        message: error.message,
      });
    }
  }

  /**
   * Generate charts for all stocks
   * POST /api/premarket/charts/generate-all
   */
  @Post('charts/generate-all')
  async generateAllCharts(@Res() res: Response) {
    try {
      const data = await this.premarketService.proxyPost('/api/premarket/charts/generate-all', {});
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate charts',
        message: error.message,
      });
    }
  }
}
