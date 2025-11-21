// apps/backend/src/premarket/premarket.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class PremarketService {
  private readonly logger = new Logger(PremarketService.name);
  private readonly PREMARKET_API_URL = process.env.PREMARKET_API_URL || 'http://100.93.172.21:5717';
  private readonly TIMEOUT = 120000; // 2 minutes

  constructor(private readonly httpService: HttpService) {
    this.logger.log('🔮 PremarketService initialized');
    this.logger.log(`   Premarket API: ${this.PREMARKET_API_URL}`);
  }

  /**
   * Generic GET proxy method
   */
  async proxyGet(path: string): Promise<any> {
    try {
      const url = `${this.PREMARKET_API_URL}${path}`;
      this.logger.debug(`🔄 Proxying GET ${path}`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.TIMEOUT,
        })
      );
      
      this.logger.debug(`✅ GET ${path} successful`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ GET ${path} failed:`, error.message);
      throw new HttpException(
        error.response?.data?.message || `Failed to fetch ${path}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generic POST proxy method
   */
  async proxyPost(path: string, body: any): Promise<any> {
    try {
      const url = `${this.PREMARKET_API_URL}${path}`;
      this.logger.debug(`🔄 Proxying POST ${path}`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.post(url, body, {
          timeout: this.TIMEOUT,
        })
      );
      
      this.logger.debug(`✅ POST ${path} successful`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ POST ${path} failed:`, error.message);
      throw new HttpException(
        error.response?.data?.message || `Failed to post to ${path}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Proxy GET for image/binary data
   */
  async proxyGetImage(path: string): Promise<Buffer> {
    try {
      const url = `${this.PREMARKET_API_URL}${path}`;
      this.logger.debug(`🖼️ Proxying GET image ${path}`);
      
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'arraybuffer',
          timeout: this.TIMEOUT,
        })
      );
      
      this.logger.debug(`✅ Image ${path} fetched (${response.data.byteLength} bytes)`);
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`❌ GET image ${path} failed:`, error.message);
      throw new HttpException(
        `Chart image not found: ${path}`,
        error.response?.status || HttpStatus.NOT_FOUND
      );
    }
  }
}
