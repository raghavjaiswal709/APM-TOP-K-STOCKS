// apps/backend/src/sipr/sipr.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class SiprService {
  private readonly logger = new Logger(SiprService.name);
  private readonly SIPR_API_URL = process.env.SIPR_API_URL || 'http://100.93.172.21:8510';
  private readonly TIMEOUT = 300000; // 5 minutes for pattern analysis

  constructor(private readonly httpService: HttpService) {
    this.logger.log('🔬 SIPR Pattern Analysis Service initialized');
    this.logger.log(`   SIPR API: ${this.SIPR_API_URL}`);
  }

  /**
   * Health Check - GET /
   */
  async checkHealth(): Promise<any> {
    try {
      this.logger.log('Checking SIPR API health...');
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.SIPR_API_URL}/`, {
          timeout: 5000,
        })
      );
      this.logger.log('✅ SIPR API health check successful');
      return response.data;
    } catch (error: any) {
      this.logger.error('❌ SIPR API health check failed:', error.message);
      return {
        message: 'SIPR Pattern Analysis API',
        version: 'unavailable',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Get Top 3 Patterns - GET /top3/{company_code}
   */
  async getTop3Patterns(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      this.logger.log(`📊 Fetching Top 3 patterns for ${companyCode} (${months} months)...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/top3/${companyCode}`,
          {
            params: { months, format },
            timeout: this.TIMEOUT,
          }
        )
      );
      
      this.logger.log(`✅ Top 3 patterns fetched for ${companyCode}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch Top 3 patterns for ${companyCode}:`, error.message);
      throw new HttpException(
        `Top 3 patterns not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Top 3 Patterns HTML - GET /top3/{company_code}?format=html
   */
  async getTop3PatternsHtml(
    companyCode: string,
    months: number = 3
  ): Promise<string> {
    try {
      this.logger.log(`🌐 Fetching Top 3 patterns HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/top3/${companyCode}`,
          {
            params: { months, format: 'html' },
            timeout: this.TIMEOUT,
            responseType: 'text',
            headers: {
              'Accept': 'text/html',
            },
          }
        )
      );
      
      this.logger.log(`✅ Top 3 patterns HTML fetched (${response.data.length} bytes)`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch Top 3 patterns HTML:`, error.message);
      throw new HttpException(
        `Top 3 patterns HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Time Series Segmentation - GET /timeseries_segmentation/{company_code}
   */
  async getTimeSeriesSegmentation(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      this.logger.log(`📈 Fetching time series segmentation for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/timeseries_segmentation/${companyCode}`,
          {
            params: { months, format },
            timeout: this.TIMEOUT,
          }
        )
      );
      
      this.logger.log(`✅ Time series segmentation fetched for ${companyCode}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch time series segmentation:`, error.message);
      throw new HttpException(
        `Time series segmentation not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Time Series Segmentation HTML
   */
  async getTimeSeriesSegmentationHtml(
    companyCode: string,
    months: number = 3
  ): Promise<string> {
    try {
      this.logger.log(`🌐 Fetching time series segmentation HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/timeseries_segmentation/${companyCode}`,
          {
            params: { months, format: 'html' },
            timeout: this.TIMEOUT,
            responseType: 'text',
            headers: {
              'Accept': 'text/html',
            },
          }
        )
      );
      
      this.logger.log(`✅ Time series segmentation HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch time series segmentation HTML:`, error.message);
      throw new HttpException(
        `Time series segmentation HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Cluster Visualization - GET /pattern_cluster/{company_code}
   */
  async getPatternCluster(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      this.logger.log(`🎨 Fetching pattern cluster for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/pattern_cluster/${companyCode}`,
          {
            params: { months, format },
            timeout: this.TIMEOUT,
          }
        )
      );
      
      this.logger.log(`✅ Pattern cluster fetched for ${companyCode}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch pattern cluster:`, error.message);
      throw new HttpException(
        `Pattern cluster not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Cluster HTML
   */
  async getPatternClusterHtml(
    companyCode: string,
    months: number = 3
  ): Promise<string> {
    try {
      this.logger.log(`🌐 Fetching pattern cluster HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/pattern_cluster/${companyCode}`,
          {
            params: { months, format: 'html' },
            timeout: this.TIMEOUT,
            responseType: 'text',
            headers: {
              'Accept': 'text/html',
            },
          }
        )
      );
      
      this.logger.log(`✅ Pattern cluster HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch pattern cluster HTML:`, error.message);
      throw new HttpException(
        `Pattern cluster HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Centroid Shapes - GET /centroid_shapes/{company_code}
   */
  async getCentroidShapes(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      this.logger.log(`📐 Fetching centroid shapes for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/centroid_shapes/${companyCode}`,
          {
            params: { months, format },
            timeout: this.TIMEOUT,
          }
        )
      );
      
      this.logger.log(`✅ Centroid shapes fetched for ${companyCode}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch centroid shapes:`, error.message);
      throw new HttpException(
        `Centroid shapes not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Centroid Shapes HTML
   */
  async getCentroidShapesHtml(
    companyCode: string,
    months: number = 3
  ): Promise<string> {
    try {
      this.logger.log(`🌐 Fetching centroid shapes HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/centroid_shapes/${companyCode}`,
          {
            params: { months, format: 'html' },
            timeout: this.TIMEOUT,
            responseType: 'text',
            headers: {
              'Accept': 'text/html',
            },
          }
        )
      );
      
      this.logger.log(`✅ Centroid shapes HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch centroid shapes HTML:`, error.message);
      throw new HttpException(
        `Centroid shapes HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Report - GET /pattern_report/{company_code}
   */
  async getPatternReport(
    companyCode: string,
    months: number = 3
  ): Promise<any> {
    try {
      this.logger.log(`📄 Fetching pattern report for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.SIPR_API_URL}/pattern_report/${companyCode}`,
          {
            params: { months },
            timeout: this.TIMEOUT,
          }
        )
      );
      
      this.logger.log(`✅ Pattern report fetched for ${companyCode}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch pattern report:`, error.message);
      throw new HttpException(
        `Pattern report not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get All Companies List - GET /companies
   */
  async getAllCompanies(): Promise<string[]> {
    try {
      this.logger.log('📋 Fetching all companies list...');
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.SIPR_API_URL}/companies`, {
          timeout: 10000,
        })
      );
      
      this.logger.log(`✅ Companies list fetched (${response.data.length} companies)`);
      return response.data;
    } catch (error: any) {
      this.logger.error('❌ Failed to fetch companies list:', error.message);
      throw new HttpException(
        `Failed to fetch companies list. ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
