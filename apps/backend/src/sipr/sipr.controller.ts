// apps/backend/src/sipr/sipr.controller.ts
import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  Res,
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { Response } from 'express';
import { SiprService } from './sipr.service';

@Controller('api/sipr')
export class SiprController {
  constructor(private readonly siprService: SiprService) {
    console.log('✅ SIPR Pattern Analysis Controller initialized');
  }

  /**
   * Health Check - GET /api/sipr/health
   */
  @Get('health')
  async checkHealth() {
    console.log('✅ GET /api/sipr/health');
    try {
      return await this.siprService.checkHealth();
    } catch (error) {
      throw new HttpException(
        'SIPR API service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get All Companies - GET /api/sipr/companies
   */
  @Get('companies')
  async getAllCompanies() {
    console.log('✅ GET /api/sipr/companies');
    try {
      return await this.siprService.getAllCompanies();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch companies list',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Top 3 Patterns (JSON) - GET /api/sipr/:companyCode/top3
   */
  @Get(':companyCode/top3')
  async getTop3Patterns(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Query('format') format: 'html' | 'json' = 'json'
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/top3?months=${months}&format=${format}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      return await this.siprService.getTop3Patterns(companyCode, monthsNum, format);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch Top 3 patterns',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Top 3 Patterns HTML - GET /api/sipr/:companyCode/top3-html
   */
  @Get(':companyCode/top3-html')
  async getTop3PatternsHtml(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Res() res: Response
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/top3-html?months=${months}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      const html = await this.siprService.getTop3PatternsHtml(companyCode, monthsNum);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error(`❌ Error getting Top 3 patterns HTML:`, error.message);
      throw new HttpException(
        error.message || 'Failed to fetch Top 3 patterns HTML',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Time Series Segmentation (JSON) - GET /api/sipr/:companyCode/segmentation
   */
  @Get(':companyCode/segmentation')
  async getTimeSeriesSegmentation(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Query('format') format: 'html' | 'json' = 'json'
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/segmentation?months=${months}&format=${format}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      return await this.siprService.getTimeSeriesSegmentation(companyCode, monthsNum, format);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch time series segmentation',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Time Series Segmentation HTML - GET /api/sipr/:companyCode/segmentation-html
   */
  @Get(':companyCode/segmentation-html')
  async getTimeSeriesSegmentationHtml(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Res() res: Response
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/segmentation-html?months=${months}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      const html = await this.siprService.getTimeSeriesSegmentationHtml(companyCode, monthsNum);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error(`❌ Error getting segmentation HTML:`, error.message);
      throw new HttpException(
        error.message || 'Failed to fetch segmentation HTML',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Cluster (JSON) - GET /api/sipr/:companyCode/cluster
   */
  @Get(':companyCode/cluster')
  async getPatternCluster(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Query('format') format: 'html' | 'json' = 'json'
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/cluster?months=${months}&format=${format}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      return await this.siprService.getPatternCluster(companyCode, monthsNum, format);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch pattern cluster',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Cluster HTML - GET /api/sipr/:companyCode/cluster-html
   */
  @Get(':companyCode/cluster-html')
  async getPatternClusterHtml(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Res() res: Response
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/cluster-html?months=${months}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      const html = await this.siprService.getPatternClusterHtml(companyCode, monthsNum);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error(`❌ Error getting cluster HTML:`, error.message);
      throw new HttpException(
        error.message || 'Failed to fetch cluster HTML',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Centroid Shapes (JSON) - GET /api/sipr/:companyCode/centroids
   */
  @Get(':companyCode/centroids')
  async getCentroidShapes(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Query('format') format: 'html' | 'json' = 'json'
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/centroids?months=${months}&format=${format}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      return await this.siprService.getCentroidShapes(companyCode, monthsNum, format);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch centroid shapes',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Centroid Shapes HTML - GET /api/sipr/:companyCode/centroids-html
   */
  @Get(':companyCode/centroids-html')
  async getCentroidShapesHtml(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3',
    @Res() res: Response
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/centroids-html?months=${months}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      const html = await this.siprService.getCentroidShapesHtml(companyCode, monthsNum);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error(`❌ Error getting centroids HTML:`, error.message);
      throw new HttpException(
        error.message || 'Failed to fetch centroids HTML',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Report - GET /api/sipr/:companyCode/report
   */
  @Get(':companyCode/report')
  async getPatternReport(
    @Param('companyCode') companyCode: string,
    @Query('months') months: string = '3'
  ) {
    console.log(`✅ GET /api/sipr/${companyCode}/report?months=${months}`);
    
    try {
      const monthsNum = parseInt(months, 10) || 3;
      return await this.siprService.getPatternReport(companyCode, monthsNum);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch pattern report',
        HttpStatus.NOT_FOUND
      );
    }
  }
}
