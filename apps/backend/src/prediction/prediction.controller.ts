import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { CreatePredictionDto, PredictionQueryDto } from './dto/prediction.dto';
import {
  PredictionResponseDto,
  HealthResponseDto,
  CompaniesResponseDto,
  BatchPredictionResponseDto,
} from './dto/prediction-response.dto';

@Controller('api/predictions')
export class PredictionController {
  private readonly logger = new Logger(PredictionController.name);

  constructor(private predictionService: PredictionService) {}

  /**
   * GET /api/predictions/health
   * Check prediction service health
   */
  @Get('health')
  async checkHealth(): Promise<HealthResponseDto> {
    this.logger.log('Health check requested');
    return await this.predictionService.checkHealth();
  }

  /**
   * GET /api/predictions/companies
   * Get list of available companies
   */
  @Get('companies')
  async getCompanies(): Promise<CompaniesResponseDto> {
    this.logger.log('Companies list requested');
    return await this.predictionService.getCompanies();
  }

  /**
   * GET /api/predictions/batch/multiple
   * Get batch predictions for multiple companies
   */
  @Get('batch/multiple')
  async getBatchPredictions(
    @Query('companies') companies: string | string[],
    @Query() query: PredictionQueryDto
  ): Promise<BatchPredictionResponseDto> {
    const companiesList = Array.isArray(companies) ? companies : [companies];
    this.logger.log(`Batch predictions requested for: ${companiesList.join(', ')}`);
    return await this.predictionService.getBatchPredictions(companiesList, query);
  }

  /**
   * GET /api/predictions/:company/:timestamp
   * Get prediction for specific timestamp
   */
  @Get(':company/:timestamp')
  async getSpecificPrediction(
    @Param('company') company: string,
    @Param('timestamp') timestamp: string
  ): Promise<any> {
    this.logger.log(`Specific prediction requested: ${company} at ${timestamp}`);
    return await this.predictionService.getSpecificPrediction(company, timestamp);
  }

  /**
   * GET /api/predictions/:company
   * Get all predictions for a company
   */
  @Get(':company')
  async getCompanyPredictions(
    @Param('company') company: string,
    @Query() query: PredictionQueryDto
  ): Promise<PredictionResponseDto> {
    this.logger.log(`Predictions requested for: ${company}`);
    return await this.predictionService.getCompanyPredictions(company, query);
  }

  /**
   * POST /api/predictions
   * Save new prediction
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async savePrediction(@Body() dto: CreatePredictionDto): Promise<any> {
    this.logger.log(`Prediction saved: ${dto.company} at ${dto.timestamp}`);
    return await this.predictionService.savePrediction(dto);
  }

  /**
   * POST /api/predictions/cache/clear
   * Clear cache
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  clearCache(): { message: string; timestamp: string } {
    this.logger.log('Cache clear requested');
    this.predictionService.clearCache();
    return {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/predictions/cache/stats
   * Get cache statistics
   */
  @Get('cache/stats')
  getCacheStats(): any {
    return this.predictionService.getCacheStats();
  }
}
