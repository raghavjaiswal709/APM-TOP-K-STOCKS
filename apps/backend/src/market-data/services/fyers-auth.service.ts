import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { io as Client } from 'socket.io-client';
import * as crypto from 'crypto';


interface TokenData {
  access_token: string;
  expiry: string;
  auth_code: string;
  created_at: string;
  is_valid: boolean;
  last_validated: string;
  session_date: string;
}

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
  session_date?: string;
  auto_refresh_enabled?: boolean;
  next_refresh_check?: string;
}

interface TokenResponse {
  access_token: string;
  expires_at: string;
  reused: boolean;
}

@Injectable()
export class FyersAuthService {
  private readonly logger = new Logger(FyersAuthService.name);
  private clientId: string;
  private secretKey: string;
  private redirectUri: string;
  private tokenPath: string;
  private authStatusPath: string;

  // ✅ FIXED: Make these instance variables instead of readonly
  private BASE_URL: string;
  private AUTH_URL: string;
  private TOKEN_URL: string;

  // ✅ FIXED: Updated constructor with T2 endpoints and full initialization
  constructor() {
    this.clientId = process.env.FYERS_CLIENT_ID || '150HUKJSWG-100';
    this.secretKey = process.env.FYERS_SECRET_ID || '18YYNXCAS7';
    this.redirectUri = process.env.FYERS_REDIRECT_URI || 'https://raghavjaiswal709.github.io/DAKSphere_redirect/';
    
    // ✅ FIXED: Use T2 endpoints like your working Python code
    this.BASE_URL = 'https://api-t1.fyers.in/api/v3';
    this.AUTH_URL = `${this.BASE_URL}/generate-authcode`;
    this.TOKEN_URL = `${this.BASE_URL}/validate-authcode`;

    // Initialize data directory and paths
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.tokenPath = path.join(dataDir, 'fyers_token.json');
    this.authStatusPath = path.join(dataDir, 'auth_status.json');
    
    this.logger.log(`Initialized Fyers Auth Service with redirect URI: ${this.redirectUri}`);
    this.logger.log(`Using T2 API endpoints: ${this.BASE_URL}`);
    
    // Check existing token on startup
    this.validateExistingToken();
  }

  // ===== TOKEN MANAGEMENT METHODS =====

  private saveTokenData(tokenData: TokenData): void {
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2));
      this.logger.debug('Token data saved successfully');
    } catch (error) {
      this.logger.error('Error saving token data:', error.message);
    }
  }

  private calculateTokenExpiry(): Date {
    const now = new Date();
    // Fyers tokens expire at 11:59 PM IST
    const expiryDate = new Date(now);
    expiryDate.setHours(23, 59, 0, 0); // Set to 11:59 PM
    
    // If current time is after market hours (after 4 PM), set expiry to next day
    if (now.getHours() >= 16) {
      expiryDate.setDate(expiryDate.getDate() + 1);
    }
    
    return expiryDate;
  }

  async getValidTokenOrNull(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) {
        this.logger.debug('No token file exists');
        return null;
      }

      const tokenData: TokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
      
      // Check if token is for current trading session
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      if (tokenData.session_date !== currentDate) {
        this.logger.log(`Token is for different session. Current: ${currentDate}, Token: ${tokenData.session_date}`);
        return null;
      }

      // Check if token has expired
      const expiryDate = new Date(tokenData.expiry);
      const now = new Date();
      
      if (expiryDate > now && tokenData.is_valid) {
        const fullToken = `${this.clientId}:${tokenData.access_token}`;
        this.logger.log(`Valid token found, expires in ${Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60))} minutes`);
        
        // Update last validated time
        tokenData.last_validated = new Date().toISOString();
        this.saveTokenData(tokenData);
        
        return fullToken;
      } else {
        this.logger.warn('Stored token has expired or is invalid');
        await this.markTokenAsInvalid();
        return null;
      }
    } catch (error) {
      this.logger.error('Error checking existing token:', error.message);
      return null;
    }
  }

  async validateExistingToken(): Promise<boolean> {
    try {
      const token = await this.getValidTokenOrNull();
      if (!token) {
        return false;
      }

      this.logger.log('Valid token found and validated');
      return true;
    } catch (error) {
      this.logger.error('Token validation failed:', error.message);
      return false;
    }
  }

  private async markTokenAsInvalid(): Promise<void> {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const tokenData: TokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        tokenData.is_valid = false;
        tokenData.last_validated = new Date().toISOString();
        this.saveTokenData(tokenData);
      }
      
      await this.updateAuthStatus({
        authenticated: false,
        token_valid: false,
        expires_at: null,
        services_notified: [],
        session_date: new Date().toISOString().split('T')[0],
        auto_refresh_enabled: true,
        next_refresh_check: new Date(Date.now() + 300000).toISOString() // 5 minutes
      });
    } catch (error) {
      this.logger.error('Error marking token as invalid:', error.message);
    }
  }

  private async updateAuthStatus(status: AuthStatus): Promise<void> {
    try {
      fs.writeFileSync(this.authStatusPath, JSON.stringify(status, null, 2));
      this.logger.debug('Auth status updated');
    } catch (error) {
      this.logger.error('Error updating auth status:', error.message);
    }
  }

  // ===== AUTHENTICATION URL GENERATION =====

 // In your fyers-auth.service.ts
async generateAuthUrl(): Promise<string> {
  try {
    const encodedRedirectUri = encodeURIComponent(this.redirectUri);
    const state = Math.random().toString(36).substring(7); // Generate random state
    
    // ✅ FIXED: Use the correct Fyers V3 format
    const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${this.clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&state=${state}`;
    
    this.logger.log('Generated auth URL:', authUrl);
    
    // Test the URL accessibility
    await this.testUrlAccessibility(authUrl);
    
    return authUrl;
  } catch (error) {
    this.logger.error('Error generating auth URL:', error.message);
    throw new Error(`Failed to generate auth URL: ${error.message}`);
  }
}

// Add URL testing method
private async testUrlAccessibility(url: string): Promise<void> {
  try {
    const response = await axios.head(url.split('?')[0], { timeout: 5000 });
    this.logger.log(`Auth endpoint accessible: ${response.status}`);
  } catch (error) {
    this.logger.warn(`Auth endpoint test failed: ${error.message}`);
    // Don't throw here, just log the warning
  }
}


  // ===== TOKEN GENERATION =====

  async generateTokenFromCode(authCode: string): Promise<TokenResponse> {
  try {
    // First check if we already have a valid token
    const existingToken = await this.getValidTokenOrNull();
    if (existingToken) {
      this.logger.log('Reusing existing valid token');
      const tokenData: TokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
      return {
        access_token: existingToken,
        expires_at: tokenData.expiry,
        reused: true
      };
    }

    this.logger.log('Generating new access token from auth code');
    this.logger.debug(`Auth code received: ${authCode.substring(0, 20)}...`);
    
    // ✅ FIXED: Generate proper SHA-256 hash of clientId:secretKey
    const appIdSecretString = `${this.clientId}:${this.secretKey}`;
    const appIdHash = crypto.createHash('sha256').update(appIdSecretString).digest('hex');
    
    this.logger.debug(`Generated appIdHash: ${appIdHash.substring(0, 10)}...`);
    
    const requestData = {
      grant_type: 'authorization_code',
      appIdHash: appIdHash, // ✅ Now using proper SHA-256 hash
      code: authCode
    };
    
    this.logger.debug('Making token request to Fyers V3 T2 API');
    this.logger.debug(`Token URL: ${this.TOKEN_URL}`);
    
    const response = await axios.post(this.TOKEN_URL, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DAKSphere/1.0'
      },
      timeout: 30000
    });

    this.logger.debug('Fyers API response received');
    this.logger.debug(`Response status: ${response.status}`);

    // Check for API errors
    if (response.data?.s !== 'ok') {
      const errorMsg = response.data?.message || response.data?.error || 'Unknown error';
      this.logger.error('Fyers API returned error:', response.data);
      throw new Error(`Token generation failed: ${errorMsg}`);
    }

    const accessToken = response.data.access_token;
    if (!accessToken) {
      throw new Error('No access token received from Fyers API');
    }

    // Save token data
    const expiryDate = this.calculateTokenExpiry();
    const currentDate = new Date().toISOString().split('T')[0];

    const tokenData: TokenData = {
      access_token: accessToken,
      expiry: expiryDate.toISOString(),
      auth_code: authCode,
      created_at: new Date().toISOString(),
      is_valid: true,
      last_validated: new Date().toISOString(),
      session_date: currentDate
    };

    this.saveTokenData(tokenData);
    
    await this.updateAuthStatus({
      authenticated: true,
      token_valid: true,
      expires_at: expiryDate.toISOString(),
      services_notified: [],
      session_date: currentDate,
      auto_refresh_enabled: true,
      next_refresh_check: new Date(Date.now() + 3600000).toISOString()
    });

    this.logger.log('New access token generated and saved successfully');
    
    return {
      access_token: `${this.clientId}:${accessToken}`,
      expires_at: expiryDate.toISOString(),
      reused: false
    };

  } catch (error) {
    this.logger.error('Token generation error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      clientId: this.clientId,
      authCodePreview: authCode?.substring(0, 20) + '...',
      url: this.TOKEN_URL
    });
    
    let errorMessage = 'Failed to generate access token';
    if (error.response?.data?.message) {
      errorMessage += `: ${error.response.data.message}`;
    } else if (error.response?.status === 400) {
      errorMessage += ': Invalid request format or invalid app id hash';
    } else if (error.response?.status === 401) {
      errorMessage += ': Authentication failed - check client credentials';
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

  // ===== TOKEN ACCESS METHODS =====

  async getCurrentAccessToken(): Promise<string | null> {
    return this.getValidTokenOrNull();
  }

  // ===== PYTHON SERVICE NOTIFICATION =====

  async notifyPythonService(serviceName: string, token: string, authCode: string): Promise<void> {
    try {
      this.logger.log(`Notifying Python service: ${serviceName}`);
      
      // Write auth data to service-specific file
      const serviceAuthPath = path.join(process.cwd(), 'data', `${serviceName}_auth.json`);
      const authData = {
        access_token: token,
        auth_code: authCode,
        client_id: this.clientId,
        timestamp: new Date().toISOString(),
        service: serviceName,
        expires_at: this.calculateExpiryTime()
      };
      
      fs.writeFileSync(serviceAuthPath, JSON.stringify(authData, null, 2));
      this.logger.debug(`Written auth data to: ${serviceAuthPath}`);
      
      // Try to notify via WebSocket if service is running
      await this.notifyViaWebSocket(serviceName, authData);
      
      // Update auth status
      const currentStatus = await this.getAuthStatus();
      if (!currentStatus.services_notified.includes(serviceName)) {
        currentStatus.services_notified.push(serviceName);
        await this.updateAuthStatus(currentStatus);
      }
      
      this.logger.log(`Successfully notified ${serviceName}`);
      
    } catch (error) {
      this.logger.error(`Failed to notify ${serviceName}:`, error.message);
      throw error;
    }
  }

  private calculateExpiryTime(): string {
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setHours(23, 59, 59, 999);
    
    if (now.getHours() > 15) {
      expiryDate.setDate(expiryDate.getDate() + 1);
    }
    
    return expiryDate.toISOString();
  }

  private async notifyViaWebSocket(serviceName: string, authData: any): Promise<void> {
    return new Promise((resolve) => {
      const ports = {
        'fyers_data': 5001,
        'multi_company_live_data': 5010,
        'new_fyers': 5010
      };
      
      const port = ports[serviceName];
      if (!port) {
        this.logger.warn(`Unknown service: ${serviceName}`);
        resolve();
        return;
      }
      
      const client = Client(`http://localhost:${port}`, {
        timeout: 15000, // Increased timeout
        reconnection: false,
        forceNew: true
      });
      
      const timeout = setTimeout(() => {
        this.logger.debug(`WebSocket notification timeout for ${serviceName}`);
        client.disconnect();
        resolve();
      }, 15000);
      
      client.on('connect', () => {
        this.logger.log(`Connected to ${serviceName} WebSocket on port ${port}`);
        client.emit('auth_token_ready', authData);
        clearTimeout(timeout);
        
        setTimeout(() => {
          client.disconnect();
          resolve();
        }, 1000);
      });
      
      client.on('connect_error', (error) => {
        this.logger.debug(`Could not connect to ${serviceName} WebSocket: ${error.message}`);
        clearTimeout(timeout);
        resolve();
      });
      
      client.on('error', (error) => {
        this.logger.debug(`WebSocket error for ${serviceName}: ${error.message}`);
        clearTimeout(timeout);
        client.disconnect();
        resolve();
      });
    });
  }

  // ===== STATUS AND MONITORING =====

  async getAuthStatus(): Promise<AuthStatus> {
    try {
      if (fs.existsSync(this.authStatusPath)) {
        const status = JSON.parse(fs.readFileSync(this.authStatusPath, 'utf8'));
        
        // Validate token is still valid
        const token = await this.getCurrentAccessToken();
        status.token_valid = !!token;
        status.authenticated = !!token;
        
        return status;
      }
    } catch (error) {
      this.logger.error('Error reading auth status:', error.message);
    }
    
    const currentDate = new Date().toISOString().split('T')[0];
    return {
      authenticated: false,
      token_valid: false,
      expires_at: null,
      services_notified: [],
      session_date: currentDate,
      auto_refresh_enabled: true,
      next_refresh_check: new Date(Date.now() + 300000).toISOString()
    };
  }

  async requiresAuthentication(): Promise<{ required: boolean; reason: string; token_status: string }> {
    try {
      const token = await this.getValidTokenOrNull();
      
      if (token) {
        const tokenData: TokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        const expiryDate = new Date(tokenData.expiry);
        const now = new Date();
        const hoursRemaining = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        return {
          required: false,
          reason: `Valid token exists, expires in ${hoursRemaining} hours`,
          token_status: 'valid'
        };
      } else {
        return {
          required: true,
          reason: 'No valid token found or token expired',
          token_status: 'invalid'
        };
      }
    } catch (error) {
      return {
        required: true,
        reason: `Token check failed: ${error.message}`,
        token_status: 'error'
      };
    }
  }

  // ===== AUTH PROCESS =====

  async startAuthProcess(): Promise<string> {
    try {
      // Check if authentication is required
      const { required, reason } = await this.requiresAuthentication();
      
      if (!required) {
        this.logger.log(`Skipping authentication: ${reason}`);
        throw new Error(`Authentication not required: ${reason}`);
      }

      const authUrl = await this.generateAuthUrl();
      
      // Auto-open browser (optional - can be disabled in production)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const { default: open } = await import('open');
          await open(authUrl);
          this.logger.log('Browser opened with auth URL');
        } catch (error) {
          this.logger.warn('Could not auto-open browser:', error.message);
        }
      }
      
      return authUrl;
    } catch (error) {
      this.logger.error('Failed to start auth process:', error.message);
      throw error;
    }
  }

  // ===== TOKEN VALIDATION =====

  async validateToken(token?: string): Promise<boolean> {
    try {
      const accessToken = token || await this.getCurrentAccessToken();
      if (!accessToken) {
        return false;
      }

      // Basic validation - check if token format is correct
      if (!accessToken.includes(':') || !accessToken.startsWith(this.clientId)) {
        this.logger.warn('Invalid token format');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Token validation error:', error.message);
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<boolean> {
    try {
      const currentToken = await this.getCurrentAccessToken();
      if (!currentToken) {
        this.logger.warn('No valid token available for refresh');
        return false;
      }

      // Check if token expires soon (within 1 hour)
      const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
      const expiryDate = new Date(tokenData.expiry);
      const now = new Date();
      const oneHour = 60 * 60 * 1000;

      if (expiryDate.getTime() - now.getTime() < oneHour) {
        this.logger.warn('Token expires soon, manual re-authentication required');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Token refresh check failed:', error.message);
      return false;
    }
  }

  // ===== SCHEDULED TASKS =====

  @Cron('0 */10 * * * *') // Every 10 minutes
  async checkTokenValidity(): Promise<void> {
    try {
      this.logger.debug('Checking token validity (auto-check)');
      
      const isValid = await this.validateExistingToken();
      if (!isValid) {
        this.logger.warn('Token invalid during auto-check');
        await this.markTokenAsInvalid();
      }
    } catch (error) {
      this.logger.error('Error in auto token check:', error.message);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Every day at midnight
  async midnightTokenCleanup(): Promise<void> {
    try {
      this.logger.log('Midnight token cleanup - clearing expired tokens');
      await this.markTokenAsInvalid();
      
      // Clear old token files
      if (fs.existsSync(this.tokenPath)) {
        fs.unlinkSync(this.tokenPath);
        this.logger.log('Old token file deleted');
      }
    } catch (error) {
      this.logger.error('Error in midnight cleanup:', error.message);
    }
  }
}
