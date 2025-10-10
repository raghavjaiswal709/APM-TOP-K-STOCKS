// apps/backend/src/lstmae/lstmae.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class LstmaeService {
  private readonly PIPELINE2_API_URL = 'http://100.93.172.21:8506';
  private readonly TIMEOUT = 120000; // 2 minutes

  constructor(private readonly httpService: HttpService) {
    console.log('🚀 LstmaeService initialized');
    console.log('   Pipeline 2 API:', this.PIPELINE2_API_URL);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<any> {
    try {
      console.log('Checking Pipeline 2 health...');
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.PIPELINE2_API_URL}/health`, {
          timeout: 5000,
        })
      );
      console.log('✅ Health check successful');
      return response.data;
    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);
      return {
        service: 'visualization',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Generate dashboard
   */
  async generateDashboard(symbol: string, method: string, forceRefresh: boolean): Promise<any> {
    try {
      console.log(`📊 Generating dashboard for ${symbol}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.post(
          `${this.PIPELINE2_API_URL}/visualize/dashboard`,
          { symbol, method, force_refresh: forceRefresh },
          { timeout: this.TIMEOUT }
        )
      );
      
      console.log('✅ Dashboard generated successfully');
      
      // Transform to backend API routes
      return {
        success: true,
        symbol: symbol,
        plot_paths: {
          dominant_patterns: `/api/lstmae/${symbol}/plot/dominant_patterns`,
          cluster_timeline: `/api/lstmae/${symbol}/plot/cluster_timeline`,
          intraday: `/api/lstmae/${symbol}/plot/intraday`,
          cluster_transitions: `/api/lstmae/${symbol}/plot/cluster_transitions`,
        },
        dashboard_path: `/api/lstmae/${symbol}/dashboard-html`,
        report_path: `/api/lstmae/${symbol}/report`,
        n_dominant_patterns: response.data.n_dominant_patterns || 0,
        dominant_patterns: response.data.dominant_patterns || [],
      };
    } catch (error: any) {
      console.error(`❌ Dashboard API failed: ${error.message}`);
      
      return {
        success: true,
        symbol,
        plot_paths: {
          dominant_patterns: `/api/lstmae/${symbol}/plot/dominant_patterns`,
          cluster_timeline: `/api/lstmae/${symbol}/plot/cluster_timeline`,
          intraday: `/api/lstmae/${symbol}/plot/intraday`,
          cluster_transitions: `/api/lstmae/${symbol}/plot/cluster_transitions`,
        },
        dashboard_path: `/api/lstmae/${symbol}/dashboard-html`,
        report_path: `/api/lstmae/${symbol}/report`,
        n_dominant_patterns: 0,
        dominant_patterns: [],
      };
    }
  }

  /**
   * Get plot image - Maps to Python API plot types
   */
  async getPlot(symbol: string, plotType: string, method: string): Promise<Buffer> {
    try {
      console.log(`📈 Fetching plot ${plotType} for ${symbol}...`);
      
      // ✅ Map frontend plot types to Python API plot types
      const plotTypeMap: Record<string, string> = {
        'dominant_patterns': 'dominant_patterns',
        'cluster_timeline': 'cluster_timeline',
        'intraday': 'intraday',
        'cluster_transitions': 'transitions',  // ✅ Python uses "transitions"
        'seasonality': 'seasonality',
        'anomalies': 'anomalies',
        'embedding_evolution': 'embedding_evolution',
      };
      
      const apiPlotType = plotTypeMap[plotType] || plotType;
      console.log(`   Mapping: ${plotType} -> ${apiPlotType}`);
      
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.get(
          `${this.PIPELINE2_API_URL}/visualize/${symbol}/plot/${apiPlotType}?method=${method}`,
          {
            responseType: 'arraybuffer',
            timeout: this.TIMEOUT,
          }
        )
      );
      
      console.log(`✅ Plot ${plotType} fetched (${response.data.byteLength} bytes)`);
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error(`❌ Failed to fetch plot ${plotType}:`, error.message);
      throw new HttpException(
        `Plot not found: ${plotType} for ${symbol}. API error: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get analysis report
   */
  async getReport(symbol: string, method: string): Promise<any> {
    try {
      console.log(`📄 Fetching report for ${symbol}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(
          `${this.PIPELINE2_API_URL}/visualize/${symbol}/report?method=${method}`,
          { timeout: this.TIMEOUT }
        )
      );
      
      console.log('✅ Report fetched successfully');
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to fetch report:`, error.message);
      throw new HttpException(
        `Report not found for ${symbol}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get interactive dashboard HTML
   * ✅ Uses Python API endpoint: GET /visualize/{symbol}/dashboard
   */
  async getDashboardHtml(symbol: string): Promise<string> {
    try {
      console.log(`🌐 Fetching interactive dashboard HTML for ${symbol}...`);
      
      // ✅ Python API endpoint that returns HTML via FileResponse
      const url = `${this.PIPELINE2_API_URL}/visualize/${symbol}/dashboard`;
      console.log(`   URL: ${url}`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.TIMEOUT,
          responseType: 'text',
          headers: {
            'Accept': 'text/html',
          },
        })
      );
      
      console.log(`✅ HTML dashboard fetched (${response.data.length} bytes)`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to fetch HTML dashboard:`, error.message);
      
      let errorMessage = `Dashboard HTML not found for ${symbol}.`;
      
      if (error.response?.status === 404) {
        errorMessage += ' The dashboard may not have been generated yet. Try generating it first via POST /visualize/dashboard.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += ' Pipeline 2 service is not running on port 8506.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += ' Request timed out. The service may be overloaded.';
      } else {
        errorMessage += ` Error: ${error.message}`;
      }
      
      throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
    }
  }
}
