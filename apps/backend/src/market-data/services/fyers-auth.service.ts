import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { io as Client } from 'socket.io-client';

interface TokenData {
  access_token: string;
  expiry: string;
  auth_code: string;
  created_at: string;
}

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

@Injectable()
export class FyersAuthService {
  private readonly logger = new Logger(FyersAuthService.name);
  private clientId: string;
  private secretKey: string;
  private redirectUri: string;
  private tokenPath: string;
  private authStatusPath: string;

  // Updated API endpoints to use T1
  private readonly BASE_URL = 'https://api-t1.fyers.in/api/v3';
  private readonly AUTH_URL = `${this.BASE_URL}/generate-authcode`;
  private readonly TOKEN_URL = `${this.BASE_URL}/validate-authcode`;

  constructor() {
    this.clientId = process.env.FYERS_CLIENT_ID || '150HUKJSWG-100';
    this.secretKey = process.env.FYERS_SECRET_ID || '18YYNXCAS7';
    // this.redirectUri = process.env.FYERS_REDIRECT_URI || 'https://daksphere.com';
    this.redirectUri = process.env.FYERS_REDIRECT_URI || 'https://raghavjaiswal709.github.io/DAKSphere_redirect/';

    
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.tokenPath = path.join(dataDir, 'fyers_token.json');
    this.authStatusPath = path.join(dataDir, 'auth_status.json');
    
    this.logger.log(`Initialized Fyers Auth Service with redirect URI: ${this.redirectUri}`);
  }

  async generateAuthUrl(): Promise<string> {
    try {
      // Use proper URL encoding for redirect URI
      const encodedRedirectUri = encodeURIComponent(this.redirectUri);
      const state = 'None'; // Standard state value for Fyers API
      
      const authUrl = `${this.AUTH_URL}?client_id=${this.clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&state=${state}`;
      
      this.logger.log('Generated auth URL with correct V3 T1 endpoint');
      this.logger.debug(`Auth URL: ${authUrl}`);
      
      return authUrl;
    } catch (error) {
      this.logger.error('Error generating auth URL:', error.message);
      throw new Error(`Failed to generate auth URL: ${error.message}`);
    }
  }

  async generateTokenFromCode(authCode: string): Promise<TokenResponse> {
    try {
      this.logger.log('Generating access token from auth code');
      this.logger.debug(`Auth code: ${authCode}`);
      
      const appIdHash = `${this.clientId}:${this.secretKey}`;
      
      const requestData = {
        grant_type: 'authorization_code',
        appIdHash: appIdHash,
        code: authCode
      };
      
      this.logger.debug('Making token request to:', this.TOKEN_URL);
      
      const response = await axios.post(this.TOKEN_URL, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      this.logger.debug('Token response:', response.data);

      if (response.data?.s !== 'ok') {
        throw new Error(`Token generation failed: ${JSON.stringify(response.data)}`);
      }

      const accessToken = response.data.access_token;
      if (!accessToken) {
        throw new Error('No access token received from Fyers API');
      }

      // Calculate expiry (tokens typically last until midnight IST)
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setHours(23, 59, 59, 999); // Set to end of day
      
      // If current time is after market hours, set expiry to next day
      if (now.getHours() > 15) { // After 3:30 PM IST
        expiryDate.setDate(expiryDate.getDate() + 1);
      }

      const tokenData: TokenData = {
        access_token: accessToken,
        expiry: expiryDate.toISOString(),
        auth_code: authCode,
        created_at: new Date().toISOString()
      };

      // Save token
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2));
      
      // Update auth status
      await this.updateAuthStatus({
        authenticated: true,
        token_valid: true,
        expires_at: expiryDate.toISOString(),
        services_notified: []
      });

      this.logger.log('Access token generated and saved successfully');
      
      return {
        access_token: `${this.clientId}:${accessToken}`,
        expires_at: expiryDate.toISOString()
      };

    } catch (error) {
      this.logger.error('Token generation error:', error.response?.data || error.message);
      
      if (error.response) {
        this.logger.error('Response status:', error.response.status);
        this.logger.error('Response headers:', error.response.headers);
      }
      
      throw new Error(`Failed to generate access token: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCurrentAccessToken(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.tokenPath)) {
        this.logger.debug('Token file does not exist');
        return null;
      }

      const tokenData: TokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
      
      // Check if token is expired
      const expiryDate = new Date(tokenData.expiry);
      const now = new Date();
      
      if (expiryDate > now) {
        const fullToken = `${this.clientId}:${tokenData.access_token}`;
        this.logger.debug('Retrieved valid access token');
        return fullToken;
      } else {
        this.logger.warn('Stored token has expired');
        // Update auth status to reflect expired token
        await this.updateAuthStatus({
          authenticated: true,
          token_valid: false,
          expires_at: tokenData.expiry,
          services_notified: []
        });
        return null;
      }
    } catch (error) {
      this.logger.error('Error reading token:', error.message);
      return null;
    }
  }

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
        timeout: 5000,
        reconnection: false,
        forceNew: true
      });
      
      const timeout = setTimeout(() => {
        this.logger.debug(`WebSocket notification timeout for ${serviceName}`);
        client.disconnect();
        resolve();
      }, 5000);
      
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
    
    return {
      authenticated: false,
      token_valid: false,
      expires_at: null,
      services_notified: []
    };
  }

  private async updateAuthStatus(status: AuthStatus): Promise<void> {
    try {
      fs.writeFileSync(this.authStatusPath, JSON.stringify(status, null, 2));
      this.logger.debug('Updated auth status');
    } catch (error) {
      this.logger.error('Error updating auth status:', error.message);
    }
  }

  async startAuthProcess(): Promise<string> {
    try {
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
}
