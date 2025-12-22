// apps/backend/src/sipr/sipr.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

@Injectable()
export class SiprService {
  private readonly logger = new Logger(SiprService.name);
  private readonly SIPR_API_URL = process.env.SIPR_API_URL || 'http://100.93.172.21:8510';
  private readonly TIMEOUT = 300000; // 5 minutes

  constructor(private readonly httpService: HttpService) {
    this.logger.log('🔬 SIPR Pattern Analysis Service initialized');
    this.logger.log(`   SIPR API: ${this.SIPR_API_URL}`);
  }

  /**
   * Health Check - GET /health
   */
  async checkHealth(): Promise<any> {
    try {
      this.logger.log('Checking SIPR API health...');
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.SIPR_API_URL}/health`, {
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
   * Get All Companies List - GET /companies
   */
  async getAllCompanies(): Promise<string[]> {
    try {
      this.logger.log('📋 Fetching all companies list from SIPR...');
      this.logger.log(`   URL: ${this.SIPR_API_URL}/companies`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.SIPR_API_URL}/companies`, {
          timeout: 10000,
        })
      );
      
      this.logger.log(`✅ Companies list fetched (${response.data.length} companies)`);
      this.logger.log(`   Sample companies: ${response.data.slice(0, 5).join(', ')}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.error('❌ Failed to fetch companies list:', error.message);
      if (error.response) {
        this.logger.error(`   Status: ${error.response.status}`);
        this.logger.error(`   Data: ${JSON.stringify(error.response.data)}`);
      }
      throw new HttpException(
        `Failed to fetch companies list. ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Calculate actual occurrence days from segment timestamps
   * Analyzes real segment data to determine which days of the week a pattern actually occurs
   */
  private calculateActualOccurrenceDays(segments: any[], patternId: number): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts: { [key: string]: number } = {};
    
    // Filter segments for this specific pattern
    const patternSegments = segments.filter((seg: any) => seg.pattern_id === patternId);
    
    if (patternSegments.length === 0) {
      return 'No occurrence data';
    }
    
    // Count occurrences by day of week
    patternSegments.forEach((segment: any) => {
      try {
        // Parse the start_time to get the day of week
        const startTime = new Date(segment.start_time);
        if (!isNaN(startTime.getTime())) {
          const dayName = dayNames[startTime.getDay()];
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        }
      } catch (error) {
        // Skip invalid timestamps
      }
    });
    
    if (Object.keys(dayCounts).length === 0) {
      return 'No valid timestamps';
    }
    
    // Sort days by occurrence count (descending) and then by day order
    const tradingDayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const sortedDays = Object.entries(dayCounts)
      .filter(([day]) => tradingDayOrder.includes(day)) // Only include trading days
      .sort((a, b) => {
        // First sort by count (descending)
        if (b[1] !== a[1]) return b[1] - a[1];
        // Then by day order
        return tradingDayOrder.indexOf(a[0]) - tradingDayOrder.indexOf(b[0]);
      });
    
    if (sortedDays.length === 0) {
      return 'No trading day occurrences';
    }
    
    // Return top 3 most frequent days with counts
    const topDays = sortedDays.slice(0, 3);
    return topDays.map(([day, count]) => `${day} (${count})`).join(', ');
  }

  /**
   * Enrich pattern data with calculated fields including actual occurrence days
   * IMPORTANT: Only calculate if API didn't provide valid most_frequent_days
   */
  private enrichPatternData(pattern: any, segments: any[] = []): any {
    // Debug: log what we received from API
    this.logger.log(`🔍 Pattern ${pattern.pattern_id} - API most_frequent_days: ${JSON.stringify(pattern.most_frequent_days)} (type: ${typeof pattern.most_frequent_days})`);
    
    // Check if API already provided valid most_frequent_days data
    // Must be a non-empty string that's not placeholder data
    const hasValidApiDays = pattern.most_frequent_days && 
      typeof pattern.most_frequent_days === 'string' && 
      pattern.most_frequent_days.trim() !== '' &&
      pattern.most_frequent_days !== 'N/A' &&
      // Check it's not the placeholder "all trading days" format
      !pattern.most_frequent_days.includes('Monday, Tuesday, Wednesday, Thursday, Friday');
    
    this.logger.log(`🔍 Pattern ${pattern.pattern_id} - hasValidApiDays: ${hasValidApiDays}`);
    
    // Only calculate from segments if API didn't provide valid data
    const mostFrequentDays = hasValidApiDays 
      ? pattern.most_frequent_days 
      : this.calculateActualOccurrenceDays(segments, pattern.pattern_id);
    
    this.logger.log(`🔍 Pattern ${pattern.pattern_id} - Final most_frequent_days: ${mostFrequentDays}`);
    
    return {
      ...pattern,
      most_frequent_days: mostFrequentDays,
    };
  }

  /**
   * Get Top 3 Patterns - GET /api/v1/patterns/top3/{company_code}
   * Now enhanced with actual occurrence day calculation from segmentation data
   */
  async getTop3Patterns(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/patterns/top3/${companyCode}`;
      this.logger.log(`📊 Fetching Top 3 patterns for ${companyCode} (${months} months)...`);
      this.logger.log(`   Full URL: ${url}?months=${months}`);
      
      // Fetch both top patterns and segmentation data in parallel for efficiency
      const [patternsResponse, segmentationData] = await Promise.all([
        firstValueFrom(
          this.httpService.get(url, {
            params: { months },
            timeout: this.TIMEOUT,
          }).pipe(
            catchError((error: AxiosError) => {
              this.logger.error(`❌ HTTP Error Details:`);
              this.logger.error(`   Status: ${error.response?.status}`);
              this.logger.error(`   URL: ${error.config?.url}`);
              this.logger.error(`   Message: ${error.message}`);
              if (error.response?.data) {
                this.logger.error(`   Response: ${JSON.stringify(error.response.data)}`);
              }
              throw error;
            })
          )
        ),
        // Fetch segmentation data to get actual timestamps for day calculation
        this.getTimeSeriesSegmentationInternal(companyCode, months).catch((err) => {
          this.logger.warn(`⚠️ Could not fetch segmentation data for day calculation: ${err.message}`);
          return { segments: [] };
        })
      ]);
      
      this.logger.log(`✅ Top 3 patterns fetched for ${companyCode}`);
      
      // Extract segments array from segmentation response
      const segments = segmentationData?.segments || [];
      this.logger.log(`   Found ${segments.length} segments for day-of-week calculation`);
      
      // Enrich data with calculated fields using actual segment timestamps
      const enrichedData = {
        ...patternsResponse.data,
        top_patterns: patternsResponse.data.top_patterns.map((p: any) => 
          this.enrichPatternData(p, segments)
        ),
      };
      
      return enrichedData;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch Top 3 patterns for ${companyCode}`);
      
      if (error.response?.status === 404) {
        try {
          const companies = await this.getAllCompanies();
          const isValidCompany = companies.includes(companyCode);
          
          if (!isValidCompany) {
            throw new HttpException(
              `Company '${companyCode}' not found in SIPR database. Available companies: ${companies.slice(0, 10).join(', ')}...`,
              HttpStatus.NOT_FOUND
            );
          }
        } catch (companyError) {
          // If we can't get companies list, throw original error
        }
      }
      
      throw new HttpException(
        `Top 3 patterns not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Top 3 Patterns HTML Visualization
   */
  async getTop3PatternsHtml(
    companyCode: string,
    months: number = 3
  ): Promise<string> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/visualization/patterns/${companyCode}`;
      this.logger.log(`🌐 Fetching pattern visualization HTML for ${companyCode}...`);
      this.logger.log(`   Full URL: ${url}?months=${months}&format=html`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format: 'html' },
          timeout: this.TIMEOUT,
          responseType: 'text',
          headers: {
            'Accept': 'text/html',
          },
        })
      );
      
      this.logger.log(`✅ Pattern visualization HTML fetched (${response.data.length} bytes)`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch pattern visualization HTML:`, error.message);
      throw new HttpException(
        `Pattern visualization not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Internal method to fetch segmentation data for day calculation
   * Does not throw - returns empty segments on error to avoid breaking getTop3Patterns
   */
  private async getTimeSeriesSegmentationInternal(
    companyCode: string,
    months: number = 3
  ): Promise<{ segments: any[] }> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/visualization/segmentation/${companyCode}`;
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format: 'json' },
          timeout: this.TIMEOUT,
        })
      );
      
      return response.data;
    } catch (error: any) {
      // Return empty segments - don't let this break the main flow
      return { segments: [] };
    }
  }

  /**
   * Get Time Series Segmentation - GET /api/v1/visualization/segmentation/{company_code}
   */
  async getTimeSeriesSegmentation(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/visualization/segmentation/${companyCode}`;
      this.logger.log(`📈 Fetching time series segmentation for ${companyCode}...`);
      this.logger.log(`   Full URL: ${url}?months=${months}&format=${format}`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format },
          timeout: this.TIMEOUT,
        })
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
      const url = `${this.SIPR_API_URL}/api/v1/visualization/segmentation/${companyCode}`;
      this.logger.log(`🌐 Fetching segmentation HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format: 'html' },
          timeout: this.TIMEOUT,
          responseType: 'text',
          headers: {
            'Accept': 'text/html',
          },
        })
      );
      
      this.logger.log(`✅ Segmentation HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch segmentation HTML:`, error.message);
      throw new HttpException(
        `Segmentation HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Cluster - GET /api/v1/visualization/patterns/{company_code}
   */
  async getPatternCluster(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/visualization/patterns/${companyCode}`;
      this.logger.log(`🎨 Fetching pattern cluster for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format },
          timeout: this.TIMEOUT,
        })
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
      const url = `${this.SIPR_API_URL}/api/v1/visualization/patterns/${companyCode}`;
      this.logger.log(`🌐 Fetching cluster HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format: 'html' },
          timeout: this.TIMEOUT,
          responseType: 'text',
          headers: {
            'Accept': 'text/html',
          },
        })
      );
      
      this.logger.log(`✅ Cluster HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch cluster HTML:`, error.message);
      throw new HttpException(
        `Cluster HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Centroid Shapes - GET /api/v1/visualization/centroids/{company_code}
   */
  async getCentroidShapes(
    companyCode: string,
    months: number = 3,
    format: 'html' | 'json' = 'json'
  ): Promise<any> {
    try {
      const url = `${this.SIPR_API_URL}/api/v1/visualization/centroids/${companyCode}`;
      this.logger.log(`📐 Fetching centroid shapes for ${companyCode}...`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format },
          timeout: this.TIMEOUT,
        })
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
      const url = `${this.SIPR_API_URL}/api/v1/visualization/centroids/${companyCode}`;
      this.logger.log(`🌐 Fetching centroids HTML for ${companyCode}...`);
      
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get(url, {
          params: { months, format: 'html' },
          timeout: this.TIMEOUT,
          responseType: 'text',
          headers: {
            'Accept': 'text/html',
          },
        })
      );
      
      this.logger.log(`✅ Centroids HTML fetched`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to fetch centroids HTML:`, error.message);
      throw new HttpException(
        `Centroids HTML not found for ${companyCode}. ${error.message}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Get Pattern Report (Custom aggregation)
   */
  async getPatternReport(
    companyCode: string,
    months: number = 3
  ): Promise<any> {
    try {
      this.logger.log(`📄 Fetching pattern report for ${companyCode}...`);
      
      const top3Data = await this.getTop3Patterns(companyCode, months);
      
      const report = {
        company_code: companyCode,
        analysis_period: top3Data.analysis_period,
        summary: {
          total_segments: top3Data.total_segments,
          unique_patterns: top3Data.top_patterns.length,
          avg_segment_length: top3Data.top_patterns.length > 0 
            ? top3Data.top_patterns.reduce((sum: number, p: any) => sum + p.avg_length, 0) / top3Data.top_patterns.length
            : 0,
          most_common_pattern: top3Data.top_patterns.length > 0 
            ? top3Data.top_patterns[0].pattern_id 
            : null,
        },
        top_patterns: top3Data.top_patterns.map((p: any) => ({
          pattern_id: p.pattern_id,
          cluster_label: p.pattern_id,
          occurrence_count: p.frequency,
          percentage_of_total: p.percentage,
          avg_length: p.avg_length,
          avg_time_minutes: p.avg_time_minutes,
          most_frequent_days: p.most_frequent_days,
        })),
        cluster_distribution: top3Data.top_patterns.reduce((acc: any, p: any) => {
          acc[p.pattern_id] = p.frequency;
          return acc;
        }, {}),
        recommendations: this.generateRecommendations(top3Data.top_patterns),
        analysis_timestamp: new Date().toISOString(),
      };
      
      this.logger.log(`✅ Pattern report generated for ${companyCode}`);
      return report;
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate pattern report:`, error.message);
      throw error;
    }
  }

  private generateRecommendations(patterns: any[]): string[] {
    const recommendations: string[] = [];
    
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      if (topPattern.percentage > 30) {
        recommendations.push(
          `Pattern ${topPattern.pattern_id} dominates with ${topPattern.percentage.toFixed(1)}% occurrence - strong recurring behavior detected`
        );
      }
      
      if (topPattern.avg_length > 15) {
        recommendations.push(
          `Long-duration patterns detected (avg ${topPattern.avg_length.toFixed(1)} steps / ${topPattern.avg_time_minutes.toFixed(0)} minutes) - sustained price movements expected`
        );
      }

      if (topPattern.time_found_range) {
        recommendations.push(
          `Pattern typically occurs between ${topPattern.time_found_range} - consider timing trades accordingly`
        );
      }

      if (topPattern.most_prominent_range) {
        recommendations.push(
          `Highest pattern activity observed during ${topPattern.most_prominent_range} - peak trading opportunity window`
        );
      }

      if (topPattern.avg_distance < 0.02) {
        recommendations.push(
          `Very tight pattern clustering (DTW: ${topPattern.avg_distance.toFixed(4)}) - highly consistent behavior`
        );
      }

      if (patterns.length >= 3) {
        const totalCoverage = patterns.reduce((sum, p) => sum + p.percentage, 0);
        if (totalCoverage > 80) {
          recommendations.push(
            `Top 3 patterns cover ${totalCoverage.toFixed(1)}% of all segments - predictable price behavior`
          );
        } else {
          recommendations.push(
            `High pattern diversity detected - market showing varied behavior across different conditions`
          );
        }
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for emerging patterns and trend changes');
    }
    
    return recommendations;
  }
}
