// apps/backend/src/lstmae/lstmae.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  StreamableFile,
  Res,
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { Response } from 'express';
import { LstmaeService } from './lstmae.service';

@Controller('api/lstmae')
export class LstmaeController {
  constructor(private readonly lstmaeService: LstmaeService) {
    console.log('✅ LstmaeController initialized');
  }

  @Get('health')
  async checkHealth() {
    console.log('✅ GET /api/lstmae/health');
    try {
      return await this.lstmaeService.checkHealth();
    } catch (error) {
      throw new HttpException(
        'Pipeline 2 service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Post('dashboard')
  async generateDashboard(
    @Body() body: { symbol: string; method?: string; force_refresh?: boolean }
  ) {
    const { symbol, method = 'spectral', force_refresh = false } = body;
    console.log(`✅ POST /api/lstmae/dashboard - symbol: ${symbol}`);
    
    try {
      return await this.lstmaeService.generateDashboard(symbol, method, force_refresh);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':symbol/plot/:plotType')
  async getPlot(
    @Param('symbol') symbol: string,
    @Param('plotType') plotType: string,
    @Query('method') method: string = 'spectral'
  ) {
    console.log(`✅ GET /api/lstmae/${symbol}/plot/${plotType}`);
    
    try {
      const imageBuffer = await this.lstmaeService.getPlot(symbol, plotType, method);
      
      return new StreamableFile(imageBuffer, {
        type: 'image/png',
        disposition: `inline; filename="${symbol}_${plotType}.png"`,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch plot',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get(':symbol/report')
  async getReport(
    @Param('symbol') symbol: string,
    @Query('method') method: string = 'spectral'
  ) {
    console.log(`✅ GET /api/lstmae/${symbol}/report`);
    
    try {
      return await this.lstmaeService.getReport(symbol, method);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch report',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get(':symbol/dashboard-html')
  async getDashboardHtml(
    @Param('symbol') symbol: string,
    @Res() res: Response
  ) {
    console.log(`✅ GET /api/lstmae/${symbol}/dashboard-html`);
    
    try {
      const html = await this.lstmaeService.getDashboardHtml(symbol);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error(`❌ Error getting dashboard HTML:`, error.message);
      throw new HttpException(
        error.message || 'Failed to fetch dashboard HTML',
        HttpStatus.NOT_FOUND
      );
    }
  }
}
