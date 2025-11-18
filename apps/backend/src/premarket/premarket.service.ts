import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PremarketService {
  private readonly premarketApiUrl: string;

  constructor(private configService: ConfigService) {
    // Get Pre-Market API URL from environment or use default
    this.premarketApiUrl = this.configService.get<string>('PREMARKET_API_URL') || 'http://100.93.172.21:5717';
  }

  /**
   * Proxy GET request to Pre-Market API
   */
  async proxyGet(path: string): Promise<any> {
    const url = `${this.premarketApiUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          {
            status: response.status,
            error: await response.text(),
          },
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Pre-Market API unavailable',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Proxy POST request to Pre-Market API
   */
  async proxyPost(path: string, body: any): Promise<any> {
    const url = `${this.premarketApiUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new HttpException(
          {
            status: response.status,
            error: await response.text(),
          },
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Pre-Market API unavailable',
          message: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Proxy GET request for image (PNG)
   */
  async proxyGetImage(path: string): Promise<Buffer> {
    const url = `${this.premarketApiUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new HttpException(
          {
            status: response.status,
            error: 'Image not found',
          },
          response.status,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'Chart image not found',
          message: error.message,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
