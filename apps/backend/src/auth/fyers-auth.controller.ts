import { Controller, Post, Body, Get, HttpException, HttpStatus } from '@nestjs/common';
import { FyersAuthService } from '../market-data/services/fyers-auth.service';

// Local interfaces to avoid export issues
interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
}

interface TokenResponse {
  access_token: string;
  expires_at: string;
}

interface NotifyRequest {
  service: string;
  token: string;
  auth_code: string;
}

interface TokenRequest {
  code: string;
}

interface AuthUrlResponse {
  auth_url: string;
}

interface TokenValidationResponse {
  token: string | null;
  valid: boolean;
  error?: string;
}

@Controller('auth/fyers')
export class FyersAuthController {
  constructor(private readonly fyersAuthService: FyersAuthService) {}

  @Post('token')
  async generateToken(@Body() body: TokenRequest): Promise<TokenResponse> {
    try {
      if (!body.code) {
        throw new HttpException('Authorization code is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.fyersAuthService.generateTokenFromCode(body.code);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Token generation failed', 
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('notify')
  async notifyPythonScript(@Body() body: NotifyRequest): Promise<{ success: boolean; message: string }> {
    try {
      if (!body.service || !body.token || !body.auth_code) {
        throw new HttpException(
          'Service name, token, and auth code are required', 
          HttpStatus.BAD_REQUEST
        );
      }

      await this.fyersAuthService.notifyPythonService(
        body.service, 
        body.token, 
        body.auth_code
      );
      
      return { 
        success: true, 
        message: `Successfully notified ${body.service}` 
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to notify Python service', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      return await this.fyersAuthService.getAuthStatus();
    } catch (error) {
      throw new HttpException(
        'Failed to get auth status', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('token')
  async getCurrentToken(): Promise<TokenValidationResponse> {
    try {
      const token = await this.fyersAuthService.getCurrentAccessToken();
      
      // Fix: Convert null to undefined for validateToken method
      const valid = await this.fyersAuthService.validateToken(token || undefined);
      
      return { 
        token: token ? token.substring(0, 20) + '...' : null, // Mask token for security
        valid 
      };
    } catch (error) {
      return { 
        token: null, 
        valid: false, 
        error: error.message 
      };
    }
  }

  @Post('start')
  async startAuthProcess(): Promise<AuthUrlResponse> {
    try {
      const authUrl = await this.fyersAuthService.startAuthProcess();
      return { auth_url: authUrl };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to start authentication process', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('refresh')
  async refreshToken(): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.fyersAuthService.refreshTokenIfNeeded();
      
      if (success) {
        return { 
          success: true, 
          message: 'Token is still valid' 
        };
      } else {
        return { 
          success: false, 
          message: 'Token refresh required - please re-authenticate' 
        };
      }
    } catch (error) {
      throw new HttpException(
        'Token refresh failed', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('validate')
  async validateToken(@Body() body: { token?: string }): Promise<{ valid: boolean; message: string }> {
    try {
      const valid = await this.fyersAuthService.validateToken(body.token);
      
      return {
        valid,
        message: valid ? 'Token is valid' : 'Token is invalid or expired'
      };
    } catch (error) {
      throw new HttpException(
        'Token validation failed', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
